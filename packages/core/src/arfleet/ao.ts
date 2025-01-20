/* eslint-disable @typescript-eslint/no-explicit-any */
import { defaultCoreConfig as config } from "./config.js";
import { connect, createDataItemSigner, result } from "@permaweb/aoconnect";
import axios from "axios";
import type { AxiosResponse } from "axios";

// TODO: move to @arfleet/node?
// TODO: replace types for 'any'

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
const MAX_ATTEMPTS = 200;
const RETRY_DELAY_MS = 200; // ms delay between retries

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

interface DryRunResponse {
  Messages: Array<{ Data: string }>;
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

  async sendActionJSON(
    process_id: string,
    action: string,
    data: any,
    tags: Tags = {},
    attempt: number = 0,
  ): Promise<any> {
    return await this.sendAction(
      process_id,
      action,
      JSON.stringify(data),
      tags,
      attempt,
    );
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

      console.log({ res });

      const resdata = await this.getResult(process_id, res);
      console.log(resdata);
      const messages = resdata.Messages;
      if (messages && messages.length > 0 && messages[0]?.Data) {
        const result = messages[0]?.Data;
        return result;
      } else {
        const output = resdata.Output;
        if (output && output.data) {
          if (output.json && output.json !== "undefined") {
            return JSON.parse(output.json);
          } else if (output.data && output.data.output) {
            return output.data.output;
          }
        }
        console.log("Returning null!!!");
        console.log("resdata", resdata);
        return null;
      }
    } catch (e) {
      if (dontAttempt) {
        throw e;
      }

      if (attempt > MAX_ATTEMPTS) {
        throw e;
      } else {
        console.error(e);
        console.log(
          `Retrying sendAction... Attempt ${attempt + 1} of ${MAX_ATTEMPTS}`,
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        return this.sendAction(process_id, action, data, tags, attempt + 1);
      }
    }
  }

  async getInbox(): Promise<string> {
    const resdata = await this.sendAction("Eval", "Inbox", "");
    const inbox = resdata.Output?.data;
    if (inbox?.json) {
      console.log({ json: inbox.json });
      return inbox.json;
    }
    throw new Error("Failed to get inbox");
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

  async getState(process_id: string): Promise<any> {
    const ret = await this.sendAction(process_id, "GetState", "");
    try {
      return JSON.parse(ret);
    } catch (e) {
      console.error("Error parsing state", e);
      console.error("ret", ret);
      throw e;
    }
  }

  async dryRun(
    process_id: string,
    action: string,
    data: string = "{}",
    tags: Tags = {},
    attempt: number = 0,
  ): Promise<any> {
    try {
      if (attempt > MAX_ATTEMPTS) {
        throw new Error("Max retry attempts reached for dry run");
      }

      const url = `${config.aoConfig.CU_URL}/dry-run?process-id=${process_id}`;

      const tagsToSend = Object.entries(tags).map(([name, value]) => ({
        name,
        value,
      }));
      tagsToSend.push({ name: "Action", value: action });
      tagsToSend.push({ name: "Data-Protocol", value: "ao" });
      tagsToSend.push({ name: "Type", value: "Message" });
      tagsToSend.push({ name: "Variant", value: "ao.TN.1" });

      const body = {
        Id: "1234",
        Target: process_id,
        Owner: "1234",
        Anchor: "0",
        Data: data,
        Tags: tagsToSend,
      };

      const response: AxiosResponse<DryRunResponse> = await axios.post(
        url,
        body,
        {
          headers: {
            accept: "*/*",
            "accept-language": "en-US,en;q=0.9,ru;q=0.8",
            "content-type": "application/json",
            priority: "u=1, i",
            "Referrer-Policy": "strict-origin-when-cross-origin",
          },
        },
      );

      if (response.data.Messages && response.data.Messages[0]) {
        const returned = JSON.parse(response.data.Messages[0].Data);
        return returned;
      } else {
        throw new Error("Unexpected response from dry run");
      }
    } catch (e) {
      console.error(
        `Error in dry run, retrying... Attempt ${attempt + 1} of ${MAX_ATTEMPTS}`,
        e,
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return this.dryRun(process_id, action, data, tags, attempt + 1);
    }
  }

  async getTokenBalance(
    token: string,
    decimals: number,
    recipient: string,
  ): Promise<number> {
    const res = await this.dryRun(token, "Balance", "{}", {
      Recipient: recipient,
    });

    if (typeof res === "number") {
      return res / Math.pow(10, decimals);
    } else {
      throw new Error("Invalid response from dryRun");
    }
  }

  async transferPass(address: string): Promise<any> {
    const res = await this.sendAction(config.passes.address, "Transfer", "{}", {
      Quantity: "1",
      Recipient: address,
    });
    return res;
  }

  async getDefaultTokenBalance(address: string): Promise<number> {
    return await this.getTokenBalance(
      config.defaultToken,
      config.defaultTokenDecimals,
      address,
    );
  }

  async spawnAODB(): Promise<string> {
    const source = await fetch("/lua/ArFleetAODB.lua").then((r) => r.text());

    const res = await this.spawn(source);
    console.log("spawned AODB", { res });
    return res;
  }
}

let aoInstance: AOClient | null = null;

export function getAoInstance(initialState: { wallet: Wallet } | null = null) {
  if (!aoInstance) {
    if (!initialState)
      throw new Error("AOClient is not initialized with a state");
    aoInstance = new AOClient(initialState);
  }

  return aoInstance;
}
