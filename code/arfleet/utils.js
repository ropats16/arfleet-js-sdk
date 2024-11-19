import config from './config';
const color = (x, c) => x;

import { sha256 } from '../helpers/hash';
import { bufferToHex, concatBuffers } from '../helpers/buf';

export default {
    hashFn: async function (buf) {
        return await sha256(buf);
    },
    hashFnHex: async function (buf) {
        return bufferToHex(await this.hashFn(buf));
    },
    merkleDerive: async function (values, digestFn, initial_iteration) {
        // This is a modified version of https://www.npmjs.com/package/merkle-lib
        // Modified to defend merkle trees from second preimage attack
        const length = values.length;
        const results = [];

        for (let i = 0; i < length; i += 2) {
            const left = values[i];
            const right = i + 1 === length ? left : values[i + 1];
            const data = initial_iteration
                ? concatBuffers([Buffer.from([0x00]), left, right])
                : concatBuffers([left, right]);

            results.push(await digestFn(data));
        }

        return results;
    },
    merkle: async function (values, digestFn) {
        if (!Array.isArray(values)) throw TypeError('Expected values Array');
        if (typeof digestFn !== 'function') throw TypeError('Expected digest Function');

        // if (values.length === 1) return values.concat() // We don't do this because we would mess up format length

        const levels = [values];
        let level = values;
        let initial_iteration = true;

        do {
            level = await this.merkleDerive(level, digestFn, initial_iteration);
            console.log('level', level);
            levels.push(level);
            initial_iteration = false;
        } while (level.length > 1);

        return [...levels].flat();
    },
    merkleDeriveFull: async function (values, digestFn, initial_iteration) {
        // This is a modified version of https://www.npmjs.com/package/merkle-lib
        // Modified to defend merkle trees from second preimage attack
        const length = values.length;
        const results = [];

        for (let i = 0; i < length; i += 2) {
            const left = values[i];
            const right = i + 1 === length ? left : values[i + 1];
            const data = initial_iteration
                ? concatBuffers([new Uint8Array([0x00]), left.value, right.value])
                : concatBuffers([left.value, right.value]);

            const node = {
                "value": await digestFn(data),
                "left": left,
                "right": right
            }

            results.push(node);
        }

        return results;
    },
    merkleFull: async function (valuesBin, digestFn) {
        if (!Array.isArray(valuesBin)) throw TypeError('Expected values Array');
        if (typeof digestFn !== 'function') throw TypeError('Expected digest Function');

        // if (values.length === 1) return values.concat() // We don't do this because we would mess up format length

        let values = [];
        for (let i = 0; i < valuesBin.length; i++) {
            values.push({ "value": valuesBin[i], "left": null, "right": null });
        }

        const levels = [values];
        let level = values;
        let initial_iteration = true;

        do {
            level = await this.merkleDeriveFull(level, digestFn, initial_iteration);
            // console.log('level', level);
            levels.push(level);
            initial_iteration = false;
        } while (level.length > 1);

        // verify that only one is left
        if (level.length !== 1) {
            throw new Error('Merkle tree is not valid');
        }

        return level[0];
    },
    merkleFullBinToHex: async function (node) {
        return {
            "value": node.value.toString('hex'),
            "left": node.left ? await this.merkleFullBinToHex(node.left) : null,
            "right": node.right ? await this.merkleFullBinToHex(node.right) : null
        }
    },
    printTree: function (tree, level = 0) {
        let result = "";
        for (let i = 0; i < level; i++) {
            result += "  ";
        }
        result += tree.value + "\n";
        if (tree.left) {
            result += this.printTree(tree.left, level + 1);
        } else {
            for (let i = 0; i < level; i++) {
                result += "  ";
            }
            result += "  null\n";
        }
        if (tree.right) {
            result += this.printTree(tree.right, level + 1);
        } else {
            for (let i = 0; i < level; i++) {
                result += "  ";
            }
            result += "  null\n";
        }
        return result;
    },
    normalizeHeaders(headers) {
        const normalized = {};
        for (const key in headers) {
            normalized[key.toLowerCase()] = headers[key];
        }
        return normalized;
    },
    xorBuffersInPlace: function (a, b) {
        var length = Math.min(a.length, b.length);
        for (var i = 0; i < length; ++i) {
            a[i] = a[i] ^ b[i];
        }
        return a;
    },
}