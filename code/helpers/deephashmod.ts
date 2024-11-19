import { concatBuffers, stringToBuffer } from './buf';
import { sha384 } from './hash';

export interface DeepHashPointer {
    value: Uint8Array;
    role: string;
    dataLength: number;
}
export function isDeepHashPointer(data: any): data is DeepHashPointer {
    return typeof data === 'object' && data !== null && 'value' in data && 'role' in data && 'dataLength' in data;
}

// In TypeScript 3.7, could be written as a single type:
// type DeepHashChunk = Uint8Array | DeepHashChunk[] | DeepHashPointer;
type DeepHashChunk = Uint8Array | DeepHashChunks | DeepHashPointer;
interface DeepHashChunks extends Array<DeepHashChunk> {}

export async function deepHash(
  data: DeepHashChunk
): Promise<Uint8Array> {
  if (Array.isArray(data)) {
    const tag = concatBuffers([
      stringToBuffer("list"),
      stringToBuffer(data.length.toString())
    ]);

    return await deepHashChunks(
      data,
      await sha384(tag)
    );
  }

  if (isDeepHashPointer(data)) {
    // trust the value, pass directly
    return data.value;
  }

  //-------????????????? todo

  const tag = concatBuffers([
    stringToBuffer("blob"),
    stringToBuffer(data.byteLength.toString())
  ]);

  const taggedHash = concatBuffers([
    await sha384(tag),
    await sha384(data)
  ]);

  return await sha384(taggedHash);
}

export async function deepHashChunks(
    chunks: DeepHashChunks,
    acc: Uint8Array,
    skipHighestLevel: boolean = false
): Promise<Uint8Array> {
    if (chunks.length < 1) {
      return acc;
    }
  
    const hashPair = concatBuffers([
      acc,
      await deepHash(chunks[0])
    ]);
  
    if (chunks.length === 1 && skipHighestLevel) {
      // Skip the final SHA-384 hashing for the highest level
      return hashPair;
    }
  
    const newAcc = await sha384(hashPair);
    return await deepHashChunks(chunks.slice(1), newAcc, skipHighestLevel);
}