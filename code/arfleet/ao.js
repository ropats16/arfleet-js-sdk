import config from './config';

const AOScheduler = config.aoScheduler;

import { connect, createDataItemSigner, result } from "@permaweb/aoconnect";
import axios from 'axios';

const connection = connect(config.aoConfig);

const MAX_ATTEMPTS = 200;
const RETRY_DELAY_MS = 200; // ms delay between retries

class AOClient {
    constructor({ wallet }) {
        this.wallet = wallet;
        this.signer = createDataItemSigner(window.arweaveWallet);
    }

    async getResult(process_id, message, attempt = 0) {
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
                console.log(`Retrying getResult... Attempt ${attempt + 1} of ${MAX_ATTEMPTS}`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                return this.getResult(process_id, message, attempt + 1);
            }
        }
    }

    async sendActionJSON(process_id, action, data, tags = {}, attempt = 0) {
        return await this.sendAction(process_id, action, JSON.stringify(data), tags, attempt);
    }
    
    async sendAction(process_id, action, data, tags = {}, attempt = 0, failOnSignerFail = false) {
        let dontAttempt = false;
        
        try {
            if (!attempt) attempt = 0;
    
            console.log("sendAction", { action, data, tags });

            let t = [
                { name: "Action", value: action },
                { name: "Target", value: process_id }
            ];

            for (let key in tags) {
                t.push({ name: key, value: tags[key] });
            }

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

            if (resdata["Messages"] && resdata["Messages"].length > 0 && resdata["Messages"][0].Data) {
                const result = resdata["Messages"][0].Data;
                return result;
            } else {
                // Try Output.data
                if (resdata.Output && resdata.Output.data) {
                    if (resdata.Output.json && resdata.Output.json !== 'undefined') {
                        return JSON.parse(resdata.Output.json);
                    } else {
                        return resdata.Output.data.output;
                    }
                }
                console.log("Returning null!!!");
                console.log("resdata", resdata);
                return null;
            }

            // return resdata;
        } catch (e) {
            if (dontAttempt) {
                throw e;
            }

            if (attempt > MAX_ATTEMPTS) {
                throw e;
            } else {
                console.error(e);
                console.log(`Retrying sendAction... Attempt ${attempt + 1} of ${MAX_ATTEMPTS}`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                return this.sendAction(process_id, action, data, tags, attempt + 1);
            }
        }
    }
    
    async getInbox() {
        const resdata = await this.sendAction("Eval", "Inbox");
        const inbox = resdata.Output.data;
        // return inbox;
        const json = inbox.json;
        console.log({ json });
        return json;
    }

    async spawn(source_lua, tags=[]) {
        const res = await connection.spawn({
            module: config.aosModule,
            scheduler: AOScheduler,
            signer: this.signer,
            tags,
        });
    
        // - source code
        await this.sendAction(res, "Eval", source_lua);

        return res;
    }

    async sendToken(token, to, amount) {
        const res = await this.sendAction(token, "Transfer", "", { Recipient: to, Quantity: amount.toString() }, /* attempt */ 0, /* failOnSignerFail */ true);
        if (res === false) {
            throw new Error("Signing transaction failed");
        }
        return res;
    }

    async getState(process_id) {
        const ret = await this.sendAction(process_id, "GetState", "");
        try {
            return JSON.parse(ret);
        } catch(e) {
            console.error("Error parsing state", e);
            console.error("ret", ret);
            throw e;
        }
    }

    async dryRun(process_id, action, data = "{}", tags = {}, attempt = 0) {
        try {
            if (attempt > MAX_ATTEMPTS) {
                throw new Error("Max retry attempts reached for dry run");
            }

            const url = `${config.aoConfig.CU_URL}/dry-run?process-id=${process_id}`;
        
            const tagsToSend = [];
            for (const key in tags) {
                tagsToSend.push({ name: key, value: tags[key] });
            }
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
                Tags: tagsToSend
            };

            const response = await axios.post(url, body, {
                headers: {
                    "accept": "*/*",
                    "accept-language": "en-US,en;q=0.9,ru;q=0.8",
                    "content-type": "application/json",
                    "priority": "u=1, i",
                    "Referrer-Policy": "strict-origin-when-cross-origin"
                }
            });

            const returned = JSON.parse(response.data.Messages[0].Data);
            return returned;
        } catch (e) {
            console.error(`Error in dry run, retrying... Attempt ${attempt + 1} of ${MAX_ATTEMPTS}`, e);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            return this.dryRun(process_id, action, data, tags, attempt + 1);
        }
    }

    async getTokenBalance(token, decimals, recipient) {
        const res = await this.dryRun(token, "Balance", "{}", {
            "Recipient": recipient,
        });

        // if res is a Number
        if (typeof res === 'number') {
            return res / Math.pow(10, decimals);
        } else {
            throw new Error("Invalid response from dryRun");
        }
    }

    async transferPass(address) {
        const res = await this.sendAction(config.passes.address, "Transfer", "{}", {
            "Quantity": "1",
            "Recipient": address,
        });
        return res;
    }

    async getDefaultTokenBalance(address) {
        return await this.getTokenBalance(config.defaultToken, config.defaultTokenDecimals, address);
    }

    async spawnAODB() {
        // public/lua/ArFleetAODB.lua
        const source = await fetch('/lua/ArFleetAODB.lua').then(r => r.text());

        const res = await this.spawn(source);
        console.log('spawned AODB', { res });
        return res;
    }
}

let aoInstance;

function getAoInstance(initialState = null) {
    if(!aoInstance) {
        if (!initialState) throw new Error("AOClient is not initialized with a state");
        aoInstance = new AOClient(initialState);
    }
    
    return aoInstance;
}

export { getAoInstance };