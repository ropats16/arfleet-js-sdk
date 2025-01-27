#!/bin/env

import * as fs from "fs";
import * as crypto from "crypto";

interface SignMessage {
  command: "sign";
  filePath: string;
  privKey: string;
}

export function signFile(filePath: string, privKey: string): string {
  const file = fs.readFileSync(filePath);
  const fileSignature = crypto.privateEncrypt(
    {
      key: privKey,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    file,
  );

  return fileSignature.toString("hex");
}

process.on("message", async (message: SignMessage) => {
  if (message.command === "sign") {
    const { filePath, privKey } = message;

    try {
      const signature = signFile(filePath, privKey);

      if (process.send) {
        process.send({ command: "sign", success: true, signature });
      }
    } catch (e) {
      console.error(e);
      if (process.send) {
        process.send({ command: "sign", success: false });
      }
    }
  }
});
