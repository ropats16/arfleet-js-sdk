#!/bin/env

import * as fs from "fs";
import * as crypto from "crypto";
import * as path from "path";
import { xorBuffersInPlace, hashFnHex } from "../utils/index.js";
import { defaultConfig as config } from "../arfleet/config.js";

const BITS = config.rsa_encryption.bits;
const STUPID_PADDING = 1;

interface EncryptMessage {
  command: "encrypt";
  filePath: string;
  chunkId: string;
  privKey: string;
  linkId: string;
}

interface EncryptResponse {
  command: "encrypt";
  success: boolean;
  chunkId: string;
  linkId: string;
  hash: string;
}

export function encryptFile(
  filePath: string,
  toFile: string,
  privKey: string,
): void {
  const fromFile = path.resolve(filePath);

  const writeSize = BITS / 8;
  const readSize = writeSize - STUPID_PADDING;

  // todo: check that file exists and it's a file?

  let fd = fs.openSync(fromFile, "r");
  let fe = fs.openSync(toFile, "w+");
  let c = 0;
  let encrypted = Buffer.alloc(readSize); // initial empty buffer for CBC mode
  while (true) {
    let buffer = Buffer.alloc(writeSize);
    let bytesRead = fs.readSync(fd, buffer, STUPID_PADDING, readSize, null);

    // Turning ECB mode into CBC mode

    // Note: We do encrypted.slice to never have the first STUPID_PADDING bytes not 0x00 even after XOR
    let mixIn = Buffer.alloc(readSize);
    encrypted.copy(mixIn, STUPID_PADDING, STUPID_PADDING, readSize);

    buffer = xorBuffersInPlace(buffer, mixIn);

    try {
      encrypted = crypto.privateEncrypt(
        { key: privKey, padding: crypto.constants.RSA_NO_PADDING },
        buffer,
      );
    } catch (e) {
      console.log("crypto.privateEncrypt returned error: " + e);
      console.log(
        "Initial buffer:",
        buffer.length + " bytes:",
        buffer.toString("hex"),
        buffer.toString(),
      );
      console.log({ privKey });
      console.log({ c });
      throw e;
    }

    fs.writeSync(fe, encrypted, 0, encrypted.length);

    if (bytesRead !== readSize) {
      break;
    }

    c++;
  }
  fs.closeSync(fd);
  fs.closeSync(fe);
}

process.on("message", async (message: EncryptMessage) => {
  if (message.command === "encrypt") {
    const { filePath, chunkId, privKey, linkId } = message;

    const suffix = "." + linkId + ".enc";
    const encryptedPath = filePath + suffix;

    encryptFile(filePath, encryptedPath, privKey);

    // send response to master process
    // todo: reading the file AGAIN??? can't you hash it while encrypting?
    const response: EncryptResponse = {
      command: "encrypt",
      success: true,
      chunkId,
      linkId,
      hash: hashFnHex(fs.readFileSync(encryptedPath)),
    };
    if (process.send) {
      process.send(response);
    }
  }
});
