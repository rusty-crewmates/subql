// Copyright 2020-2022 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import {
  AlgorandBlock,
  AlgorandBlockWrapper,
  AlgorandEvent,
  AlgorandTransaction,
  ApiWrapper,
} from '@subql/types';
import algosdk from 'algosdk';
import { AlgorandOptions } from './types';

export class AlgorandApi implements ApiWrapper<AlgorandBlockWrapper> {
  private lastHeader: any;
  private client: algosdk.Algodv2;

  constructor(private options: AlgorandOptions) {}

  async init(): Promise<void> {
    this.client = new algosdk.Algodv2(
      this.options.token,
      this.options.server,
      this.options.port,
    );
    this.lastHeader = (
      await this.client
        .block((await this.client.status().do())['last-round'])
        .do()
    ).block;
  }

  getGenesisHash(): string {
    return this.lastHeader.gh.toString('hex');
  }

  getRuntimeChain(): string {
    return this.lastHeader.gen as string;
  }

  getSpecName(): string {
    return 'algorand';
  }

  async getFinalizedBlockHeight(): Promise<number> {
    const finalizedBlockHeight = (await this.client.status().do())[
      'last-round'
    ];
    return finalizedBlockHeight;
  }

  async getLastHeight(): Promise<number> {
    const lastHeight = (await this.client.status().do())['last-round'];
    return lastHeight;
  }

  async fetchBlocks(bufferBlocks: number[]): Promise<AlgorandBlockWrapper[]> {
    return Promise.all(
      bufferBlocks.map(
        async (round) =>
          new AlgorandBlockWrapped((await this.client.block(round).do()).block),
      ),
    );
  }
}

export class AlgorandBlockWrapped implements AlgorandBlockWrapper {
  constructor(private _block: AlgorandBlock) {}

  get block(): AlgorandBlock {
    return this._block;
  }

  get blockHeight(): number {
    return this.block.rnd;
  }

  get hash(): string {
    return this.block.prev.toString('hex'); // TODO
  }

  getEvents(): AlgorandEvent[] {
    throw new Error('Not implemented'); // TODO
  }

  getVersion(): number {
    return undefined; // TODO
  }
}
