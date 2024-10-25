const getClientInstance = require("./src/client");

async function run() {
    const client1 = await getClientInstance();
    // add a 2 second delay
    await new Promise(resolve => setTimeout(resolve, 10000));
    console.log(client1);
}


run();