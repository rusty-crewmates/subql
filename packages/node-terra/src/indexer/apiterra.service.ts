// Copyright 2020-2022 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import http from 'http';
import https from 'https';
import { Injectable } from '@nestjs/common';
import { ISafeWasmApi, ITerraSafeApi } from '@subql/types-terra';
import {
  AccAddress,
  BlockInfo,
  CodeInfo,
  ContractInfo,
  hashToHex,
  LCDClient,
  LCDClientConfig,
  TxInfo,
  WasmAPI,
  WasmParams,
} from '@terra-money/terra.js';
import { APIParams } from '@terra-money/terra.js/dist/client/lcd/APIRequester';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { NodeConfig } from '../configure/NodeConfig';
import { SubqueryTerraProject } from '../configure/terraproject.model';
import { getLogger } from '../utils/logger';
import { delay } from '../utils/promise';
import { argv } from '../yargs';
import { NetworkMetadataPayload } from './events';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version: packageVersion } = require('../../package.json');

const logger = getLogger('api');

@Injectable()
export class ApiTerraService {
  private api: TerraClient;
  private clientConfig: LCDClientConfig;
  networkMeta: NetworkMetadataPayload;

  constructor(
    protected project: SubqueryTerraProject,
    private nodeConfig: NodeConfig,
  ) {}

  async init(): Promise<ApiTerraService> {
    const { network } = this.project;
    this.clientConfig = {
      URL: network.endpoint,
      chainID: network.chainId,
    };

    this.api = new TerraClient(
      new LCDClient(this.clientConfig),
      network.endpoint,
      this.nodeConfig.networkEndpointParams,
      network.mantlemint,
    );

    try {
      this.api.mantlemintHealthOK = await this.api.mantlemintHealthCheck();
      logger.info(
        `mantlemint health check done... enabled: ${this.api.mantlemintHealthOK}`,
      );
    } catch (e) {
      logger.info('mantlemint health check failed...');
      this.api.mantlemintHealthOK = false;
    }

    this.networkMeta = {
      chain: network.chainId,
    };

    const nodeInfo = await this.api.nodeInfo();

    if (network.chainId !== nodeInfo.default_node_info.network) {
      const err = new Error(
        `The given chainId does not match with client: "${network.chainId}"`,
      );
      logger.error(err, err.message);
      throw err;
    }

    return this;
  }

  getSafeApi(height): TerraSafeApi {
    const api = new TerraSafeApi(
      this.api.lcdConnection,
      height,
      this.api.mantlemintHealthOK,
      this.api.mantlemintConnection,
    );
    return api;
  }

  getApi(): TerraClient {
    return this.api;
  }
}

export class TerraClient {
  mantlemintHealthOK = false;

  lcdConnection: AxiosInstance;
  mantlemintConnection: AxiosInstance;

  constructor(
    private readonly baseApi: LCDClient,
    private tendermintURL: string,
    private readonly params?: Record<string, string>,
    private mantlemintURL?: string,
  ) {
    const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 10 });
    const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 10 });

    this.lcdConnection = axios.create({
      httpAgent,
      httpsAgent,
      timeout: argv('node-timeout') as number,
      baseURL: this.tendermintURL,
      headers: {
        Accept: 'application/json',
        'User-Agent': `SubQuery-Node ${packageVersion}`,
      },
    });

    if (this.mantlemintURL) {
      this.mantlemintConnection = axios.create({
        baseURL: this.mantlemintURL,
        headers: {
          Accept: 'application/json',
          'User-Agent': `SubQuery-Node ${packageVersion}`,
        },
      });
    }
  }

  private disableMantlemint() {
    logger.warn('Mantlemint returning invalid responses, disabling');
    this.mantlemintHealthOK = false;
  }

  async nodeInfo(): Promise<any> {
    const { data } = await this.lcdConnection.get(
      `/cosmos/base/tendermint/v1beta1/node_info`,
      this.params,
    );
    return data;
  }

  async blockInfo(height?: number): Promise<BlockInfo> {
    if (this.mantlemintHealthOK && height) {
      return this.blockInfoMantlemint(height);
    }

    try {
      const { data } = await this.lcdConnection.get(
        `/cosmos/base/tendermint/v1beta1/blocks/${height ?? 'latest'}`,
        this.params,
      );
      return data;
    } catch (e) {
      if (axios.isAxiosError(e) && e.response.status === 400) {
        logger.info(`block ${height} unavailable to fetch, retrying...`);
        await delay(1);
        return this.blockInfo(height);
      } else {
        throw e;
      }
    }
  }

  async txInfo(hash: string): Promise<TxInfo> {
    try {
      const { data } = await this.lcdConnection.get(
        `/cosmos/tx/v1beta1/txs/${hashToHex(hash)}`,
        this.params,
      );
      return TxInfo.fromData(data.tx_response);
    } catch (e) {
      if (axios.isAxiosError(e) && e.response.status === 400) {
        logger.info(`tx ${hash} unavailable to fetch, retrying...`);
        await delay(1);
        return this.txInfo(hash);
      } else {
        throw e;
      }
    }
  }

  async getTxInfobyHashes(
    txHashes: string[],
    height: string,
  ): Promise<TxInfo[]> {
    if (this.mantlemintHealthOK) {
      return this.txsByHeightMantlemint(height);
    }
    return Promise.all(
      txHashes.map(async (hash) => {
        return this.txInfo(hash);
      }),
    );
  }

  async mantlemintHealthCheck(): Promise<boolean> {
    if (!this.mantlemintURL || !this.mantlemintConnection) {
      return false;
    }

    const { data } = await this.mantlemintConnection.get('/health');
    return data === 'OK';
  }

  async blockInfoMantlemint(height?: number): Promise<BlockInfo> {
    try {
      const { data } = await this.mantlemintConnection.get(
        `/index/blocks/${height}`,
      );
      return data;
    } catch (e) {
      // Mantlemint can lag behind the network, at that point we disable it and switch to LCD
      // https://github.com/terra-money/mantlemint/blob/e019308386a23ba4ed405285ca151967ee21623c/indexer/block/client.go#L20-L21
      if (axios.isAxiosError(e) && e.response.status === 400) {
        this.disableMantlemint();
        return this.blockInfo(height);
      } else {
        logger.info(`Error data: ${(e as AxiosError).response.data}`);
        throw e;
      }
    }
  }

  async txsByHeightMantlemint(height: string): Promise<TxInfo[]> {
    const { data } = await this.mantlemintConnection.get(
      `/index/tx/by_height/${height}`,
    );
    // Changes are to cover minor differences between mantlemint and LCD
    return data.map((d) => {
      d.logs = d.logs.map((log) => {
        log.log = log.log ?? '';
        log.msg_index = log.msg_index ?? 0;
        return log;
      });
      d.timestamp = d.timestamp ? d.timestamp.replace(/\.\d+/, '') : '';
      return TxInfo.fromData(d);
    });
  }

  get LCDClient(): LCDClient {
    /* TODO remove this and wrap all calls to include params */
    return this.baseApi;
  }
}

export class TerraSafeApi implements ITerraSafeApi {
  preferredConnection: AxiosInstance;
  wasm: SafeWasmApi;
  constructor(
    private _lcdConnection: AxiosInstance,
    private height: number,
    mantlmintHealthOK: boolean,
    private _mantlemintConnection?: AxiosInstance,
  ) {
    this.preferredConnection = mantlmintHealthOK
      ? this._mantlemintConnection
      : this._lcdConnection;
    this.wasm = new SafeWasmApi(this.preferredConnection, this.height);
  }
}

class SafeWasmApi {
  constructor(
    private preferredConnection: AxiosInstance,
    private height: number,
  ) {}
  async codeInfo(codeID: number): Promise<CodeInfo> {
    const { data } = await this.preferredConnection.get(
      `/terra/wasm/v1beta1/codes/${codeID}`,
    );
    return <CodeInfo>{
      code_id: Number.parseInt(data.code_info.code_id),
      code_hash: data.code_info.code_hash,
      creator: data.code_info.creator,
    };
  }

  async contractInfo(contractAddress: string): Promise<ContractInfo> {
    const { data } = await this.preferredConnection.get(
      `/terra/wasm/v1beta1/contracts/${contractAddress}`,
    );
    return <ContractInfo>{
      code_id: Number.parseInt(data.contract_info.code_id),
      address: data.contract_info.address,
      creator: data.contract_info.creator,
      admin:
        data.contract_info.admin !== '' ? data.contract_info.admin : undefined,
      init_msg: data.contract_info.init_msg,
    };
  }

  async contractQuery<T>(contractAddress: string, query: Object): Promise<T> {
    const { data } = await this.preferredConnection.get(
      `/terra/wasm/v1beta1/contracts/${contractAddress}/store`,
      {
        params: {
          height: this.height,
          query_msg: Buffer.from(JSON.stringify(query), 'utf-8').toString(
            'base64',
          ),
        },
      },
    );
    return data.query_result;
  }

  async parameters(params: APIParams = {}): Promise<WasmParams> {
    const { data } = await this.preferredConnection.get(
      `/terra/wasm/v1beta1/params`,
      params,
    );
    return <WasmParams>{
      max_contract_size: Number.parseInt(data.max_contract_size),
      max_contract_gas: Number.parseInt(data.max_contract_gas),
      max_contract_msg_size: Number.parseInt(data.max_contract_msg_size),
    };
  }
}
