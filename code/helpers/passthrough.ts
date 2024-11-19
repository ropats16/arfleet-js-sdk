import { RSAContainer } from "./rsa";
import { Sliceable, SliceParts } from "./sliceable";

export class Passthrough extends RSAContainer {
    inner: Sliceable;
    constructor(rsa: CryptoKeyPair, inner: Sliceable) {
        super(rsa, inner);
        this.inner = inner;
    }

    async buildParts(): Promise<SliceParts> {
        return [
            [await this.inner.getByteLength(), this.inner.slice.bind(this.inner)]
        ];
    }
}