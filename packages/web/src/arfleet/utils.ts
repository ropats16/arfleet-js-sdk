import { defaultCoreConfig as config } from "@arfleet/core";
const color = (x: string, c: string) => x;

// @ts-ignore
import { sha256 } from "../helpers/hash.js";
// @ts-ignore
import { bufferToHex, concatBuffers } from "../helpers/buf.js";

interface MerkleNode {
  value: Buffer;
  left: MerkleNode | null;
  right: MerkleNode | null;
}

export default {
  hashFn: async function (buf: Buffer): Promise<Buffer> {
    return await sha256(buf);
  },
  hashFnHex: async function (buf: Buffer): Promise<string> {
    return bufferToHex(await this.hashFn(buf));
  },
  merkleDerive: async function (
    values: Buffer[],
    digestFn: (data: Buffer) => Promise<Buffer>,
    initial_iteration: boolean,
  ): Promise<Buffer[]> {
    const length = values.length;
    const results: Buffer[] = [];

    for (let i = 0; i < length; i += 2) {
      const left = values[i];
      const right = i + 1 === length ? left : values[i + 1];
      const data = initial_iteration
        ? concatBuffers([Buffer.from([0x00]), left, right])
        : concatBuffers([left, right]);

      results.push(await digestFn(data));
    }

    return results;
  },
  merkle: async function (
    values: Buffer[],
    digestFn: (data: Buffer) => Promise<Buffer>,
  ): Promise<Buffer[]> {
    if (!Array.isArray(values)) throw TypeError("Expected values Array");
    if (typeof digestFn !== "function")
      throw TypeError("Expected digest Function");

    const levels: Buffer[][] = [values];
    let level = values;
    let initial_iteration = true;

    do {
      level = await this.merkleDerive(level, digestFn, initial_iteration);
      console.log("level", level);
      levels.push(level);
      initial_iteration = false;
    } while (level.length > 1);

    return [...levels].flat();
  },
  merkleDeriveFull: async function (
    values: MerkleNode[],
    digestFn: (data: Buffer) => Promise<Buffer>,
    initial_iteration: boolean,
  ): Promise<MerkleNode[]> {
    const length = values.length;
    const results: MerkleNode[] = [];

    for (let i = 0; i < length; i += 2) {
      const left = values[i];
      const right = i + 1 === length ? left : values[i + 1];
      const data = initial_iteration
        ? concatBuffers([
            new Uint8Array([0x00]),
            left?.value ?? Buffer.alloc(0),
            right?.value ?? Buffer.alloc(0),
          ])
        : concatBuffers([
            left?.value ?? Buffer.alloc(0),
            right?.value ?? Buffer.alloc(0),
          ]);

      const node: MerkleNode = {
        value: await digestFn(data),
        left: left ?? null,
        right: right ?? null,
      };

      results.push(node);
    }

    return results;
  },
  merkleFull: async function (
    valuesBin: Buffer[],
    digestFn: (data: Buffer) => Promise<Buffer>,
  ): Promise<MerkleNode> {
    if (!Array.isArray(valuesBin)) throw TypeError("Expected values Array");
    if (typeof digestFn !== "function")
      throw TypeError("Expected digest Function");

    let values: MerkleNode[] = valuesBin.map((value) => ({
      value,
      left: null,
      right: null,
    }));

    const levels: MerkleNode[][] = [values];
    let level = values;
    let initial_iteration = true;

    do {
      level = await this.merkleDeriveFull(level, digestFn, initial_iteration);
      levels.push(level);
      initial_iteration = false;
    } while (level.length > 1);

    if (level.length !== 1) {
      throw new Error("Merkle tree is not valid");
    }

    return level[0] as MerkleNode;
  },
  merkleFullBinToHex: async function (node: MerkleNode): Promise<{
    value: string;
    left: any;
    right: any;
  }> {
    return {
      value: node.value.toString("hex"),
      left: node.left ? await this.merkleFullBinToHex(node.left) : null,
      right: node.right ? await this.merkleFullBinToHex(node.right) : null,
    };
  },
  printTree: function (tree: MerkleNode, level = 0): string {
    let result = "";
    for (let i = 0; i < level; i++) {
      result += "  ";
    }
    result += tree.value.toString("hex") + "\n";
    if (tree.left) {
      result += this.printTree(tree.left, level + 1);
    } else {
      for (let i = 0; i < level; i++) {
        result += "  ";
      }
      result += "  null\n";
    }
    if (tree.right) {
      result += this.printTree(tree.right, level + 1);
    } else {
      for (let i = 0; i < level; i++) {
        result += "  ";
      }
      result += "  null\n";
    }
    return result;
  },
  normalizeHeaders(headers: { [key: string]: string }): {
    [key: string]: string;
  } {
    const normalized: { [key: string]: string } = {};
    for (const key in headers) {
      normalized[key.toLowerCase()] = headers[key] ?? "";
    }
    return normalized;
  },
  xorBuffersInPlace: function (a: Buffer, b: Buffer): Buffer {
    var length = Math.min(a.length, b.length);
    for (var i = 0; i < length; ++i) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      a[i] = a[i]! ^ b[i]!;
    }
    return a;
  },
};
