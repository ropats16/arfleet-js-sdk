/* eslint-disable @typescript-eslint/no-unused-vars */
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

const defaultConfig = {
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
