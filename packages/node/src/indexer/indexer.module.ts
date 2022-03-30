// Copyright 2020-2022 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SubqueryProject } from '../configure/SubqueryProject';
import { DbModule } from '../db/db.module';
import { AlgorandApiService } from './apiService/api.service.algorand';
import { AvalancheApiService } from './apiService/api.service.avalanche';
import { ApiService } from './apiService/api.service.base';
import { SubstrateApiService } from './apiService/api.service.substrate';
import { BenchmarkService } from './benchmark.service';
import { DictionaryService } from './dictionary.service';
import { DsProcessorService } from './ds-processor.service';
import { DynamicDsService } from './dynamic-ds.service';
import { FetchService } from './fetch.service';
import { IndexerManager } from './indexer.manager';
import { MmrService } from './mmr.service';
import { PoiService } from './poi.service';
import { SandboxService } from './sandbox.service';
import { StoreService } from './store.service';

const ApiServiceProvider = {
  provide: ApiService,
  useFactory: async (project: SubqueryProject, eventEmitter: EventEmitter2) => {
    try {
      const { type } = project.network;
      let apiService: ApiService;
      switch (type) {
        case 'algorand':
          apiService = new AlgorandApiService(project);
          break;
        case 'avalanche':
          apiService = new AvalancheApiService(project);
          break;
        case 'substrate':
          apiService = new SubstrateApiService(project, eventEmitter);
          break;
        default:
          throw new Error(
            `Network type doesn't match any of our supported networks. supported: { substrate, algorand, avalanche } actual="${type}`,
          );
      }
      await apiService.init();
      return apiService;
    } catch (e) {
      console.log(e);
      throw e;
    }
  },
  inject: [SubqueryProject, EventEmitter2],
};

const BaseProvider = [
  IndexerManager,
  StoreService,
  FetchService,
  ApiServiceProvider,
  BenchmarkService,
  DictionaryService,
  SandboxService,
  DsProcessorService,
  DynamicDsService,
  PoiService,
  MmrService,
];

@Module({
  imports: [DbModule.forFeature(['Subquery'])],
  providers: BaseProvider,
  exports: [StoreService],
})
export class IndexerModule {}
