// Copyright 2020-2022 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { AlgorandBlock, ApiWrapper, BlockWrapper } from '@subql/types';
import algosdk from 'algosdk';
import { AlgorandOptions } from './types';

export class AlgorandApi implements ApiWrapper {
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

  async fetchBlocks(bufferBlocks: number[]): Promise<BlockWrapper[]> {
    return Promise.all(
      bufferBlocks.map(
        async (round) =>
          new AlgorandBlockWrapped((await this.client.block(round).do()).block),
      ),
    );
  }
}

export class AlgorandBlockWrapped implements BlockWrapper {
  constructor(private block: AlgorandBlock) {}

  getBlock(): AlgorandBlock {
    return this.block;
  }

  getBlockHeight(): number {
    return this.block.rnd;
  }

  getHash(): string {
    return this.block.prev.toString('hex'); // TODO
  }
}
