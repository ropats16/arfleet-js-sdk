import { FileMetadata } from "@/contexts/ArFleetContext";
import { concatBuffers } from "./buf";
import { readFileChunk } from "./buf";
import { downloadUint8ArrayAsFile } from "./extra";
import { CallbackQueue } from "./callbackQueue";

/*
*   Slice(start, end) means:
*
*   [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]
*           ^--^--^--\
*   slice(2, 5) => [ 2, 3, 4 ]
* 
*   [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]
*                             ^--^--\
*   slice(8, 10) => [ 8, 9 ]
* 
*   end-th index is excluded
*/

export type SliceLength = number;
export type SlicePart = [SliceLength, (
    Uint8Array
    | File
    | (() => Uint8Array)
    | (() => Promise<Uint8Array>)
    | ((start: number, end: number) => Uint8Array)
    | ((start: number, end: number) => Promise<Uint8Array>)
    | Sliceable
)];
export type SliceParts = SlicePart[];

const log = (...args: any[]) => (true) ? console.log('[Sliceable]', ...args) : null;

export abstract class Sliceable {
    partsCached: SliceParts | null = null;
    byteLengthCached: number | null = null;
    buildPartsQueue: CallbackQueue = new CallbackQueue();

    log: (...args: any[]) => void;

    constructor(...args: any[]) {
      this.log = log;
    }

    async getParts(): Promise<SliceParts> {
        if (this.partsCached !== null) return this.partsCached;

        if (this.buildPartsQueue.status === "done") {
            return this.buildPartsQueue.result;
        }
        if (this.buildPartsQueue.status === "calculating") {
            return new Promise((resolve, reject) => { this.buildPartsQueue.add([resolve, reject]); });
        }
        this.buildPartsQueue.status = "calculating";

        this.partsCached = await this.buildParts();

        this.buildPartsQueue.done(this.partsCached);

        return this.partsCached;
    }

    async zeroes(start: number, end: number): Promise<Uint8Array> {
      return new Uint8Array(end - start).fill(0x00);
    }

    async getByteLength(): Promise<number> {
        if (this.byteLengthCached !== null) return this.byteLengthCached;
        const parts = await this.getParts();
        return this.byteLengthCached = parts.reduce((acc, [length, _]) => acc + length, 0);
    }

    async slice(start: number, end: number): Promise<Uint8Array> {
        if (start < 0 || end < 0 || start > end) throw new Error(`Invalid slice: start=${start}, end=${end}`);

        const parts = await this.getParts();

        if (this.byteLengthCached === null) throw new Error('Byte length not cached yet, but we just built parts');
        if (start >= this.byteLengthCached) throw new Error(`Invalid slice idx: start=${start} is greater than or equal to byte length=${this.byteLengthCached}`);
        if (end > this.byteLengthCached) throw new Error(`Invalid slice idx: end=${end} is greater than byte length=${this.byteLengthCached}`);

        let result: Uint8Array[] = [];
        let currentPosition = 0;

        for (const part of parts) {
            const [length, bytes] = part;

            if (length < 0) throw new Error("Invalid part length");

            const partStart = currentPosition;
            const partEnd = currentPosition + length;

            if (partEnd > start && partStart < end) {
                const sliceStart = Math.max(0, start - partStart);
                const sliceEnd = Math.min(length, end - partStart);

                if (sliceStart > sliceEnd) throw new Error(`This should never happen: start=${sliceStart}, end=${sliceEnd}`);
                if (sliceStart < 0) throw new Error(`This should never happen: start=${sliceStart}`);
                if (sliceEnd < 0) throw new Error(`This should never happen: end=${sliceEnd}`);
                if (sliceStart >= length) throw new Error(`This should never happen: start=${sliceStart} is greater than or equal to length=${length}`);
                if (sliceEnd > length) throw new Error(`This should never happen: end=${sliceEnd} is greater than length=${length}`);

                if (sliceStart === sliceEnd) {
                    continue;
                }

                let push: Uint8Array | null = null;
                if (typeof bytes === 'function') {
                    if (isTwoParamFunction(bytes)) {
                        push = await bytes(sliceStart, sliceEnd);
                    } else if (isNoParamFunction(bytes)) {
                        push = (await bytes()).slice(sliceStart, sliceEnd);
                    } else {
                        throw new Error('Invalid function type for bytes');
                    }
                } else if (bytes instanceof Uint8Array) {
                    push = bytes.slice(sliceStart, sliceEnd);
                } else if (bytes instanceof File) {
                    push = await readFileChunk(bytes, sliceStart, sliceEnd);
                } else if (bytes instanceof Sliceable) {
                    push = await bytes.slice(sliceStart, sliceEnd);
                } else {
                    throw new Error('Invalid type for bytes');
                }

                if (push.byteLength !== sliceEnd - sliceStart) {
                    console.log('Invalid slice returned:', {sliceStart, sliceEnd, push, bytes});
                    throw new Error(`Invalid slice returned: expected ${sliceEnd - sliceStart} bytes, got ${push.byteLength}`);
                } else {
                    result.push(push);
                }
            }

            currentPosition += length;
            if (currentPosition >= end) break;
        }

        return concatBuffers(result);
    }

    async downloadAsFile(filename: string): Promise<void> {
      await downloadUint8ArrayAsFile(new Uint8Array(await this.slice(0, await this.getByteLength())), filename);
    }

    abstract buildParts(): Promise<SliceParts>;

    async dumpParts(parts: SliceParts): Promise<string> {
      const result = [];
      let currentPosition = 0;
      for (const part of parts) {
        const [length, bytes] = part;
        const partStart = currentPosition;
        const partEnd = currentPosition + length;
        result.push([
          partStart,
          partEnd,
          length,
          bytes
        ]);
        currentPosition += length;
      }
      return result;
    }

    async read(): Promise<Uint8Array> {
      return new Uint8Array(await this.slice(0, await this.getByteLength()));
    }
}

function isTwoParamFunction(func: any): func is (start: number, end: number) => Promise<Uint8Array> {
  return typeof func === 'function' && func.length === 2;
}

function isNoParamFunction(func: any): func is () => Promise<Uint8Array> {
  return typeof func === 'function' && func.length === 0;
}

export abstract class SliceableReader {
  abstract slice(start: number, end: number): Promise<Uint8Array>;
  abstract init(): Promise<void>;
}