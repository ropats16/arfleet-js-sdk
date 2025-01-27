import * as nodepath from "path";
import * as os from "os";
import * as fs from "fs";
import * as crypto from "crypto";
import axios from "axios";
import { defaultConfig as config } from "../arfleet/config.js";
import { color } from "./color.js";

interface BinaryMerkleNode {
  value: Buffer;
  left: BinaryMerkleNode | null;
  right: BinaryMerkleNode | null;
}

interface MerkleNode {
  value: string; // hex string
  left: MerkleNode | null;
  right: MerkleNode | null;
}

interface MerkleHexNode {
  value: string;
  left: MerkleHexNode | null;
  right: MerkleHexNode | null;
}

interface Headers {
  [key: string]: string | undefined;
}

export const setDataDir = (path: string): void => {
  process.env.DATADIR = resolveHome(path);
};

export const getDatadir = (path?: string): string => {
  const datadir = process.env.DATADIR;
  if (!datadir) throw new Error("DATADIR not set");
  return path ? nodepath.join(datadir, path) : datadir;
};

export const getMode = (): string | undefined => {
  return process.env.MODE;
};

export const resolveHome = (filepath: string): string => {
  if (filepath[0] === "~") {
    return nodepath.join(process.env.HOME || os.homedir(), filepath.slice(1));
  }
  return filepath;
};

export const getProjectDir = (): string => {
  if (!require.main?.filename)
    throw new Error("require.main.filename is undefined");
  return nodepath.join(nodepath.dirname(require.main.filename), "..", "..");
};

export const getResourcesDir = (): string => {
  return nodepath.join(getProjectDir(), "backend", "resources");
};

export const getPublicDir = (): string => {
  return nodepath.join(getResourcesDir(), "public");
};

export const getModeConfig = (): unknown => {
  const mode = getMode();
  if (!mode) throw new Error("MODE not set");
  return config[mode as keyof typeof config];
};

export const hashFn = (buf: Buffer): Buffer => {
  if (!Buffer.isBuffer(buf)) {
    throw new Error("Expected a buffer");
  }
  const hash = crypto.createHash("sha256");
  hash.update(buf);
  return hash.digest();
};

export const hashFnHex = (buf: Buffer): string => {
  return hashFn(buf).toString("hex");
};

export const merkleDerive = (
  values: Buffer[],
  digestFn: (data: Buffer) => Buffer,
  initial_iteration: boolean,
): Buffer[] => {
  const length = values.length;
  const results: Buffer[] = [];

  for (let i = 0; i < length; i += 2) {
    const left = values[i];
    const right = i + 1 === length ? left : values[i + 1];
    if (!left || !right) continue;

    const data = initial_iteration
      ? Buffer.concat([Buffer.from([0x00]), left, right])
      : Buffer.concat([left, right]);

    results.push(digestFn(data));
  }

  return results;
};

export const merkle = (
  values: Buffer[],
  digestFn: (data: Buffer) => Buffer,
): Buffer[] => {
  if (!Array.isArray(values)) throw TypeError("Expected values Array");
  if (typeof digestFn !== "function")
    throw TypeError("Expected digest Function");

  const levels: Buffer[][] = [values];
  let level = values;
  let initial_iteration = true;

  do {
    level = merkleDerive(level, digestFn, initial_iteration);
    console.log("level", level);
    levels.push(level);
    initial_iteration = false;
  } while (level.length > 1);

  return levels.flat();
};

export const merkleDeriveFull = (
  values: BinaryMerkleNode[],
  digestFn: (data: Buffer) => Buffer,
  initial_iteration: boolean,
): BinaryMerkleNode[] => {
  const length = values.length;
  const results: BinaryMerkleNode[] = [];

  for (let i = 0; i < length; i += 2) {
    const left = values[i];
    const right = i + 1 === length ? left : values[i + 1];
    if (!left || !right) continue;

    const data = initial_iteration
      ? Buffer.concat([Buffer.from([0x00]), left.value, right.value])
      : Buffer.concat([left.value, right.value]);

    const node: BinaryMerkleNode = {
      value: digestFn(data),
      left,
      right,
    };

    results.push(node);
  }

  return results;
};

export const merkleFull = (
  valuesBin: Buffer[],
  digestFn: (data: Buffer) => Buffer,
): BinaryMerkleNode => {
  if (!Array.isArray(valuesBin)) throw TypeError("Expected values Array");
  if (typeof digestFn !== "function")
    throw TypeError("Expected digest Function");
  if (valuesBin.length === 0) throw TypeError("Values array cannot be empty");

  const values: BinaryMerkleNode[] = valuesBin.map((value) => ({
    value,
    left: null,
    right: null,
  }));

  const levels: BinaryMerkleNode[][] = [values];
  let level = values;
  let initial_iteration = true;

  do {
    const nextLevel = merkleDeriveFull(level, digestFn, initial_iteration);
    if (nextLevel.length === 0) break;

    levels.push(nextLevel);
    level = nextLevel;
    initial_iteration = false;
  } while (level.length > 1);

  if (level.length !== 1) {
    throw new Error("Merkle tree is not valid");
  }

  const root = level[0];
  if (!root) {
    throw new Error("Merkle tree root is undefined");
  }
  return root;
};

export const merkleFullBinToHex = (node: BinaryMerkleNode): MerkleNode => {
  return {
    value: node.value.toString("hex"),
    left: node.left ? merkleFullBinToHex(node.left) : null,
    right: node.right ? merkleFullBinToHex(node.right) : null,
  };
};

export const printTree = (tree: MerkleNode, level = 0): string => {
  let result = "";
  for (let i = 0; i < level; i++) {
    result += "  ";
  }
  result += tree.value + "\n"; // value is already hex string
  if (tree.left) {
    result += printTree(tree.left, level + 1);
  } else {
    for (let i = 0; i < level; i++) {
      result += "  ";
    }
    result += "  null\n";
  }
  if (tree.right) {
    result += printTree(tree.right, level + 1);
  } else {
    for (let i = 0; i < level; i++) {
      result += "  ";
    }
    result += "  null\n";
  }
  return result;
};

export const normalizeHeaders = (headers: Headers): Headers => {
  const normalized: Headers = {};
  for (const key in headers) {
    normalized[key.toLowerCase()] = headers[key];
  }
  return normalized;
};

export const mkdirp = (path: string): void => {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, { recursive: true });
  }
};

export const myExternalIP = async (): Promise<string> => {
  const services = [
    "https://ifconfig.me",
    "https://api.ipify.org",
    "https://ipinfo.io/ip",
  ];
  let lastError: Error | null = null;
  for (const service of services) {
    try {
      const response = await axios.get<string>(service);
      return response.data;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error("Unknown error");
      continue;
    }
  }
  throw lastError;
};

export const xorBuffersInPlace = (a: Buffer, b: Buffer): Buffer => {
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; ++i) {
    a[i] = a[i]! ^ b[i]!;
  }
  return a;
};

interface AO {
  getTokenBalance: (
    token: string,
    decimals: number,
    address: string,
  ) => Promise<number>;
}

export const outputWalletAddressAndBalance = async (
  ao: AO,
  address: string,
  token: string,
  decimals: number,
  symbol: string,
): Promise<void> => {
  console.log(color("Wallet address: " + address, "cyan"));
  const balance = await ao.getTokenBalance(token, decimals, address);
  console.log(
    color("Balance (Token " + token + "): " + balance + " " + symbol, "cyan"),
  );

  if (balance <= 0) {
    console.log("");
    console.log(
      color(
        "WARNING: You don't have any balance in your wallet. Please fund your wallet with some " +
          symbol +
          " to be able to create deals.",
        "red",
      ),
    );
    console.log("");
  }
};
