import { getAoInstance } from "./ao.js";
import { defaultCoreConfig as config } from "./config.js";

interface Provider {
  address: string;
  connectionStrings: string[];
  getCapacityRemaining: () => Promise<number>;
  getStoragePriceDeal: () => Promise<number>;
  getStoragePriceUploadKBSec: () => Promise<number>;
  getMinChallengeDuration: () => Promise<number>;
  getMinStorageDuration: () => Promise<number>;
  getMaxStorageDuration: () => Promise<number>;
}

const announce = async (
  provider: Provider,
  connectionStrings: string[] | null = null,
) => {
  if (connectionStrings) {
    provider.connectionStrings = connectionStrings;
  } else {
    connectionStrings = provider.connectionStrings;
  }

  console.log(
    `Announcing from ${provider.address}, URL are ${provider.connectionStrings}`,
  );

  await getAoInstance().sendActionJSON(config.marketplace, "Announce", {
    "Connection-Strings": provider.connectionStrings,
    "Storage-Capacity": await provider.getCapacityRemaining(),
    "Storage-Price-Deal": await provider.getStoragePriceDeal(),
    "Storage-Price-Upload-KB-Sec": await provider.getStoragePriceUploadKBSec(),
    "Min-Challenge-Duration": await provider.getMinChallengeDuration(),
    "Min-Storage-Duration": await provider.getMinStorageDuration(),
    "Max-Storage-Duration": await provider.getMaxStorageDuration(),
  });
};

const getAnnouncement = async (provider_id: string) => {
  const ret = await getAoInstance().sendActionJSON(
    config.marketplace,
    "Get-Announcement",
    { Provider: provider_id },
  );
  return JSON.parse(ret);
};

const getAnnouncements = async () => {
  const ret = await getAoInstance().sendActionJSON(
    config.marketplace,
    "Get-Announcements",
    {},
  );
  return JSON.parse(ret);
};

export { announce, getAnnouncement, getAnnouncements };
