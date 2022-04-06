// Copyright 2020-2022 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { SubqueryProject } from '../configure/SubqueryProject';
import { AlgorandApi } from './algorand/api.algorand';
import { AvalancheApi } from './avalanche/api.avalanche';
import { NetworkMetadataPayload } from './events';
import { SubstrateApi } from './substrate/api.substrate';

@Injectable()
export abstract class ApiService {
  networkMeta: NetworkMetadataPayload;

  constructor(protected project: SubqueryProject) {}

  abstract init(): Promise<ApiService>;

  abstract get api(): AvalancheApi | SubstrateApi | AlgorandApi;
}
