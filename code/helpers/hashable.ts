import { Sliceable, SlicePart, SliceParts } from "./sliceable";
import { sha256 } from "./hash";


export class Hashable extends Sliceable {
    inner: Sliceable;

    constructor(inner: Sliceable) {
        super();
        this.inner = inner;
    }

    async buildParts(): Promise<SliceParts> {
        return [
            [await this.inner.getByteLength(), this.sliceInner.bind(this)]
        ];
    }

    async sliceInner(start: number, end: number): Promise<Uint8Array> {
        const slice = await this.inner.slice(start, end);

        

        return slice;
    }
}