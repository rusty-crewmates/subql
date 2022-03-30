// Copyright 2020-2022 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { ProjectNetworkConfig } from '@subql/common';
import { getLogger } from '../../utils/logger';
import { AvalancheApi } from '../api.avalanche';
import { ApiService } from './api.service.base';

const logger = getLogger('api');

@Injectable()
export class AvalancheApiService extends ApiService {
  async onApplicationShutdown(): Promise<void> {
    return Promise.resolve();
  }

  async init(): Promise<AvalancheApiService> {
    console.log('Api Avalanche Init');
    let network: Partial<ProjectNetworkConfig>;
    try {
      network = this.project.network;
    } catch (e) {
      logger.error(Object.keys(e));
      process.exit(1);
    }
    logger.info(JSON.stringify(this.project.network));

    this.api = new AvalancheApi({
      ip: network.endpoint,
      port: network.port,
      token: network.token,
      chainName: network.chainName,
    });
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

  get api(): AvalancheApi {
    return this.api;
  }

  private set api(value: AvalancheApi) {
    this.api = value;
  }
}
