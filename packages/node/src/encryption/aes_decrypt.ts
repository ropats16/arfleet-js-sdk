#!/bin/env

import * as fs from "fs";
import * as crypto from "crypto";
import { hashFnHex } from "../utils/index.js";
import { defaultConfig as config } from "../arfleet/config.js";

// @TODO: add aes_encryption to config
// @ts-ignore
const KEY = Buffer.from(config.aes_encryption.key, "hex");

interface DecryptMessage {
  command: "decrypt";
  fileIn: string;
  fileOut: string;
  chunkId: string;
}

interface DecryptResponse {
  command: "decrypt";
  success: boolean;
  chunkId: string;
  hashIn: string;
  hashOut: string;
}

export function decryptFile(fileIn: string, fileOut: string): void {
  const readStream = fs.createReadStream(fileIn);
  const writeStream = fs.createWriteStream(fileOut);

  const decipher = crypto.createDecipheriv("aes256", KEY, null);

  readStream.pipe(decipher).pipe(writeStream);
}

process.on("message", async (message: DecryptMessage) => {
  if (message.command === "decrypt") {
    const { fileIn, fileOut, chunkId } = message;

    try {
      decryptFile(fileIn, fileOut);
    } catch (e) {
      console.log("Error", e);
      throw e;
    }

    const response: DecryptResponse = {
      command: "decrypt",
      success: true,
      chunkId,
      hashIn: hashFnHex(fs.readFileSync(fileIn)),
      hashOut: hashFnHex(fs.readFileSync(fileOut)),
    };
    if (process.send) {
      process.send(response);
    }
  }
});
