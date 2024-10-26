const getClientInstance = require("./src/client");
const { getProvidersToConnect } = require("./src/client/background/providerAnnouncements");

async function run() {
    const client1 = await getClientInstance();
    // add a 2 second delay
    await new Promise(resolve => setTimeout(resolve, 10000));
    console.log(client1);
    const checkProvidersAndStore = async () => {
        const providers = getProvidersToConnect();
        if (providers.length > 0) {
            console.log("Providers found!", providers);
            const store = await client1.store("/Users/rohit/Desktop/BG_Wallpaper.jpeg", 36000);
            console.log("Store result", store);
            return true; // Stop checking
        }
        return false; // Continue checking
    };

    let storeCalled = false;
    while (!storeCalled) {
        storeCalled = await checkProvidersAndStore();
        if (!storeCalled) {
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }
    setInterval(async () => {
        // process.env.DEBUG && console.log(assignments.hash);
        const assignments = await client1.getAssignments();
        console.log(assignments);
    }, 10000);
}

run();