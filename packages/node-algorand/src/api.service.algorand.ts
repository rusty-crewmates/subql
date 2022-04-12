// Copyright 2020-2022 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import {Injectable} from '@nestjs/common';
import {ProjectNetworkConfig, ApiService, getLogger} from '@subql/common';
import {AlgorandApi} from './api.algorand';

const logger = getLogger('api');

@Injectable()
export class AlgorandApiService extends ApiService {
  private _api: AlgorandApi;

  async init(): Promise<AlgorandApiService> {
    let network: Partial<ProjectNetworkConfig>;
    try {
      network = this.project.network;
    } catch (e) {
      logger.error(Object.keys(e));
      process.exit(1);
    }
    logger.info(JSON.stringify(this.project.network));

    this.api = new AlgorandApi({
      token: network.token,
      server: network.endpoint,
      port: network.port,
    });
    await this.api.init();

    this.networkMeta = {
      chain: this.api.getRuntimeChain(),
      specName: this.api.getSpecName(),
      genesisHash: this.api.getGenesisHash(),
    };

    if (network.genesisHash && network.genesisHash !== this.networkMeta.genesisHash) {
      const err = new Error(
        `Network genesisHash doesn't match expected genesisHash. expected="${network.genesisHash}" actual="${this.networkMeta.genesisHash}`
      );
      logger.error(err, err.message);
      throw err;
    }

    return this;
  }

  get api(): AlgorandApi {
    return this._api;
  }

  private set api(value: AlgorandApi) {
    this._api = value;
  }
}
