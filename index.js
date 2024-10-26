const getClientInstance = require("./src/client");

async function run() {
    const client1 = await getClientInstance();
    // add a 2 second delay
    await new Promise(resolve => setTimeout(resolve, 10000));
    console.log(client1);
    const store = await client1.store("./package.json", 36000);
    console.log("Store result", store);
    // const assignments = await client1.getAssignments();
    // process.env.DEBUG && console.log(assignments.hash);
    const assignment = await client1.getAssignment(store.hash);
    console.log("fetched assignment", assignment);
}

run();