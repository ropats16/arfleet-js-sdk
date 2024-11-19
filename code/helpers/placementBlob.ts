import { Sliceable, SliceParts } from "./sliceable";

export const PLACEMENT_BLOB_CHUNK_SIZE = 8192;

export class PlacementBlob extends Sliceable {
    inner: Sliceable;
    constructor(inner: Sliceable) {
        super();
        this.inner = inner;
    }

    async buildParts(): Promise<SliceParts> {
        // console.log('PLACEMENT BLOB INNER SIZE', await this.inner.getByteLength());

        return [
            [await this.inner.getByteLength(), this.inner.slice.bind(this.inner)]
        ];
    }

    async getChunkCount() {
        return Math.ceil(await this.inner.getByteLength() / PLACEMENT_BLOB_CHUNK_SIZE);
    }
}