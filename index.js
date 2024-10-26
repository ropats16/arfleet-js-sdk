const getClientInstance = require("./src/client");

async function run() {
    const client1 = await getClientInstance();
    // add a 2 second delay
    await new Promise(resolve => setTimeout(resolve, 10000));
    console.log(client1);
    const store = await client1.store("/Users/rohit/Desktop/BG_Wallpaper.jpeg");
    console.log("Store result", store);
    const assignments = await client1.getAssignments();
    console.log(assignments);
}


run();