// Copyright 2020-2022 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import {
  AvalancheBlock,
  AvalancheBlockWrapper,
  AvalancheTransactionFilter,
  AvalancheLog,
  AvalancheLogFilter,
  AvalancheTransaction,
} from './avalanche';
import {SubqlCallFilter, SubqlEventFilter} from './project';

export interface Entity {
  id: string;
}

export type FunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends Function ? K : never;
}[keyof T];

export interface Store {
  get(entity: string, id: string): Promise<Entity | null>;
  getByField(entity: string, field: string, value): Promise<Entity[]>;
  getOneByField(entity: string, field: string, value): Promise<Entity | null>;
  set(entity: string, id: string, data: Entity): Promise<void>;
  bulkCreate(entity: string, data: Entity[]): Promise<void>;
  remove(entity: string, id: string): Promise<void>;
}

export interface BlockWrapper<
  B extends AvalancheBlock = AvalancheBlock,
  C extends AvalancheTransaction = AvalancheTransaction,
  E extends AvalancheLog = AvalancheLog,
  CF extends SubqlCallFilter | AvalancheTransactionFilter = SubqlCallFilter | AvalancheTransactionFilter,
  EF extends SubqlEventFilter | AvalancheLogFilter = SubqlEventFilter | AvalancheLogFilter
> {
  block: B;
  blockHeight: number;
  specVersion?: number;
  hash: string;
  calls?: (filters?: CF | CF[], ds?: any) => C[];
  transactions?: (filters?: CF | CF[], ds?: any) => C[];
  events?: (filters?: EF | EF[], ds?: any) => E[];
  logs?: (filters?: EF | EF[], ds?: any) => E[];
}

export interface ApiWrapper<BW extends BlockWrapper = AvalancheBlockWrapper> {
  init: () => Promise<void>;
  getGenesisHash: () => string;
  getRuntimeChain: () => string;
  getSpecName: () => string;
  getFinalizedBlockHeight: () => Promise<number>;
  getLastHeight: () => Promise<number>;
  fetchBlocks: (bufferBlocks: number[]) => Promise<BW[]>;
  freezeApi: (processor: any, blockContent?: BlockWrapper) => void;
}

export type DynamicDatasourceCreator = (name: string, args: Record<string, unknown>) => Promise<void>;
