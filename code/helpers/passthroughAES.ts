import { AESEncryptedContainer } from "./aes";
import { Sliceable, SliceParts } from "./sliceable";

export class PassthroughAES extends AESEncryptedContainer {
    inner: Sliceable;
    constructor(inner: Sliceable, salt: Uint8Array, secretKey: Uint8Array, iv: Uint8Array) {
        super(inner, salt, secretKey, iv);
        this.inner = inner;
    }

    async buildParts(): Promise<SliceParts> {
        return [
            [await this.inner.getByteLength(), this.inner.slice.bind(this.inner)]
        ];
    }
}