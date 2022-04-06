// Copyright 2020-2022 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import {
  SubqlCustomDatasource,
  SubqlCustomHandler,
  SubqlMapping,
  SubqlNetworkFilter,
  SubqlRuntimeHandler,
} from '@subql/types';
import {plainToClass, Type} from 'class-transformer';
import {Equals, IsArray, IsObject, IsOptional, IsString, ValidateNested, validateSync} from 'class-validator';
import yaml from 'js-yaml';
import {CustomDataSourceBase, Mapping, RuntimeDataSourceBase} from '../../models';
import {ProjectManifestBaseImpl} from '../base';
import {
  CustomDatasourceV0_3_0,
  IRuntimeDataSourceOptions,
  ProjectManifestV0_3_0,
  RuntimeDataSourceV0_3_0,
  SubqlMappingV0_3_0,
} from './types';

class FileType {
  @IsString()
  file: string;
}

export class ProjectNetworkDeploymentV0_3_0 {
  @IsString()
  genesisHash: string;
  @ValidateNested()
  @Type(() => FileType)
  @IsOptional()
  chaintypes?: FileType;
}

export class ProjectNetworkV0_3_0 extends ProjectNetworkDeploymentV0_3_0 {
  @IsString()
  @IsOptional()
  endpoint?: string;
  @IsString()
  @IsOptional()
  dictionary?: string;
}

export class ProjectMappingV0_3_0 extends Mapping {
  @IsString()
  file: string;
}

function validateObject(object: any, errorMessage = 'failed to validate object.'): void {
  const errors = validateSync(object, {whitelist: true, forbidNonWhitelisted: true});
  if (errors?.length) {
    // TODO: print error details
    const errorMsgs = errors.map((e) => e.toString()).join('\n');
    throw new Error(`${errorMessage}\n${errorMsgs}`);
  }
}

export class RuntimeDataSourceOptions implements IRuntimeDataSourceOptions {
  @IsString()
  @IsOptional()
  abi?: string;

  @IsString()
  @IsOptional()
  address?: string;
}

export class RuntimeDataSourceV0_3_0Impl
  extends RuntimeDataSourceBase<SubqlMappingV0_3_0<SubqlRuntimeHandler>>
  implements RuntimeDataSourceV0_3_0
{
  @Type(() => ProjectMappingV0_3_0)
  @ValidateNested()
  mapping: SubqlMappingV0_3_0<SubqlRuntimeHandler>;

  @Type(() => RuntimeDataSourceOptions)
  @IsOptional()
  options?: RuntimeDataSourceOptions;

  @Type(() => FileType)
  @IsOptional()
  @ValidateNested({each: true})
  assets?: Map<string, FileType>;

  validate(): void {
    return validateObject(this, 'failed to validate runtime datasource.');
  }
}

export class CustomDataSourceV0_3_0Impl<
    K extends string = string,
    T extends SubqlNetworkFilter = SubqlNetworkFilter,
    M extends SubqlMapping = SubqlMappingV0_3_0<SubqlCustomHandler>
  >
  extends CustomDataSourceBase<K, T, M>
  implements SubqlCustomDatasource<K, T, M>
{
  validate(): void {
    return validateObject(this, 'failed to validate custom datasource.');
  }
}

export class DeploymentV0_3_0 {
  @Equals('0.3.0')
  @IsString()
  specVersion: string;
  @ValidateNested()
  @Type(() => FileType)
  schema: FileType;
  @IsArray()
  @ValidateNested()
  @Type(() => CustomDataSourceV0_3_0Impl, {
    discriminator: {
      property: 'kind',
      subTypes: [
        {value: RuntimeDataSourceV0_3_0Impl, name: 'substrate/Runtime'},
        {value: RuntimeDataSourceV0_3_0Impl, name: 'avalanche/Runtime'},
      ],
    },
    keepDiscriminatorProperty: true,
  })
  dataSources: (RuntimeDataSourceV0_3_0 | CustomDatasourceV0_3_0)[];
  @ValidateNested()
  @Type(() => ProjectNetworkDeploymentV0_3_0)
  network: ProjectNetworkDeploymentV0_3_0;
}

export class ProjectManifestV0_3_0Impl
  extends ProjectManifestBaseImpl<DeploymentV0_3_0>
  implements ProjectManifestV0_3_0
{
  @Equals('0.3.0')
  specVersion: string;
  @IsString()
  name: string;
  @IsString()
  version: string;
  @IsObject()
  @ValidateNested()
  @Type(() => ProjectNetworkV0_3_0)
  network: ProjectNetworkV0_3_0;
  @ValidateNested()
  @Type(() => FileType)
  schema: FileType;
  @IsArray()
  @ValidateNested()
  @Type(() => CustomDataSourceV0_3_0Impl, {
    discriminator: {
      property: 'kind',
      subTypes: [{value: RuntimeDataSourceV0_3_0Impl, name: 'substrate/Runtime'}],
    },
    keepDiscriminatorProperty: true,
  })
  dataSources: (RuntimeDataSourceV0_3_0 | CustomDatasourceV0_3_0)[];
  protected _deployment: DeploymentV0_3_0;

  toDeployment(): string {
    return yaml.dump(this._deployment, {
      sortKeys: true,
      condenseFlow: true,
    });
  }

  get deployment(): DeploymentV0_3_0 {
    if (!this._deployment) {
      this._deployment = plainToClass(DeploymentV0_3_0, this);
      validateSync(this._deployment, {whitelist: true});
    }
    return this._deployment;
  }

  validate(): void {
    return validateObject(this.deployment, 'failed to validate project.');
  }
}