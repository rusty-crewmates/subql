// Copyright 2020-2022 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BlockHash } from '@polkadot/types/interfaces';
import { RegisteredTypes } from '@polkadot/types/types';
import { ProjectNetworkConfig } from '@subql/common';
import { SubqueryProject } from '../../configure/SubqueryProject';
import { getLogger } from '../../utils/logger';
import { SubstrateApi } from '../api.substrate';
import { ApiAt } from '../types';
import { ApiService } from './api.service.base';

const logger = getLogger('api');

@Injectable()
export class SubstrateApiService extends ApiService {
  constructor(project: SubqueryProject, private eventEmitter: EventEmitter2) {
    super(project);
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([this.api?.disconnect()]);
  }

  async init(): Promise<SubstrateApiService> {
    let network: Partial<ProjectNetworkConfig>;
    let chainTypes: RegisteredTypes;
    try {
      network = this.project.network;
      chainTypes = this.project.chainTypes;
    } catch (e) {
      logger.error(Object.keys(e));
      process.exit(1);
    }
    logger.info(JSON.stringify(this.project.network));

    this.api = new SubstrateApi(network, chainTypes, this.eventEmitter);
    await this.api.init();

    this.networkMeta = {
      chain: this.api.getRuntimeChain(),
      specName: this.api.getSpecName(),
      genesisHash: this.api.getGenesisHash(),
    };

    if (
      network.genesisHash &&
      network.genesisHash !== this.networkMeta.genesisHash
    ) {
      const err = new Error(
        `Network genesisHash doesn't match expected genesisHash. expected="${network.genesisHash}" actual="${this.networkMeta.genesisHash}`,
      );
      logger.error(err, err.message);
      throw err;
    }

    return this;
  }

  get api(): SubstrateApi {
    return this.api;
  }

  private set api(value: SubstrateApi) {
    this.api = value;
  }

  async getPatchedApi(
    blockHash: string | BlockHash,
    blockNumber: number,
    parentBlockHash?: BlockHash,
  ): Promise<ApiAt> {
    const substrateApi = this.api as SubstrateApi;
    const patchedApi = await substrateApi.getPatchedApi(
      blockHash,
      blockNumber,
      parentBlockHash,
    );
    return patchedApi;
  }
}
