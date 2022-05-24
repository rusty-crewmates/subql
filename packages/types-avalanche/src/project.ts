// Copyright 2020-2022 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

export enum SubqlDatasourceKind {
  Runtime = 'substrate/Runtime',
  AvalancheRuntime = 'avalanche/Runtime',
}

// [startSpecVersion?, endSpecVersion?] closed range
export type SpecVersionRange = [number, number];

interface SubqlBaseHandlerFilter {
  specVersion?: SpecVersionRange;
}

export type SubqlBlockFilter = SubqlBaseHandlerFilter;

export interface SubqlEventFilter extends SubqlBaseHandlerFilter {
  module?: string;
  method?: string;
}

export interface SubqlCallFilter extends SubqlEventFilter {
  success?: boolean;
  from?: string;
  to?: string;
}

export interface SubqlCustomHandler<K extends string = string, F = Record<string, unknown>> {
  handler: string;
  kind: K;
  filter?: F;
}

export type SubqlHandlerFilter = SubqlBlockFilter | SubqlCallFilter | SubqlEventFilter;

export interface SubqlNetworkFilter {
  specName?: string;
}

export interface FileReference {
  file: string;
}

export type CustomDataSourceAsset = FileReference;

export type Processor<O = any> = FileReference & {options?: O};

export interface DictionaryQueryCondition {
  field: string;
  value: string;
}

export interface DictionaryQueryEntry {
  entity: string;
  conditions: DictionaryQueryCondition[];
}
