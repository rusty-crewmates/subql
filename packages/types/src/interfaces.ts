// Copyright 2020-2022 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import {Extrinsic, EventRecord, SignedBlock} from '@polkadot/types/interfaces';
import {SubqlCallFilter} from './project';

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

export interface SubstrateBlock extends SignedBlock {
  // parent block's spec version, can be used to decide the correct metadata that should be used for this block.
  specVersion: number;
  timestamp: Date;
  events: EventRecord[];
}

export interface SubstrateExtrinsic {
  // index in the block
  idx: number;
  extrinsic: Extrinsic;
  block: SubstrateBlock;
  events: EventRecord[];
  success: boolean;
}

export interface SubstrateEvent extends EventRecord {
  // index in the block
  idx: number;
  extrinsic?: SubstrateExtrinsic;
  block: SubstrateBlock;
}

export type AlgorandBlock = Record<string, any>;

export type AvalancheBlock = {
  difficulty: string;
  extraData: string;
  gasLimit: string;
  gasUsed: string;
  hash: string;
  logsBloom: string;
  miner: string;
  mixHash: string;
  nonce: string;
  number: string;
  parentHash: string;
  receiptsRoot: string;
  sha3Uncles: string;
  size: string;
  stateRoot: string;
  timestamp: string;
  totalDifficulty: string;
  transactions: AvalancheTransaction[];
  transactionsRoot: string;
  uncles: string[];
};

export type AvalancheTransaction = {
  blockHash: string;
  blockNumber: string;
  from: string;
  gas: string;
  gasPrice: string;
  hash: string;
  input: string;
  nonce: string;
  to: string;
  transactionIndex: string;
  value: string;
  v: string;
  r: string;
  s: string;
};

export type AvalancheEvent = {
  logIndex: string;
  blockNumber: string;
  blockHash: string;
  transactionHash: string;
  transactionIndex: string;
  address: string;
  data: string;
  topics: string[];
};

export interface BlockWrapper {
  getBlock: () => SubstrateBlock | AlgorandBlock | AvalancheBlock;
  getBlockHeight: () => number;
  getHash: () => string;
  getCalls?: (filters?: SubqlCallFilter) => SubstrateExtrinsic[] | AvalancheTransaction[];
  getEvents: () => SubstrateEvent[] | AvalancheEvent[];
  getVersion: () => number;
}

export interface ApiWrapper {
  init: () => Promise<void>;
  getGenesisHash: () => string;
  getRuntimeChain: () => string;
  getSpecName: () => string;
  getFinalizedBlockHeight: () => Promise<number>;
  getLastHeight: () => Promise<number>;
  fetchBlocks: (bufferBlocks: number[]) => Promise<BlockWrapper[]>;
}

export interface AvalancheBlockWrapper extends BlockWrapper {
  get: (objects: string[]) => Record<string, any>;
  getTransactions: (filters?: string[]) => Record<string, any>;
}

export interface SubstrateBlockWrapper extends BlockWrapper {
  getExtrinsincs: () => SubstrateExtrinsic[];
}

export type DynamicDatasourceCreator = (name: string, args: Record<string, unknown>) => Promise<void>;
