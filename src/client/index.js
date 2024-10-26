const config = require('../config');
const utils = require('../utils');
const providerAnnouncements = require('./background/providerAnnouncements');
const passes = require('../arweave/passes');
const { getAoInstance } = require('../arweave/ao');
const { color } = require('../utils/color');
const { Assignment, Placement } = require('../db/models');
const { initWallet } = require('../wallet');
const { store } = require('./deployer');

let state = {};

class Client {
    constructor({ wallet }) {
        this.wallet = wallet;
        this.start();
    }

    async start() {
        this.address = await this.wallet.getAddress();

        this.ao = getAoInstance({ wallet: this.wallet });

        console.log("Datadir: ", utils.getDatadir());

        await utils.outputWalletAddressAndBalance(this.ao, this.address, config.defaultToken, config.defaultTokenDecimals, config.defaultTokenSymbol);

        await passes.startChecking(this.address);

        providerAnnouncements.startChecking();

        const { placementChunkQueue } = require('./background/placementChunkQueue');
        placementChunkQueue; // start the queue

        console.log(color("Client started", "green"));
    }

    async getAssignments() {
        const assignments = await Assignment.findAll();
        return assignments;
    }

    async getPlacements(assignmentId) {
        const placements = await Placement.findAll({ where: { assignment_id: assignmentId } });
        return placements;
    }

    async store(filePath, duration) {
        const storeResult = await store(filePath, duration);
        return storeResult;
    }
}

let clientInstance;

async function getClientInstance(initialState = null) {
    let wallet;
    if (!initialState) {
        wallet = await initWallet()
    }

    if (!clientInstance) {
        // if (!initialState) throw new Error("Client is not initialized with a state");
        clientInstance = new Client({wallet: wallet});
    }

    return clientInstance;
}


// getClient was a wrapper around getClientInstance, not needed; use init directly
// async function getClient() {
//     if (!clientInstance) {
//         await initWallet().then(async (wallet) => {
//             clientInstance = await getClientInstance({ wallet: wallet });
//         });
//     }
//     return clientInstance;
// }

// async function init() {
//     const client = await getClientInstance();
//     return client;
// }

module.exports = getClientInstance;

// async function getClient() {

//     //resolve and return client
//     return new Promise((resolve, reject) => {
//         initWallet().then(async (wallet) => {
//             if (clientInstance) {
//                 resolve(clientInstance);
//                 return;
//             }
//             clientInstance = getClientInstance({ wallet: wallet });
//             while (!clientInstance) {
//                 // console.log("waiting for client");
//                 await new Promise(resolve => setTimeout(resolve, 1000));
//             }
//             resolve(clientInstance);
//         });
//     });
// }

// module.exports = { getClientInstance, getClient };