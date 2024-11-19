import { KB, MB, GB, TB, PB, WINSTON, AR, SECOND, MINUTE, HOUR, DAY, WEEK, MONTH, YEAR } from './constants';

const defaultConfig = {
    marketplace: '-jydy0Gqhtdf2ilVR0zbGrizkx4GJXfcvpJYXzQxwlU',
    aoScheduler: '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA',
    aosModule: '9afQ1PLf2mrshqCTZEzzJTR2gWaC9zNPnYgYEqg1Pt4',
    defaultToken: 'xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10',
    defaultTokenDecimals: 12,
    defaultTokenSymbol: 'wAR',

    aodbProcessId: 'fydB4BNJgmKkKmC00hjw8uyVTZChPJNRhpPzbz2mb0g',

    passes: {
        address: 'kBQOWxXVSj21ZhLqMTFEIJllEal1z_l8YgRRdxIm7pw',
        fetchPassesInterval: 5 * MINUTE,
    },

    aoConfig: {
        MU_URL: "https://mu.ao-testnet.xyz",
        // CU_URL: "https://cu.ao-testnet.xyz",
        CU_URL: "https://cu.ao-testnet.xyz",
        // GATEWAY_URL: "https://arweave.net",
        GATEWAY_URL: "https://arweave-search.goldsky.com",
    },

    rsa_encryption: {
        bits: 1024,
    }
};

export default defaultConfig;
