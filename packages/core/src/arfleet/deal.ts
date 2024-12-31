import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { defaultCoreConfig as config } from "./config.js";
import { AOClient } from "./ao.js";

// Get the directory path of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const createAndSpawnDeal = async (
  ao: () => AOClient,
  placement: {
    providerId: string;
    createdAt: number;
    requiredReward: number;
    requiredCollateral: number;
    processId: string;
  },
  merkle_root_hex: string,
  arpId: string,
  assignment: {
    walletAddress: string;
  },
) => {
  const dealDuration = 1 * 365 * 24 * 60 * 60; // todo

  // create process
  const createdAtTimestamp = Math.floor(placement.createdAt / 1000);
  const lua_lines = [
    `State.Provider = '${placement.providerId}'`,
    `State.MerkleRoot = '${merkle_root_hex}'`,
    `State.ArpRoot = '${arpId}'`,
    `State.Client = '${assignment.walletAddress}'`,
    `State.Token = '${config.defaultToken}'`,
    `State.RequiredReward = ${placement.requiredReward}`,
    "State.ReceivedReward = 0",
    `State.RequiredCollateral = ${placement.requiredCollateral}`,
    "State.ReceivedCollateral = 0",
    "State.VerificationEveryPeriod = 10000", // todo
    "State.VerificationResponsePeriod = 10000", // todo
    `State.CreatedAt = ${createdAtTimestamp}`,
    `State.ExpiresAt = ${createdAtTimestamp + dealDuration}`,
    "State.Status = StatusEnum.Created",
  ].join("\n");

  const process_id = await spawnDeal(lua_lines, ao);
  console.log("Process ID: ", process_id);

  console.log(await ao().sendAction(process_id, "Eval", "State"));

  return process_id;
};

const loadLuaSourceFile = async (filename: string): Promise<string> => {
  try {
    const luaPath = join(__dirname, "..", "lua", filename);
    const response = await fetch(`file://${luaPath}`);
    if (!response.ok) {
      throw new Error(`Failed to load Lua file: ${filename}`);
    }
    return await response.text();
  } catch (error) {
    console.error(`Error loading Lua file: ${filename}`, error);
    throw error;
  }
};

const spawnDeal = async (
  extra_lines: string,
  ao: () => AOClient,
): Promise<string> => {
  const luaFiles = [
    "libs/hex.lua",
    "libs/sha256.lua",
    "libs/base64.lua",
    "ArFleetDeal.lua",
  ];

  const sources = await Promise.all(
    luaFiles.map((file) => loadLuaSourceFile(file)),
  );

  const sources_concat = sources.join("\n\n");

  const process_id = await ao().spawn(sources_concat, [
    { name: "Name", value: "arfleet-deal" },
  ]);

  await ao().sendAction(process_id, "Eval", extra_lines);

  return process_id;
};

export const sendCollateral = async (
  process_id: string,
  collateral: number,
  ao: () => AOClient,
): Promise<void> => {
  await ao().sendAction(process_id, "SendCollateral", collateral);
};

export const fundDeal = async (
  ao: () => AOClient,
  placement: {
    processId: string;
    requiredReward: number;
  },
): Promise<void> => {
  await ao().sendToken(
    config.defaultToken,
    placement.processId,
    placement.requiredReward,
  );
};
