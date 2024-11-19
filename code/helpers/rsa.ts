import { AESEncryptedContainer } from "./aes";
import { Sliceable, SliceParts } from "./sliceable.js";
import init, { Hasher, HashType, RsaEncryptor } from '../../wasm/pkg/wasm_helpers.js';
import { concatBuffers, longTo8ByteArray } from "./buf.js";
import { EncryptedContainer } from "./encryptedContainer.js";
import { PLACEMENT_BLOB_CHUNK_SIZE } from "./placementBlob.js";
import { sha256 } from "./hash.js";

export const RSA_KEY_SIZE = 1024;

const RSA_PADDING = 1;

export const RSA_ENCRYPTED_CHUNK_SIZE = RSA_KEY_SIZE / 8;
export const RSA_UNDERLYING_CHUNK_SIZE = RSA_ENCRYPTED_CHUNK_SIZE - RSA_PADDING;

export const RSA_PLACEMENT_UNDERLYING_CHUNK_SIZE = (PLACEMENT_BLOB_CHUNK_SIZE / RSA_ENCRYPTED_CHUNK_SIZE) * RSA_UNDERLYING_CHUNK_SIZE; // take 1 chunk for header // todo

export const RSA_HEADER_SIZE = RSA_ENCRYPTED_CHUNK_SIZE;

export const RSA_CHUNKS_PER_PLACEMENT_CHUNK = PLACEMENT_BLOB_CHUNK_SIZE / RSA_ENCRYPTED_CHUNK_SIZE;

const log = (...args: any[]) => (false) ? console.log('[RSA]', ...args) : null;

export class RSAContainer extends EncryptedContainer {
  rsaKeyPair: CryptoKeyPair;
  private cachedRsaKey: RsaKey | null = null;
  private isInitialized: boolean = false;
  private worker: Worker | null = null;
  private encryptor: RsaEncryptor | null = null;
  private numChunksCached: number;
  private placementChunkCache: Map<number, Uint8Array> = new Map();

  constructor(rsaKeyPair: CryptoKeyPair, inner: Sliceable, numChunksCached: number) {
    super();
    this.rsaKeyPair = rsaKeyPair;
    this.inner = inner;
    this.numChunksCached = numChunksCached;

    this.underlyingChunkSize = RSA_UNDERLYING_CHUNK_SIZE;
    this.encryptedChunkSize = RSA_ENCRYPTED_CHUNK_SIZE;
    this.log = log;
  }

  async initialize() {
    if (!this.isInitialized) {
      // console.log('Initializing RSA Container');
      await initRsa();
      // console.log('Creating RSA Worker');
      this.worker = new Worker(new URL('../workers/rsaWorker.js', import.meta.url), { type: 'module' });
      // console.log('RSA Worker created:', this.worker);
      this.worker.onerror = (error) => {
        console.error('RSA Worker error:', error);
      };
      // this.encryptor = new RsaEncryptor();
      this.isInitialized = true;
      // console.log('RSA Container initialized');
    }
  }
  
  async getRsaKey(): Promise<RsaKey> {
    await this.initialize();
    if (!this.cachedRsaKey) {
      try {
        this.cachedRsaKey = await keyPairToRsaKey(this.rsaKeyPair);
      } catch (error) {
        console.error('Error getting RSA key:', error);
        throw error;
      }
    }
    return this.cachedRsaKey;
  }

  async encryptPlacementChunk(c: number, start: number, end: number): Promise<Uint8Array> {
    // Check if the entire placement chunk is cached
    if (this.placementChunkCache.has(c)) {
      return this.placementChunkCache.get(c)!.slice(start, end);
    }

    const decryptedOffsetStart = RSA_PLACEMENT_UNDERLYING_CHUNK_SIZE * c;
    const decryptedOffsetEnd = decryptedOffsetStart + RSA_PLACEMENT_UNDERLYING_CHUNK_SIZE;
    
    const plainTextChunk = await this.inner!.slice(decryptedOffsetStart, decryptedOffsetEnd);
    if (plainTextChunk.byteLength !== RSA_PLACEMENT_UNDERLYING_CHUNK_SIZE) {
      throw new Error(`Plain text chunk must be ${RSA_PLACEMENT_UNDERLYING_CHUNK_SIZE} bytes but was ${plainTextChunk.byteLength}`);
    }

    const rsaChunksPerPlacementChunk = PLACEMENT_BLOB_CHUNK_SIZE / RSA_ENCRYPTED_CHUNK_SIZE;

    const encryptedChunks = [];
    let previousEncryptedChunk: Uint8Array = new Uint8Array(RSA_ENCRYPTED_CHUNK_SIZE).fill(0x00);
    for (let i = 0; i < rsaChunksPerPlacementChunk; i++) {
      const rsaKey = await this.getRsaKey();

      const sliceStart = i * RSA_UNDERLYING_CHUNK_SIZE;
      const sliceEnd = (i === rsaChunksPerPlacementChunk - 1) ? plainTextChunk.byteLength : sliceStart + RSA_UNDERLYING_CHUNK_SIZE;

      const paddedChunk = padRight(plainTextChunk.slice(sliceStart, sliceEnd), RSA_UNDERLYING_CHUNK_SIZE);
      const fullyPaddedChunk = padLeft(paddedChunk, RSA_ENCRYPTED_CHUNK_SIZE);

      let xoredChunk = fullyPaddedChunk;
      // Note: starting with 1! we don't touch the first 0x00 byte
      for(let j = 1; j < RSA_UNDERLYING_CHUNK_SIZE; j++) {
        xoredChunk[j] = fullyPaddedChunk[j] ^ previousEncryptedChunk[j];
      }

      if (xoredChunk.slice(1).byteLength > RSA_UNDERLYING_CHUNK_SIZE) {
        throw new Error(`Chunk size (${xoredChunk.slice(1).byteLength}) exceeds RSA_UNDERLYING_CHUNK_SIZE (${RSA_UNDERLYING_CHUNK_SIZE})`);
      }

      // if (!this.encryptor) {
      //   throw new Error('RSA encryptor not initialized');
      // }

      // const encryptedChunk = await rsaEncrypt(xoredChunk.slice(1), rsaKey, this.encryptor); // sending without the 0x00 byte at the start, rsaEncrypt needs keysize-padding
      const encryptedChunk = await rsaEncrypt(xoredChunk.slice(1), rsaKey, this.workerEncrypt.bind(this));

      if (encryptedChunk.byteLength !== RSA_ENCRYPTED_CHUNK_SIZE) {
        throw new Error(`Encrypted chunk must be ${RSA_ENCRYPTED_CHUNK_SIZE} bytes but was ${encryptedChunk.byteLength}`);
      }

      encryptedChunks.push(encryptedChunk);

      previousEncryptedChunk = encryptedChunk;
    }

    const together = concatBuffers(encryptedChunks);

    if (together.byteLength !== PLACEMENT_BLOB_CHUNK_SIZE) {
      throw new Error(`Together must be ${PLACEMENT_BLOB_CHUNK_SIZE} bytes but was ${together.byteLength}`);
    }

    // Cache the entire encrypted placement chunk
    this.placementChunkCache.set(c, together);

    // Manage cache size more aggressively
    while (this.placementChunkCache.size > this.numChunksCached) {
      const oldestKey = this.placementChunkCache.keys().next().value;
      this.placementChunkCache.delete(oldestKey);
    }

    return together.slice(start, end);
  }

  async buildParts(): Promise<SliceParts> {
    const parts: SliceParts = [];

    let encryptedLengthLeft = await this.getEncryptedByteLength();
    // let decryptedLengthLeft = await this.inner!.getByteLength();

    // let break_out = false;
    let c = 0;
    while(encryptedLengthLeft > 0) {
      let encryptedPlacementLen = PLACEMENT_BLOB_CHUNK_SIZE;
      parts.push([encryptedPlacementLen, this.encryptPlacementChunk.bind(this, c)]);

      c++;
      encryptedLengthLeft -= encryptedPlacementLen;

      if (encryptedLengthLeft <= 0) {
        break;
      }
    }

    return parts;
  }

  // async encryptChunk(chunkIdx: number): Promise<Uint8Array> {
  //   this.log('encryptChunk', chunkIdx, this.rsaKeyPair)

  //   await this.initialize();
  //   if (this.chunkCache.has(chunkIdx)) {
  //     return this.chunkCache.get(chunkIdx)!.encryptedChunk;
  //   }

  //   const [chunkUnderlyingStart, chunkUnderlyingEnd, isLastChunk] = await this.getChunkUnderlyingBoundaries(chunkIdx);
    
  //   this.log("inner byte length", await this.inner!.getByteLength());
  //   this.log("chunkIdx", chunkIdx, "/", this.chunkCount);
  //   this.log("RSA: getting inner slice", chunkUnderlyingStart, chunkUnderlyingEnd);
  //   this.log("RSA: inner length", await this.inner!.getByteLength());

  //   const chunk = await this.inner!.slice(chunkUnderlyingStart, chunkUnderlyingEnd);

  //   // this.log("RSA plaintext chunk", new TextDecoder().decode(chunk));
  //   this.log('RSA underlyingChunkStart', chunkUnderlyingStart)
  //   this.log('RSA underlyingChunkEnd', chunkUnderlyingEnd)

  //   const rsaKey = await this.getRsaKey();
  //   const encryptedChunk = await this.workerEncrypt(chunk, rsaKey);

  //   this.chunkCache.set(chunkIdx, { plainChunk: chunk, encryptedChunk: encryptedChunk });

  //   // Keep only the last N chunks in the cache
  //   const maxCacheSize = this.numChunksCached;
  //   const keysToKeep = Array.from({ length: maxCacheSize }, (_, i) => chunkIdx - i).filter(k => k >= 0);
  //   for (const key of this.chunkCache.keys()) {
  //     if (!keysToKeep.includes(key)) {
  //       this.chunkCache.delete(key);
  //     }
  //   }

  //   this.log('encrypted chunk', encryptedChunk)

  //   return encryptedChunk;
  // }

  private workerEncrypt(data: Uint8Array, key: RsaKey): Promise<Uint8Array> {
    // console.log('workerEncrypt', data, key);
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        console.error('Worker not initialized');
        reject(new Error('Worker not initialized'));
        return;
      }

      const messageHandler = (event: MessageEvent) => {
        if (event.data.action === 'encrypt') {
          this.worker!.removeEventListener('message', messageHandler);
          if (event.data.error) {
            reject(new Error(event.data.error));
          } else {
            resolve(event.data.result);
          }
        }
      };

      // console.log('adding message handler', this.worker);
      this.worker.addEventListener('message', messageHandler);
      // console.log('posting message');
      this.worker.postMessage({ action: 'encrypt', data, key });
    });
  }

  // Add a method to terminate the worker when it's no longer needed
  public terminateWorker() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

export async function generateRSAKeyPair() {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 1024,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"]
    );
    return keyPair;
}

export async function experiment() {
    console.log('experiment2')
    const keyPair = await generateRSAKeyPair();
    console.log('keyPair', keyPair)
    const publicKey = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
    const privateKey = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
    console.log({
        publicKey: new Uint8Array(publicKey),
        privateKey: new Uint8Array(privateKey)
    });
}

// Type definition for our RSA key
interface RsaKey {
  n: Uint8Array;  // modulus
  e: Uint8Array;  // public exponent
  d: Uint8Array;  // private exponent
  bits: number;   // key size in bits
}

export async function initRsa() {
  await init();
}

export async function keyPairToRsaKey(keyPair: CryptoKeyPair): Promise<RsaKey> {
  try {
    const publicKey = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const privateKey = await window.crypto.subtle.exportKey("jwk", keyPair.privateKey);

    // console.log('Public Key:', publicKey);
    // console.log('Private Key:', privateKey);

    if (!publicKey.n || !publicKey.e || !privateKey.d) {
      throw new Error('Missing required key components');
    }

    return {
      n: base64UrlToBuffer(publicKey.n),
      e: base64UrlToBuffer(publicKey.e),
      d: base64UrlToBuffer(privateKey.d),
      bits: base64UrlToBuffer(publicKey.n).length * 8
    };
  } catch (error) {
    console.error('Error in keyPairToRsaKey:', error);
    throw error;
  }
}

function base64UrlToBuffer(base64url: string): Uint8Array {
  if (typeof base64url !== 'string') {
    console.error('Invalid input to base64UrlToBuffer:', base64url);
    throw new Error('Invalid base64url string');
  }
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }
  return buffer;
}

export async function generateRsaKey(bits: number, exponent: number = 65537): Promise<RsaKey> {
  if (exponent !== 3 && exponent !== 65537) {
      throw new Error("Public exponent must be either 3 or 65537");
  }

  const keyPair = await window.crypto.subtle.generateKey(
      {
          name: "RSA-OAEP",
          modulusLength: bits,
          publicExponent: new Uint8Array(exponent === 3 ? [3] : [1, 0, 1]),
          hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"]
  );

  return keyPairToRsaKey(keyPair);
}

export async function rsaEncrypt(data: Uint8Array, key: RsaKey, workerEncrypt: (data: Uint8Array, key: RsaKey) => Promise<Uint8Array>): Promise<Uint8Array> {
  const maxSize = key.bits / 8 - RSA_PADDING;
  if (data.length > maxSize) {
    throw new Error(`Data is too long: ${data.length} bytes, maximum is ${maxSize} bytes`);
  }

  if (data.byteLength !== maxSize) {
    throw new Error(`Data is not the correct length: ${data.byteLength} bytes, expected ${maxSize} bytes`);
  }
  const paddedData = padLeft(data, key.bits / 8);

  log(`RSA Encrypting data (${paddedData.length} bytes): ${bufferToHex(paddedData)}`);
  const encrypted = new Uint8Array(await workerEncrypt(paddedData, key));
  log(`RSA Encrypted result (${encrypted.length} bytes): ${bufferToHex(encrypted)}`);
  return encrypted;
}

export async function rsaDecrypt(data: Uint8Array, key: RsaKey): Promise<Uint8Array> {
  if (!encryptor) {
      throw new Error("RSA not initialized. Call initRsa() first.");
  }
  log(`RSA Decrypting data (${data.length} bytes): ${bufferToHex(data)}`);
  const decrypted = new Uint8Array(encryptor.public_decrypt(data, key.n, key.e));
  log(`RSA Decrypted result (${decrypted.length} bytes): ${bufferToHex(decrypted)}`);
  return decrypted;
}

function padRight(data: Uint8Array, targetLength: number): Uint8Array {
  if (data.length > targetLength) {
    throw new Error("Data is too long: " + data.length + " bytes, target length is " + targetLength + " bytes, and we need -PADDING");
  }
  const padded = new Uint8Array(targetLength);
  padded.set(data, 0);
  return padded;
}

function padLeft(data: Uint8Array, targetLength: number): Uint8Array {
  if (data.length > targetLength) {
    throw new Error("Data is too long: " + data.length + " bytes, target length is " + targetLength + " bytes, and we need -PADDING");
  }
  const padded = new Uint8Array(targetLength);
  padded.set(data, targetLength - data.length);
  return padded;
}

export async function testRsaChunkSize(data: Uint8Array, key: RsaKey): Promise<boolean> {
  try {
      console.log(`\nTesting chunk size: ${data.length}`);
      const encrypted = await rsaEncrypt(data, key);
      const decrypted = await rsaDecrypt(encrypted, key);
      const result = buffersEqual(padRight(data, key.bits / 8 - RSA_PADDING), decrypted);
      console.log(`Test result: ${result ? 'Success' : 'Failure'}`);
      return result;
  } catch (error) {
      console.error("RSA operation failed:", error);
      return false;
  }
}

export async function fuzzRsaChunkSize(keyBits: number, maxChunkSize: number, step: number = 1): Promise<{maxSuccessfulSize: number, error: string | null}> {
  await initRsa();
  const key = await generateRsaKey(keyBits);

  console.log(`Testing RSA chunk sizes for ${keyBits}-bit key:`);

  let maxSuccessfulSize = 0;
  let error: string | null = null;

  for (let size = 1; size <= maxChunkSize; size += step) {
      const testData = generateRandomData(size);
      try {
          const success = await testRsaChunkSize(testData, key);
          if (success) {
              maxSuccessfulSize = size;
          } else {
              error = `Failed at size ${size} without throwing an error`;
              break;
          }
      } catch (err) {
          error = `Error at size ${size}: ${err instanceof Error ? err.message : String(err)}`;
          break;
      }
  }

  return { maxSuccessfulSize, error };
}

// Helper functions

function generateRandomData(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

function buffersEqual(buf1: Uint8Array, buf2: Uint8Array): boolean {
  if (buf1.byteLength != buf2.byteLength) return false;
  for (let i = 0; i < buf1.byteLength; i++) {
      if (buf1[i] != buf2[i]) return false;
  }
  return true;
}

function bufferToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
}

// Example usage
export async function runRsaTest() {
  const keySizes = [1024, 2048, 4096];
  const results = [];

  for (const keySize of keySizes) {
      console.log(`\nTesting ${keySize}-bit RSA key:`);
      const result = await fuzzRsaChunkSize(keySize, keySize / 8);
      results.push({ keySize, ...result });
  }

  console.log("\n--- Final Results ---");
  for (const result of results) {
      console.log(`\n${result.keySize}-bit RSA key:`);
      console.log(`Maximum successful chunk size: ${result.maxSuccessfulSize} bytes`);
      if (result.error) {
          console.log(`Test stopped due to error: ${result.error}`);
      } else {
          console.log(`All tests passed up to ${result.maxSuccessfulSize} bytes`);
      }
  }
}

interface PerformanceResult {
  keySize: number;
  exponent: number;
  encryptionTime: number;
  decryptionTime: number;
  encryptionOps: number;
  decryptionOps: number;
}

export async function fuzzRsaPerformance(
  keySizes: number[] = [1024, 2048, 4096],
  exponents: number[] = [3, 65537],
  testDuration: number = 1000  // Duration in milliseconds
): Promise<PerformanceResult[]> {
  await initRsa();
  const results: PerformanceResult[] = [];

  for (const keySize of keySizes) {
      for (const exponent of exponents) {
          console.log(`Testing ${keySize}-bit RSA key with exponent ${exponent}:`);
          
          try {
              const key = await generateRsaKey(keySize, exponent);
              const testData = generateRandomData(keySize / 8 - 2);  // Maximum size that works

              let encryptionOps = 0;
              let decryptionOps = 0;
              let encryptionTime = 0;
              let decryptionTime = 0;

              // Test encryption
              const encryptStartTime = performance.now();
              while (performance.now() - encryptStartTime < testDuration) {
                  const startOp = performance.now();
                  await rsaEncrypt(testData, key);
                  encryptionTime += performance.now() - startOp;
                  encryptionOps++;
              }

              // Test decryption
              const encrypted = await rsaEncrypt(testData, key);
              const decryptStartTime = performance.now();
              while (performance.now() - decryptStartTime < testDuration) {
                  const startOp = performance.now();
                  await rsaDecrypt(encrypted, key);
                  decryptionTime += performance.now() - startOp;
                  decryptionOps++;
              }

              results.push({
                  keySize,
                  exponent,
                  encryptionTime,
                  decryptionTime,
                  encryptionOps,
                  decryptionOps
              });
          } catch (error) {
              console.error(`Error testing ${keySize}-bit key with exponent ${exponent}:`, error);
          }
      }
  }

  return results;
}

export async function runRsaPerformanceTest() {
  const results = await fuzzRsaPerformance();

  console.log("\n--- Performance Test Results ---");
  for (const result of results) {
      console.log(`\n${result.keySize}-bit RSA key with exponent ${result.exponent}:`);
      console.log(`Encryption: ${result.encryptionOps} ops in ${result.encryptionTime.toFixed(2)}ms (${(result.encryptionOps / result.encryptionTime * 1000).toFixed(2)} ops/s)`);
      console.log(`Decryption: ${result.decryptionOps} ops in ${result.decryptionTime.toFixed(2)}ms (${(result.decryptionOps / result.decryptionTime * 1000).toFixed(2)} ops/s)`);
  }
}

export function rsaPublicKeyToPem(n: Uint8Array, e: Uint8Array): string {
  const rsaPublicKey = {
    modulus: Buffer.from(n).toString('base64'),
    exponent: Buffer.from(e).toString('base64')
  };

  const asn1 = `MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA${rsaPublicKey.modulus}AgMBAAE=`;
  const der = Buffer.from(asn1, "base64");
  const pem = [
    "-----BEGIN PUBLIC KEY-----",
    ...der.toString("base64").match(/.{1,64}/g)!,
    "-----END PUBLIC KEY-----"
  ].join("\n");

  return pem;
}