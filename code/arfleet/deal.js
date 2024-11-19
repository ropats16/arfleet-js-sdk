// const config = require('./config');
import config from './config';

export const createAndSpawnDeal = async (ao, placement, merkle_root_hex, arpId, assignment) => {
    const dealDuration = 1 * 365 * 24 * 60 * 60; // todo

    // // available, contact about the placement
    // const placementResult = await pApi.cmd('placement', {
    //     placement_id: placement.id,
    //     size: assignment.size,
    //     chunks: assignment.chunk_count,
    //     required_reward: placement.required_reward,
    //     required_collateral: placement.required_collateral,
    //     provider_id: placement.provider_id
    // });

    // create process
    const createdAtTimestamp = Math.floor(placement.createdAt / 1000);
    const lua_lines = [
        "State.Provider = '" + placement.providerId + "'",
        "State.MerkleRoot = '" + merkle_root_hex + "'",
        "State.ArpRoot = '" + arpId + "'",
        "State.Client = '" + assignment.walletAddress + "'",
        "State.Token = '" + config.defaultToken + "'",
        "State.RequiredReward = " + placement.requiredReward + "",
        "State.ReceivedReward = 0",
        "State.RequiredCollateral = " + placement.requiredCollateral + "",
        "State.ReceivedCollateral = 0",
        "State.VerificationEveryPeriod = 10000", // todo
        "State.VerificationResponsePeriod = 10000", // todo
        "State.CreatedAt = " + createdAtTimestamp + "",
        "State.ExpiresAt = " + (createdAtTimestamp + dealDuration) + "",
        "State.Status = StatusEnum.Created",
    ];
    const process_id = await spawnDeal(lua_lines.join("\n"), ao);
    console.log('Process ID: ', process_id);

    console.log(await ao().sendAction(process_id, "Eval", "State"));

    return process_id;
};

const loadLuaSourceFile = async (filename) => {
    // const thisScriptPath = __dirname;
    // return fs.readFileSync(nodepath.join(thisScriptPath, '..', '..', '..', 'lua', filename), 'utf-8');

    // download from /lua/
    const response = await fetch('/lua/' + filename);
    const text = await response.text();
    return text;
}

const spawnDeal = async (extra_lines, ao) => {
    const sources = [
        await loadLuaSourceFile('libs/hex.lua'),
        await loadLuaSourceFile('libs/sha256.lua'),
        await loadLuaSourceFile('libs/base64.lua'),
        await loadLuaSourceFile('ArFleetDeal.lua'),
    ];
    console.log({ sources });

    const sources_concat = sources.join('\n\n');

    // console.log({ao});

    const process_id = await ao().spawn(sources_concat, [{ name: "Name", value: "arfleet-deal" }]); // todo 3: why not working in explorer?

    await ao().sendAction(process_id, "Eval", extra_lines);

    return process_id;
}

export const sendCollateral = async (process_id, collateral, ao) => {
    await ao().sendAction(process_id, "SendCollateral", collateral);
}

export const fundDeal = async (ao, placement) => {
    await ao().sendToken(config.defaultToken, placement.processId, placement.requiredReward);
}