// @ts-ignore
import {
  defaultCoreConfig,
  KB,
  MB,
  GB,
  TB,
  PB,
  WINSTON,
  AR,
  SECOND,
  MINUTE,
  HOUR,
  DAY,
  WEEK,
  MONTH,
  YEAR,
} from "@arfleet/core";

import type { CoreConfig } from "@arfleet/core";

interface ServerConfig {
  host: string;
  port: number;
}

interface ClientConfig {
  defaultDatadir: string;
  apiServer: ServerConfig;
  defaultDesiredRedundancy: number;
  defaultDesiredStorageDuration: number;
  fetchAnnouncementsInterval: number;
  defaultMaxChallengeDuration: number;
}

interface ProviderConfig {
  defaultDatadir: string;
  apiServer: ServerConfig;
  publicServer: ServerConfig;
  defaultStorageCapacity: number;
  defaultStoragePriceDeal: number;
  defaultStoragePriceUploadKBSec: number;
  defaultMinStorageDuration: number;
  defaultMaxStorageDuration: number;
  defaultMinChallengeDuration: number;
}

interface DBConfig {
  define: {
    underscored: boolean;
    timestamps: boolean;
    createdAt: string;
    updatedAt: string;
  };
  dialect: string;
  storage: string;
  transactionType: string;
  retry: {
    max: number;
  };
  enable_db_logging: boolean;
}

interface Config
  extends Pick<
    CoreConfig,
    | "marketplace"
    | "aoScheduler"
    | "aosModule"
    | "defaultToken"
    | "defaultTokenDecimals"
    | "defaultTokenSymbol"
    | "passes"
    | "aoConfig"
    | "rsa_encryption"
  > {
  walletPath: string;
  client: ClientConfig;
  provider: ProviderConfig;
  db: DBConfig;
  chunkSize: number;
  _chunkSize: number;
  chunkinfoPrologue: string;
  directoryPrologue: string;
  encryptedChunkPrologue: string;
}

export const defaultConfig: Config = {
  walletPath: "wallet.json",
  client: {
    defaultDatadir: "~/.arfleet-client",
    apiServer: {
      host: "127.0.0.1",
      port: 8885,
    },
    defaultDesiredRedundancy: 1,
    defaultDesiredStorageDuration: 6 * MONTH,
    fetchAnnouncementsInterval: 1 * MINUTE,
    defaultMaxChallengeDuration: 1 * WEEK,
  },
  provider: {
    defaultDatadir: "~/.arfleet-provider",
    apiServer: {
      host: "127.0.0.1",
      port: 8886,
    },
    publicServer: {
      host: "0.0.0.0",
      port: 8890,
    },
    defaultStorageCapacity: 1 * GB,
    defaultStoragePriceDeal: 1 * WINSTON,
    defaultStoragePriceUploadKBSec: 1 * WINSTON,
    defaultMinStorageDuration: 1 * DAY,
    defaultMaxStorageDuration: 6 * MONTH,
    defaultMinChallengeDuration: 1 * DAY,
  },
  db: {
    define: {
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    dialect: "sqlite",
    storage: "arfleet.db",
    transactionType: "DEFERRED",
    retry: {
      max: 5,
    },
    enable_db_logging: false,
  },
  chunkSize: 4096,
  _chunkSize: 2048,
  chunkinfoPrologue: "ARFLEET\x05\x06\xf5\xf6*INFO",
  directoryPrologue: "ARFLEET\x05\x06\xf5\xf6*DIR",
  encryptedChunkPrologue: "ARFLEET\x05\x06\xf5\xf6*ENC",

  marketplace: defaultCoreConfig.marketplace,
  aoScheduler: defaultCoreConfig.aoScheduler,
  aosModule: defaultCoreConfig.aosModule,
  defaultToken: defaultCoreConfig.defaultToken,
  defaultTokenDecimals: defaultCoreConfig.defaultTokenDecimals,
  defaultTokenSymbol: defaultCoreConfig.defaultTokenSymbol,

  passes: defaultCoreConfig.passes,

  aoConfig: defaultCoreConfig.aoConfig,

  rsa_encryption: defaultCoreConfig.rsa_encryption,
};

console.log(defaultConfig);

export default defaultConfig;
