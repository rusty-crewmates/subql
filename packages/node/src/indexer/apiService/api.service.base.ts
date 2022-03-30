// Copyright 2020-2022 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { SubqueryProject } from '../../configure/SubqueryProject';
import { AlgorandApi } from '../api.algorand';
import { AvalancheApi } from '../api.avalanche';
import { SubstrateApi } from '../api.substrate';
import { NetworkMetadataPayload } from '../events';

@Injectable()
export abstract class ApiService implements OnApplicationShutdown {
  networkMeta: NetworkMetadataPayload;

  constructor(protected project: SubqueryProject) {}

  abstract onApplicationShutdown(): Promise<void>;

  abstract init(): Promise<ApiService>;

  abstract get api(): AvalancheApi | SubstrateApi | AlgorandApi;
}
