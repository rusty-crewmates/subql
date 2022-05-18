// Copyright 2020-2022 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import fs from 'fs';
import { Interface } from '@ethersproject/abi';
import { hexDataSlice } from '@ethersproject/bytes';
import {
  isRuntimeDataSourceV0_2_0,
  RuntimeDataSourceV0_2_0,
  SubstrateDataSource,
} from '@subql/common-avalanche';
import { getLogger } from '@subql/common-node';
import {
  ApiWrapper,
  AvalancheBlock,
  AvalancheLog,
  AvalancheBlockWrapper,
  AvalancheTransaction,
  AvalancheLogFilter,
  AvalancheCallFilter,
  AvalancheReceipt,
  AvalancheResult,
} from '@subql/types-avalanche';
import { Avalanche } from 'avalanche';
import { EVMAPI } from 'avalanche/dist/apis/evm';
import { IndexAPI } from 'avalanche/dist/apis/index';
import { BigNumber } from 'ethers';
import {
  eventToTopic,
  functionToSighash,
  hexStringEq,
  stringNormalizedEq,
} from '../utils/string';

type AvalancheOptions = {
  ip: string;
  port: number;
  token: string;
  chainName: string; // XV | XT | C | P
};

const logger = getLogger('api.avalanche');

async function loadAssets(
  ds: RuntimeDataSourceV0_2_0,
): Promise<Record<string, string>> {
  if (!ds.assets) {
    return {};
  }
  const res: Record<string, string> = {};

  for (const [name, { file }] of Object.entries(ds.assets)) {
    try {
      res[name] = await fs.promises.readFile(file, { encoding: 'utf8' });
    } catch (e) {
      throw new Error(`Failed to load datasource asset ${file}`);
    }
  }

  return res;
}

export class AvalancheApi implements ApiWrapper<AvalancheBlockWrapper> {
  private client: Avalanche;
  private indexApi: IndexAPI;
  private genesisBlock: Record<string, any>;
  private encoding: string;
  private baseUrl: string;
  private cchain: EVMAPI;
  private contractInterfaces: Record<string, Interface> = {};

  constructor(private options: AvalancheOptions) {
    this.encoding = 'cb58';
    this.client = new Avalanche(this.options.ip, this.options.port, 'http');
    this.client.setAuthToken(this.options.token);
    this.indexApi = this.client.Index();
    this.cchain = this.client.CChain();
    switch (this.options.chainName) {
      case 'XV':
        this.baseUrl = '/ext/index/X/vtx';
        break;
      case 'XT':
        this.baseUrl = '/ext/index/X/tx';
        break;
      case 'C':
        this.baseUrl = '/ext/index/C/block';
        break;
      case 'P':
        this.baseUrl = '/ext/index/P/block';
        break;
      default:
        break;
    }
  }

  async init(): Promise<void> {
    this.genesisBlock = (
      await this.cchain.callMethod(
        'eth_getBlockByNumber',
        ['0x0', true],
        '/ext/bc/C/rpc',
      )
    ).data.result;
  }

  getGenesisHash(): string {
    return this.genesisBlock.hash;
  }

  getRuntimeChain(): string {
    return this.options.chainName;
  }

  getSpecName(): string {
    return 'avalanche';
  }

  async getFinalizedBlockHeight(): Promise<number> {
    const lastAccepted = await this.indexApi.getLastAccepted(
      this.encoding,
      this.baseUrl,
    );
    const finalizedBlockHeight = parseInt(lastAccepted.index);
    return finalizedBlockHeight;
  }

  async getLastHeight(): Promise<number> {
    const lastAccepted = await this.indexApi.getLastAccepted(
      this.encoding,
      this.baseUrl,
    );
    const lastHeight = parseInt(lastAccepted.index);
    return lastHeight;
  }

  async fetchBlocks(bufferBlocks: number[]): Promise<AvalancheBlockWrapper[]> {
    return Promise.all(
      bufferBlocks.map(async (num) => {
        const block_promise = this.cchain.callMethod(
          'eth_getBlockByNumber',
          [`0x${num.toString(16)}`, true],
          '/ext/bc/C/rpc',
        );
        const logs_promise = this.cchain.callMethod(
          'eth_getLogs',
          [
            {
              fromBlock: `0x${num.toString(16)}`,
              toBlock: `0x${num.toString(16)}`,
            },
          ],
          '/ext/bc/C/rpc',
        );
        const block = this.formatBlock((await block_promise).data.result);
        const logs = (await logs_promise).data.result;
        const transactions: AvalancheTransaction[] = new Array(
          block.transactions.length,
        );
        let i = 0;
        for (const tx of block.transactions) {
          const transaction = this.formatTransaction(tx);
          const receipt = (
            await this.cchain.callMethod(
              'eth_getTransactionReceipt',
              [tx.hash],
              '/ext/bc/C/rpc',
            )
          ).data.result;
          transaction.receipt = this.formatReceipt(receipt);
          transactions[i] = transaction;
          i += 1;
        }
        block.transactions = transactions;
        return new AvalancheBlockWrapped(block, logs);
      }),
    );
  }

  freezeApi(processor: any): void {
    processor.freeze(this.client, 'api');
  }

  private formatBlock(block: Record<string, any>): AvalancheBlock {
    const newBlock = {} as AvalancheBlock;
    newBlock.baseFeePerGas = BigNumber.from(block.baseFeePerGas).toBigInt();
    newBlock.blockExtraData = block.extraData;
    newBlock.blockGasCost = BigNumber.from(block.blockGasCost).toBigInt();
    newBlock.difficulty = BigNumber.from(block.difficulty).toBigInt();
    newBlock.extDataGasUsed = block.extDataGasUsed;
    newBlock.extDataHash = block.extDataHash;
    newBlock.gasLimit = BigNumber.from(block.gasLimit).toBigInt();
    newBlock.gasUsed = BigNumber.from(block.gasUsed).toBigInt();
    newBlock.hash = block.hash;
    newBlock.logsBloom = block.logsBloom;
    newBlock.miner = block.miner;
    newBlock.mixHash = block.mixHash;
    newBlock.nonce = block.nonce;
    newBlock.number = BigNumber.from(block.number).toNumber();
    newBlock.parentHash = block.parentHash;
    newBlock.receiptsRoot = block.receiptsRoot;
    newBlock.sha3Uncles = block.sha3Uncles;
    newBlock.size = BigNumber.from(block.size).toBigInt();
    newBlock.stateRoot = block.stateRoot;
    newBlock.timestamp = BigNumber.from(block.timestamp).toBigInt();
    newBlock.totalDifficulty = BigNumber.from(block.totalDifficulty).toBigInt();
    newBlock.transactions = block.transactions;
    newBlock.transactionsRoot = block.transactionsRoot;
    newBlock.uncles = block.uncles;
    return newBlock;
  }

  private formatTransaction(tx: Record<string, any>): AvalancheTransaction {
    const transaction = {} as AvalancheTransaction;
    transaction.blockHash = tx.blockHash;
    transaction.blockNumber = BigNumber.from(tx.blockNumber).toNumber();
    transaction.from = tx.from;
    transaction.gas = BigNumber.from(tx.gas).toBigInt();
    transaction.gasPrice = BigNumber.from(tx.gasPrice).toBigInt();
    transaction.hash = tx.hash;
    transaction.input = tx.input;
    transaction.nonce = BigNumber.from(tx.nonce).toBigInt();
    transaction.to = tx.to;
    transaction.transactionIndex = BigNumber.from(
      tx.transactionIndex,
    ).toBigInt();
    transaction.value = BigNumber.from(tx.value).toBigInt();
    transaction.type = tx.type;
    transaction.v = BigNumber.from(tx.v).toBigInt();
    transaction.r = tx.r;
    transaction.s = tx.s;
    if (tx.accessList) {
      transaction.accessList = tx.accessList;
    }
    if (tx.chainId) {
      transaction.chainId = tx.chainId;
    }
    if (tx.maxFeePerGas) {
      transaction.maxFeePerGas = BigNumber.from(tx.maxFeePerGas).toBigInt();
    }
    if (tx.maxPriorityFeePerGas) {
      transaction.maxPriorityFeePerGas = BigNumber.from(
        tx.maxPriorityFeePerGas,
      ).toBigInt();
    }
    return transaction;
  }

  private formatReceipt(receipt: Record<string, any>): AvalancheReceipt {
    const newReceipt = {} as AvalancheReceipt;
    newReceipt.blockHash = receipt.blockHash;
    newReceipt.blockNumber = BigNumber.from(receipt.blockNumber).toNumber();
    newReceipt.contractAddress = receipt.contractAddress;
    newReceipt.cumulativeGasUsed = BigNumber.from(
      receipt.cumulativeGasUsed,
    ).toNumber();
    newReceipt.effectiveGasPrice = BigNumber.from(
      receipt.effectiveGasPrice,
    ).toNumber();
    newReceipt.from = receipt.from;
    newReceipt.gasUsed = BigNumber.from(receipt.gasUsed).toNumber();
    newReceipt.logs = receipt.logs;
    newReceipt.logsBloom = receipt.logsBloom;
    newReceipt.status = Boolean(BigNumber.from(receipt.status).toNumber());
    newReceipt.to = receipt.to;
    newReceipt.transactionHash = receipt.transactionHash;
    newReceipt.transactionIndex = BigNumber.from(
      receipt.transactionIndex,
    ).toNumber();
    newReceipt.type = receipt.type;
    return newReceipt;
  }

  private buildInterface(
    abiName: string,
    assets: Record<string, string>,
  ): Interface | undefined {
    if (!assets[abiName]) {
      throw new Error(`ABI named "${abiName}" not referenced in assets`);
    }

    // This assumes that all datasources have a different abi name or they are the same abi
    if (!this.contractInterfaces[abiName]) {
      // Constructing the interface validates the ABI
      try {
        let abiObj = JSON.parse(assets[abiName]);

        /*
         * Allows parsing JSON artifacts as well as ABIs
         * https://trufflesuite.github.io/artifact-updates/background.html#what-are-artifacts
         */
        if (!Array.isArray(abiObj) && abiObj.abi) {
          abiObj = abiObj.abi;
        }

        this.contractInterfaces[abiName] = new Interface(abiObj);
      } catch (e) {
        logger.error(`Unable to parse ABI: ${e.message}`);
        throw new Error('ABI is invalid');
      }
    }

    return this.contractInterfaces[abiName];
  }

  async parseEvent<T extends AvalancheResult = AvalancheResult>(
    event: AvalancheLog,
    ds: RuntimeDataSourceV0_2_0,
  ): Promise<AvalancheLog<T>> {
    try {
      if (!ds?.options?.abi) {
        return event as AvalancheLog<T>;
      }
      const iface = this.buildInterface(ds.options.abi, await loadAssets(ds));
      return {
        ...event,
        args: iface?.parseLog(event).args as T,
      };
    } catch (e) {
      logger.warn(`Failed to parse event data: ${e.message}`);
      return event as AvalancheLog<T>;
    }
  }

  async parseTransaction<T extends AvalancheResult = AvalancheResult>(
    transaction: AvalancheTransaction,
    ds: RuntimeDataSourceV0_2_0,
  ): Promise<AvalancheTransaction<T> | AvalancheTransaction> {
    try {
      if (!ds?.options?.abi) {
        return transaction as AvalancheTransaction;
      }
      const iface = this.buildInterface(ds.options.abi, await loadAssets(ds));

      return {
        ...transaction,
        args: iface?.decodeFunctionData(
          iface.getFunction(hexDataSlice(transaction.input, 0, 4)),
          transaction.input,
        ) as T,
      };
    } catch (e) {
      logger.warn(`Failed to parse transaction data: ${e.message}`);
      return transaction as AvalancheTransaction<T>;
    }
  }
}

export class AvalancheBlockWrapped implements AvalancheBlockWrapper {
  constructor(private _block: AvalancheBlock, private _logs: AvalancheLog[]) {}

  get block(): AvalancheBlock {
    return this._block;
  }

  get blockHeight(): number {
    return this.block.number;
  }

  get hash(): string {
    return this.block.hash;
  }

  calls(
    filter?: AvalancheCallFilter,
    ds?: SubstrateDataSource,
  ): AvalancheTransaction[] {
    if (!filter) {
      return this.block.transactions;
    }

    let address: string | undefined;
    if (isRuntimeDataSourceV0_2_0(ds)) {
      address = ds?.options?.address;
    }

    return this.block.transactions.filter((t) =>
      this.filterCallProcessor(t, filter, address),
    );
  }

  events(
    filter?: AvalancheLogFilter,
    ds?: SubstrateDataSource,
  ): AvalancheLog[] {
    if (!filter) {
      return this._logs;
    }

    let address: string | undefined;
    if (isRuntimeDataSourceV0_2_0(ds)) {
      address = ds?.options?.address;
    }

    return this._logs.filter((log) =>
      this.filterEventsProcessor(log, filter, address),
    );
  }

  private filterCallProcessor(
    transaction: AvalancheTransaction,
    filter: AvalancheCallFilter,
    address?: string,
  ): boolean {
    if (filter.to && !stringNormalizedEq(filter.to, transaction.to)) {
      return false;
    }
    if (filter.from && !stringNormalizedEq(filter.from, transaction.from)) {
      return false;
    }
    if (address && !filter.to && !stringNormalizedEq(address, transaction.to)) {
      return false;
    }
    if (
      filter.function &&
      transaction.input.indexOf(functionToSighash(filter.function)) !== 0
    ) {
      return false;
    }
    return true;
  }

  private filterEventsProcessor(
    log: AvalancheLog,
    filter: AvalancheLogFilter,
    address?: string,
  ): boolean {
    if (address && !stringNormalizedEq(address, log.address)) {
      return false;
    }

    if (filter.topics) {
      for (let i = 0; i < Math.min(filter.topics.length, 4); i++) {
        const topic = filter.topics[i];
        if (!topic) {
          continue;
        }

        if (!hexStringEq(eventToTopic(topic), log.topics[i])) {
          return false;
        }
      }
    }
    return true;
  }
}
