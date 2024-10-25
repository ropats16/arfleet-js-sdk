const { initWallet } = require("./src/wallet");
// const { getAoInstance } = require("./src/arweave/ao");
// const { startChecking } = require("./src/arweave/passes");
// const config = require("./src/config");
// const utils = require("./src/utils");
// const getClientInstance = require("./src/client");
const { getClient } = require("./src/client");

async function run() {
    const client1 = await getClient();
    client1.getAssignments().then(console.log);
    // this.wallet = await initWallet();
    // console.log(wallet);

    // this.address = await this.wallet.getAddress();

    //     this.ao = getAoInstance({ wallet: this.wallet });

    //     // console.log("Datadir: ", utils.getDatadir());

    //     await utils.outputWalletAddressAndBalance(this.ao, this.address, config.defaultToken, config.defaultTokenDecimals, config.defaultTokenSymbol);

    //     await startChecking(this.address);
    // const client = getClientInstance({ wallet: this.wallet });
    // console.log(client)
}


run();

// async function getAssignments() {
//     const assignments = await Assignment.findAll();
//     return assignments;
// }
// console.log("=====================================")

// console.log(getAssignments())