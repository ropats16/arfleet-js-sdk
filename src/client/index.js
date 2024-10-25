const config = require('../config');
const utils = require('../utils');
const providerAnnouncements = require('./background/providerAnnouncements');
const passes = require('../arweave/passes');
const { getAoInstance } = require('../arweave/ao');
const { color } = require('../utils/color');
const { Assignment, Placement } = require('../db/models');
const { initWallet } = require('../wallet');

let state = {};

class Client {
    constructor({ wallet }) {
        this.wallet = wallet;
        this.start();
    }

    async start() {
        this.address = await this.wallet.getAddress();

        this.ao = getAoInstance({ wallet: this.wallet });

        // console.log("Datadir: ", utils.getDatadir());

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
}

let clientInstance;

async function getClientInstance(initialState = null) {
    if (!initialState.wallet) {
        await initWallet()
    } else {

    }
    if (!clientInstance) {
        if (!initialState) throw new Error("Client is not initialized with a state");
        clientInstance = new Client(initialState);
    }

    return clientInstance;
}



async function getClient() {

    // const wallet = await initWallet();
    // console.log(wallet);
    // client = getClientInstance({ wallet: wallet });
    // console.log("client log main", client);
    // client.getAssignments().then((assignments) => {
    //     // console.log(assignments);
    // })
    //do this in a promise
    // const promise = new Promise((resolve, reject) => {
    //     initWallet().then((wallet) => {
    //         const client = getClientInstance({ wallet: wallet });

    //         resolve(client);
    //     });
    // });

    // // await promise;
    // return promise;

    //resolve and return client
    return new Promise((resolve, reject) => {
        initWallet().then(async (wallet) => {
            if (clientInstance) {
                resolve(clientInstance);
                return;
            }
            clientInstance = getClientInstance({ wallet: wallet });
            while (!clientInstance) {
                // console.log("waiting for client");
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            resolve(clientInstance);
        });
    });
}

module.exports = { getClientInstance, getClient };



// async function test() {
//     const client = await getClient();
//     // console.log("done", (await client.getAssignments()));
// }

// test()

// async function tryClient() {
//     while (!client) {
//         // console.log("waiting for client");
//         await new Promise(resolve => setTimeout(resolve, 1000));
//     }
//     // console.log("client log user", client);
//     client.getAssignments().then((assignments) => {
//         // console.log(assignments);
//     })
// }


// fun().then(tryClient());
// tryClient()