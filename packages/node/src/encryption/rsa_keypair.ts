import { defaultConfig as config } from "../arfleet/config.js";
import * as crypto from "crypto";

interface KeyPair {
  public_key: string;
  private_key: string;
}

export const generateKeyPair = async (): Promise<KeyPair> => {
  return new Promise((resolve, reject) => {
    crypto.generateKeyPair(
      "rsa",
      {
        modulusLength: config.rsa_encryption.bits,
        // publicExponent: PUBEXP, // todo: supposedly 3 makes it faster for decryption than encryption
        publicKeyEncoding: {
          type: "spki",
          format: "pem",
        },
        privateKeyEncoding: {
          type: "pkcs8",
          format: "pem",
          // cipher: 'aes-256-cbc',
          // passphrase: 'top secret'
        },
      },
      // not sure if async is needed here
      (err, publicKey, privateKey) => {
        if (err) {
          reject("Error: " + err);
        } else {
          resolve({ public_key: publicKey, private_key: privateKey });
        }
      },
    );
  });
};
