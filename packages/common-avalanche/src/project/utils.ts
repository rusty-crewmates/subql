// Copyright 2020-2022 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import {
  SubstrateCustomDataSource,
  SubstrateDataSource,
  SubstrateDatasourceKind,
  SubstrateNetworkFilter,
  SubstrateRuntimeDataSource,
} from './types';

export function isCustomDs<F extends SubstrateNetworkFilter>(
  ds: SubstrateDataSource
): ds is SubstrateCustomDataSource<string, F> {
  return ds.kind !== SubstrateDatasourceKind.Runtime && !!(ds as SubstrateCustomDataSource<string, F>).processor;
}

export function isRuntimeDs(ds: SubstrateDataSource): ds is SubstrateRuntimeDataSource {
  return ds.kind === SubstrateDatasourceKind.Runtime;
}
