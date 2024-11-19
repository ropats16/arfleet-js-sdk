import { sha256 } from './hash';
import { concatBuffers } from './buf';

export async function privateHash(data: Uint8Array, salt: Uint8Array | string): Promise<Uint8Array> {
    const saltBuffer = typeof salt === 'string' ? new TextEncoder().encode(salt) : salt;
    const dataWithSalt = new Uint8Array(saltBuffer.length + data.length);
    dataWithSalt.set(saltBuffer);
    dataWithSalt.set(data, saltBuffer.length);

    // Create the hash using the active wallet
    return await globalThis.arweaveWallet.privateHash(dataWithSalt, { hashAlgorithm: "SHA-256" });
}

export async function arfleetPrivateHash(): Promise<Uint8Array> {
    // data is empty
    const data = new Uint8Array([]);
    const salt = "ArFleet-Proto-v1";
    return await privateHash(data, salt);
}

export const createSalt = (bytes: number = 32): Uint8Array => {
    return crypto.getRandomValues(new Uint8Array(bytes));
}

export const encKeyFromMasterKeyAndSalt = async(masterKey: Uint8Array, salt: Uint8Array): Promise<Uint8Array> => {
    return await sha256(await sha256(concatBuffers([masterKey, salt])));
}
