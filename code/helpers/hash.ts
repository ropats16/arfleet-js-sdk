import init, { Hasher, HashType, RsaEncryptor } from '../../wasm/pkg/wasm_helpers.js';
import { encryptAes } from './aes.js';
import { bufferToHex, hexToBuffer, stringToBuffer } from './buf.js';

export { Hasher, HashType };

export async function makeHasher(hashType: HashType): Promise<Hasher> {
  await init();
  return new Hasher(hashType);
}

export async function sha256(data: Uint8Array): Promise<Uint8Array> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hashBuffer);
}

export async function sha384(data: Uint8Array): Promise<Uint8Array> {
    const hashBuffer = await crypto.subtle.digest('SHA-384', data);
    return new Uint8Array(hashBuffer);
}

export async function sha256hex(data: Uint8Array|string): Promise<string> {
    let dataToHash: Uint8Array;
    if (typeof data === 'string') {
        dataToHash = stringToBuffer(data);
    } else {
        dataToHash = data;
    }
    return bufferToHex(await sha256(dataToHash));
}

export async function sha384hex(data: Uint8Array|string): Promise<string> {
    let dataToHash: Uint8Array;
    if (typeof data === 'string') {
        dataToHash = stringToBuffer(data);
    } else {
        dataToHash = data;
    }
    return bufferToHex(await sha384(dataToHash));
}

export async function run() {
    // for(let i=0; i<515; i+=1) {
    //     const dataToAes = new Uint8Array(i).fill(1);
    //     const key = new Uint8Array([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32]);
    //     const iv = new Uint8Array([1,2,3,4,5,6,7,8,9,10,11,12,13,14,14,15]);
    //     const isLastChunk = false;
    
    //     const secretKey = await crypto.subtle.importKey('raw', key, {
    //         name: 'AES-CBC',
    //         length: 256
    //     }, true, ['encrypt', 'decrypt']);
      
    //     // encrypt the data with the secret key
    //     const ciphertextArrayBuffer = new Uint8Array(await crypto.subtle.encrypt({
    //         name: 'AES-CBC',
    //         iv: iv
    //     }, secretKey, dataToAes));
    //     // console.log('encryptedrun', ciphertextArrayBuffer);

    //     console.log(i, Math.ceil(ciphertextArrayBuffer.length / 16) * 16, ciphertextArrayBuffer.length);
    // }
}