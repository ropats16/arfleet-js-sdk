import { bufferToAscii } from "./buf";
import { Sliceable } from "./sliceable";

type ChunkCacheEntry = {
  plainChunk: Uint8Array;
  encryptedChunk: Uint8Array;
}

export abstract class EncryptedContainer extends Sliceable {
  encryptedChunkSize: number;
  underlyingChunkSize: number;
  chunkCount: number;
  inner: Sliceable | null;
  chunkCache: Map<number, ChunkCacheEntry>;

  constructor(...args: ConstructorParameters<typeof Sliceable>) {
    super(...args);
    this.encryptedChunkSize = -1;
    this.underlyingChunkSize = -1;
    this.chunkCount = -1;
    this.inner = null;
    this.chunkCache = new Map();
  }

  chunkIdxByEncryptedOffset(offset: number): number {
    return Math.floor(offset / this.encryptedChunkSize);
  }

  chunkIdxByUnderlyingOffset(offset: number): number {
    return Math.floor(offset / this.underlyingChunkSize);
  }

  async getEncryptedByteLength(): Promise<number> {
    const originalLength = await this.inner!.getByteLength();
    this.chunkCount = Math.ceil(originalLength / this.underlyingChunkSize);
    return this.chunkCount * this.encryptedChunkSize;
  }

  async getChunkUnderlyingBoundaries(chunkIdx: number): Promise<[number, number, boolean]> {
    const isLastChunk = chunkIdx === this.chunkCount! - 1;
    const chunkUnderlyingStart = chunkIdx * this.underlyingChunkSize;
    const chunkUnderlyingLength = (isLastChunk) ? (await this.inner!.getByteLength() % this.underlyingChunkSize) : this.underlyingChunkSize;
    const chunkUnderlyingEnd = chunkUnderlyingStart + chunkUnderlyingLength;
    return [chunkUnderlyingStart, chunkUnderlyingEnd, isLastChunk];
  }

  async encryptSlice(start: number, end: number): Promise<Uint8Array> {
    if (start >= end) throw new Error("Invalid slice: start must be less than end");
    if (start < 0 || start >= this.byteLengthCached!) throw new Error("Invalid slice: start must be within the underlying byte length");
    if (end < 0 || end > this.byteLengthCached!) throw new Error("Invalid slice: end must be within the underlying byte length");

    this.log("-------------SLICE")
    this.log("start", start);
    this.log("end", end);

    // Adjust calculations to account for overhead
    const startChunkIdx = this.chunkIdxByEncryptedOffset(start);
    const finalByteChunkIdx = this.chunkIdxByEncryptedOffset(end - 1);

    this.log("startChunkIdx", startChunkIdx);
    this.log("finalByteChunkIdx", finalByteChunkIdx);

    // // Calculate offsets within the chunks
    // const startOffset = start % this.encryptedChunkSize;
    // const finishOffset = (end-1) % this.encryptedChunkSize;

    // this.log("startOffset", startOffset);
    // this.log("finishOffset", finishOffset);

    const chunksToStore = finalByteChunkIdx - startChunkIdx + 1;

    let encryptedData = new Uint8Array(chunksToStore * this.encryptedChunkSize);
    let position = 0;

    // console.log("encryptedData", encryptedData);

    for (let chunkIdx = startChunkIdx; chunkIdx <= finalByteChunkIdx; chunkIdx++) {
        this.log(">position before", position);
        const encryptedChunk = await this.encryptChunk(chunkIdx);
        encryptedData.set(encryptedChunk, position);
        position += encryptedChunk.byteLength;
        if (encryptedChunk.byteLength !== this.encryptedChunkSize) {
          console.log("encryptedData", encryptedData);
          console.log("position", position);
          console.log("encryptedChunk", bufferToAscii(encryptedChunk));
          console.log("encryptedChunk.byteLength", encryptedChunk.byteLength);
          console.log("this.encryptedChunkSize", this.encryptedChunkSize);
          console.log("chunkIdx", chunkIdx);
          throw new Error("Encrypted chunk size is not equal to the encrypted chunk size");
        }
        this.log(">position after", position);
    }

    const firstChunkStartIdx = startChunkIdx * this.encryptedChunkSize;
    const startOffsetDifference = start - firstChunkStartIdx;
    const sliceLength = end - start;
    return encryptedData.slice(startOffsetDifference, startOffsetDifference + sliceLength);
  }

  abstract encryptChunk(chunkIdx: number): Promise<Uint8Array>;
}