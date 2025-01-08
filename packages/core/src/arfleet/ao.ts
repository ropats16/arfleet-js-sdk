import { defaultCoreConfig as config } from "./config.js";
import { connect, createDataItemSigner, result } from "@permaweb/aoconnect";
import axios from "axios";

declare global {
  interface Window {
    arweaveWallet: any;
  }
}

interface Wallet {
  address: string;
}

type Signer = (args: {
  data?: any;
  tags?: { name?: string; value?: string }[];
  target?: string;
  anchor?: string;
}) => Promise<{ id?: string; raw?: any }>;

const AOScheduler = config.aoScheduler;
const connection = connect(config.aoConfig);
const MAX_ATTEMPTS = 5;
const RETRY_DELAY_MS = 1000;

interface ConnectionResponse {
  Messages?: Array<{ Data: any }>;
  Output?: {
    data?: {
      output?: any;
      json?: string;
    };
    json?: string;
  };
}

interface Tags {
  [key: string]: string;
}

export class AOClient {
  private wallet: Wallet;
  private signer: Signer;

  constructor({ wallet }: { wallet: Wallet }) {
    this.wallet = wallet;
    this.signer = createDataItemSigner(window.arweaveWallet);
  }

  async getResult(
    process_id: string,
    message: string,
    attempt: number = 0,
  ): Promise<ConnectionResponse> {
    try {
      if (!attempt) attempt = 0;
      const resdata = await result({
        process: process_id,
        message: message,
      });
      return resdata;
    } catch (e) {
      if (attempt > MAX_ATTEMPTS) {
        throw e;
      } else {
        console.log(
          `Retrying getResult... Attempt ${attempt + 1} of ${MAX_ATTEMPTS}`,
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        return this.getResult(process_id, message, attempt + 1);
      }
    }
  }

  async sendAction(
    process_id: string,
    action: string,
    data: any,
    tags: Tags = {},
    attempt: number = 0,
    failOnSignerFail: boolean = false,
  ): Promise<any> {
    let dontAttempt = false;

    try {
      console.log("sendAction", { action, data, tags });

      const t = [
        { name: "Action", value: action },
        { name: "Target", value: process_id },
      ];

      Object.entries(tags).forEach(([key, value]) => {
        if (value !== undefined) {
          t.push({ name: key, value });
        }
      });

      let res;
      try {
        res = await connection.message({
          process: process_id,
          signer: this.signer,
          tags: t,
          data: data,
        });
      } catch (e) {
        if (failOnSignerFail) {
          dontAttempt = true;
          console.error("Failed to send action", e);
          return false;
        } else {
          throw e;
        }
      }

      const resdata = await this.getResult(process_id, res);
      const messages = resdata.Messages;

      if (messages?.[0]?.Data !== undefined) {
        return messages[0].Data;
      }

      const output = resdata.Output;
      if (output?.data) {
        if (output.json && output.json !== "undefined") {
          return JSON.parse(output.json);
        }
        return output.data.output;
      }

      console.log("Returning null!!!");
      console.log("resdata", resdata);
      return null;
    } catch (e) {
      if (dontAttempt) {
        throw e;
      }

      if (attempt > MAX_ATTEMPTS) {
        throw e;
      }

      console.error(e);
      console.log(
        `Retrying sendAction... Attempt ${attempt + 1} of ${MAX_ATTEMPTS}`,
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return this.sendAction(process_id, action, data, tags, attempt + 1);
    }
  }

  async spawn(
    source_lua: string,
    tags: Array<{ name: string; value: string }> = [],
  ): Promise<string> {
    const res = await connection.spawn({
      module: config.aosModule,
      scheduler: AOScheduler,
      signer: this.signer,
      tags,
    });

    await this.sendAction(res, "Eval", source_lua);
    return res;
  }

  async sendToken(token: string, to: string, amount: number): Promise<any> {
    const res = await this.sendAction(
      token,
      "Transfer",
      "",
      { Recipient: to, Quantity: amount.toString() },
      0,
      true,
    );
    if (res === false) {
      throw new Error("Signing transaction failed");
    }
    return res;
  }
}
