#!/bin/env

import * as fs from "fs";
import * as crypto from "crypto";
import { hashFnHex } from "../utils/index.js";
import { defaultConfig as config } from "../arfleet/config.js";

// @TODO: add aes_encryption to config
// @ts-ignore
const KEY = Buffer.from(config.aes_encryption.key, "hex");

interface EncryptMessage {
  command: "encrypt";
  filePath: string;
  chunkId: string;
  linkId: string;
}

interface EncryptResponse {
  command: "encrypt";
  success: boolean;
  chunkId: string;
  linkId: string;
  hash: string;
}

export function encryptFile(filePath: string, toFile: string): void {
  const readStream = fs.createReadStream(filePath);
  const writeStream = fs.createWriteStream(toFile);

  // createCipher is deprecated, used createCipheriv instead
  const cipher = crypto.createCipheriv("aes256", KEY, null);

  readStream.pipe(cipher).pipe(writeStream);
}

process.on("message", async (message: EncryptMessage) => {
  if (message.command === "encrypt") {
    const { filePath, chunkId, linkId } = message;

    const suffix = "." + linkId + ".enc";
    const encryptedPath = filePath + suffix;

    encryptFile(filePath, encryptedPath);

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
