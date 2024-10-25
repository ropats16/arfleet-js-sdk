const { getAoInstance } = require("./src/arweave/ao");
const { startChecking } = require("./src/arweave/passes");
const config = require("./src/config");
const utils = require("./src/utils");
const { initWallet } = require("./src/wallet");

async function run() {
    this.wallet = await initWallet();
    console.log(wallet);

    this.address = await this.wallet.getAddress();

        this.ao = getAoInstance({ wallet: this.wallet });

        console.log("Datadir: ", utils.getDatadir());
        
        await utils.outputWalletAddressAndBalance(this.ao, this.address, config.defaultToken, config.defaultTokenDecimals, config.defaultTokenSymbol);

        await startChecking(this.address);
}

run();