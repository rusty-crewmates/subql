// Copyright 2020-2022 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { SubqueryProject } from '../configure/SubqueryProject';
import { AlgorandApi } from './algorand/api.algorand';
import { AvalancheApi } from './avalanche/api.avalanche';
import { NetworkMetadataPayload } from './events';
import { SubstrateApi } from './substrate/api.substrate';

@Injectable()
export abstract class ApiService implements OnApplicationShutdown {
  networkMeta: NetworkMetadataPayload;

  constructor(protected project: SubqueryProject) {}

  abstract onApplicationShutdown(): Promise<void>;

  abstract init(): Promise<ApiService>;

  abstract get api(): AvalancheApi | SubstrateApi | AlgorandApi;
}
