import { defaultCoreConfig as config } from "./config.js";
import { MINUTE } from "./constants.js";
import { getAoInstance } from "./ao.js";

function color(x: string): string {
  return x;
}

let passes: { [key: string]: number } | null = null;

const checkPasses = async (
  firstTime = false,
  ourAddress: string | null = null,
) => {
  console.log("Checking passes...");
  try {
    const passAddress = config.passes.address;

    const ao = getAoInstance();
    const response = await ao.dryRun(passAddress, "Info");

    const passesReturned = response.Balances;

    const passesDestringified = Object.entries(passesReturned).reduce(
      (acc, [key, value]) => ({ ...acc, [key]: Number(value as string) }),
      {},
    );

    const passesFiltered = Object.entries(passesDestringified)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .filter(([_, value]) => (value as number) > 0)
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value as number }), {});

    passes = passesFiltered;

    if (firstTime) {
      console.log(
        Object.keys(passes).length.toString() + " ArFleet:Genesis passes found",
      );
      if (ourAddress) {
        if (hasPass(ourAddress)) {
          console.log(color("✅ You have an ArFleet:Genesis pass! 🎉"));
        } else {
          console.log("");
          console.log(
            color(
              "WARNING: You don't have an ArFleet:Genesis pass to participate in the testnet! 😢",
            ),
          );
          console.log("");
          console.log(
            color(
              "Providers/clients on testnet won't be able to connect to you without a valid pass.",
            ),
          );
          console.log("");
          console.log(
            color(
              "ArFleet:Genesis passes are this asset on Bazar: https://bazar.arweave.dev/#/asset/" +
                config.passes.address +
                "",
            ),
          );
          console.log("");
          console.log(
            color("Send the pass to your address here: " + ourAddress),
          );
        }
      }
    }
  } catch (e) {
    console.error(e);
  }
};

const hasPass = (address: string) => {
  hasPassLive(address);
  return passes && passes[address] && passes[address] > 0;
};

const hasPassLive = async (address: string) => {
  console.log("Checking passes live...");
  const passAddress = config.passes.address;

  const ao = getAoInstance();
  const balance = await ao.dryRun(
    passAddress,
    "Balance",
    JSON.stringify({
      Target: address,
    }),
  );

  if (typeof balance === "number" && balance > 0) {
    return true;
  } else {
    return false;
  }
};

const startChecking = async (ourAddress: string | null = null) => {
  await checkPasses(true, ourAddress);

  setInterval(checkPasses, 5 * MINUTE);
};

const getPasses = () => {
  return passes;
};

export { checkPasses, startChecking, getPasses, hasPass, hasPassLive };
