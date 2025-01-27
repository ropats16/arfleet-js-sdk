#!/bin/env

import * as fs from "fs";
import * as crypto from "crypto";

interface VerifyMessage {
  command: "verify";
  filePath: string;
  pubKey: string;
  signature: string;
}

export function verifyFile(
  filePath: string,
  pubKey: string,
  signature: string,
): boolean {
  const file = fs.readFileSync(filePath);
  const sigBuffer = Buffer.from(signature, "hex");

  let verified: Buffer;
  try {
    verified = crypto.publicDecrypt(
      {
        key: pubKey,
        padding: crypto.constants.RSA_PKCS1_PADDING,
      },
      sigBuffer,
    );
  } catch (e) {
    console.error(e);
    return false;
  }

  // compare the decrypted signature to file content
  return verified.toString() == file.toString();
}

process.on("message", async (message: VerifyMessage) => {
  if (message.command === "verify") {
    const { filePath, pubKey, signature } = message;

    try {
      const verification = verifyFile(filePath, pubKey, signature);

      // send response to master process
      if (process.send) {
        process.send({ command: "verify", success: verification });
      }
    } catch (e) {
      console.error(e);
      if (process.send) {
        process.send({ command: "verify", success: false });
      }
    }
  }
});
