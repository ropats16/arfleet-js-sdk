import { AESEncryptedContainer } from "../helpers/aes";
import { Arp } from "../helpers/arp";
import { hexToBuffer } from "../helpers/buf";
import { CallbackQueue } from "../helpers/callbackQueue";
import { DataItem, DataItemFactory } from "../helpers/dataitemmod";
import { bufferTob64Url } from "../helpers/encodeUtils";
import { Folder } from "../helpers/folder";
import { sha256hex } from "../helpers/hash";
import { PlacementBlob } from "../helpers/placementBlob";
import { RSAContainer } from "../helpers/rsa";
import { SingleThreadedQueue } from "../helpers/singleThreadedQueue";

class WalletSigner {
    signer: Function;
    constructor(signer: Function) {
        this.signer = signer;
    }
}

export class FileMetadata {
    name: string;
    size: number;
    path: string;
    // chunkHashes: string[];
    // rollingSha384: string;
    dataItem: DataItem | null;
    encryptedDataItem: DataItem | null;
    aesContainer: AESEncryptedContainer | null;
    chunkHashes: Record<number, string>;
    arp: Arp | null;
    arpId: string | null;

    constructor(file: File | FileMetadata) {
        this.chunkHashes = {};
        if (file instanceof File) {
            this.name = file.name;
            this.size = file.size;
            this.path = (file as any).path || file.webkitRelativePath || file.name;
            this.chunkHashes = {};
            this.arp = null;
            this.arpId = null;
            this.dataItem = null;
            this.encryptedDataItem = null;
            this.aesContainer = null;
        } else {
            Object.assign(this, file);
        }
    }

    serialize() {
        return {
            name: this.name,
            size: this.size,
            path: this.path,
            chunkHashes: this.chunkHashes,
        };
    }

    static unserialize(data: any): FileMetadata {
        const file = new FileMetadata(new File([], data.name));
        Object.assign(file, data);
        file.chunkHashes = data.chunkHashes || {};
        return file;
    }
}

export class Placement {
    id: string;
    assignmentId: string;
    provider: string;
    providerId: string;
    status: 'created' | 'transferring' | 'spawningDeal' | 'fundingDeal' | 'verifying' | 'accepting' | 'completed' | 'error';
    progress: number;
    rsaKeyPair: CryptoKeyPair | null;
    placementBlob: PlacementBlob | null;
    chunks?: { [chunkIndex: number]: string };
    assignment: StorageAssignment | null;
    rsaContainer: RSAContainer | null;
    createdAt: number;
    requiredReward: number;
    requiredCollateral: number;
    processId: string | null;
    merkleTree: string[];
    merkleRoot: string;

    constructor(data: Partial<Placement>) {
        // initial values
        this.id = '';
        this.assignmentId = '';
        this.provider = '';
        this.providerId = '';
        this.status = 'created';
        this.progress = 0;
        this.rsaKeyPair = null;
        this.placementBlob = null;
        this.assignment = null;
        this.rsaContainer = null;
        this.createdAt = 0;
        this.requiredReward = 0;
        this.requiredCollateral = 0;
        this.processId = null;
        this.merkleTree = [];
        this.merkleRoot = '';
        Object.assign(this, data);
    }

    serialize() {
        return {
            id: this.id,
            assignmentId: this.assignmentId,
            provider: this.provider,
            status: this.status,
            progress: this.progress,
            // chunks: this.chunks,
            createdAt: this.createdAt,
            requiredReward: this.requiredReward,
            requiredCollateral: this.requiredCollateral,
            processId: this.processId,
            // merkleTree: this.merkleTree,
            merkleRoot: this.merkleRoot,
        };
    }

    static unserialize(data: any): Placement {
        return new Placement(data);
    }

    async downloadChunk(chunkHash: string) {
        const response = await fetch(`${this.provider}/download/${chunkHash}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const chunk = new Uint8Array(await response.arrayBuffer());
        // console.log("downloaded chunk", bufferToHex(chunk));

        const realHash = await sha256hex(chunk);
        const realHashB64Url = bufferTob64Url(new Uint8Array(hexToBuffer(realHash)));
        if (realHashB64Url !== chunkHash && realHash !== chunkHash) throw new Error('Chunk hash mismatch');

        return chunk;
    }

    async cmd(cmd: string, data: any, expectJson: boolean = true) {
        const address = this.assignment!.walletAddress;

        const response = await fetch(`${this.provider}/cmd/${cmd}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'arfleet-address': address,
                'arfleet-signature': 'signature', // todo: P4?
            } as HeadersInit,
            body: JSON.stringify(data)
        });

        console.log("cmd", cmd, data, response);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        let result;
        if (expectJson) {
            result = await response.json();
        } else {
            result = await response.text();
        }

        return result;
    }
}

export class StorageAssignment {
    id: string;
    files: FileMetadata[];
    rawFiles: File[];
    status: 'created' | 'chunking' | 'uploading' | 'completed' | 'error' | 'interrupted';
    placements: Placement[];
    progress: number;
    dataItemFactory: DataItemFactory | null;
    folder: Folder | null;
    encryptedManifestArp: string | null;
    walletSigner: WalletSigner | null;
    processQueue: CallbackQueue;
    fundingDealQueue: SingleThreadedQueue;
    walletAddress: string | null;
    createdAt: number;

    constructor(data: Partial<StorageAssignment>) {
        // initial values
        this.id = '';
        this.files = [];
        this.rawFiles = [];
        this.status = 'created';
        this.placements = [];
        this.progress = 0;
        this.dataItemFactory = null;
        this.folder = null;
        this.encryptedManifestArp = data.encryptedManifestArp || null;
        this.walletSigner = null;
        this.walletAddress = null;
        this.processQueue = new CallbackQueue();
        this.fundingDealQueue = new SingleThreadedQueue();
        this.createdAt = Date.now();

        Object.assign(this, data);
        this.files = (this.files || []).map(f => f instanceof FileMetadata ? f : new FileMetadata(f));
        this.placements = (this.placements || []).map(p => p instanceof Placement ? p : new Placement(p));
    }

    serialize() {
        return {
            id: this.id,
            // files: this.files.map(file => file.serialize()),
            status: this.status,
            createdAt: this.createdAt,
            placements: this.placements.map(placement => {
                if (placement instanceof Placement) {
                    return placement.serialize();
                } else {
                    console.error('Invalid placement:', placement);
                    return null;
                }
            }).filter(Boolean),
            encryptedManifestArp: this.encryptedManifestArp,
            progress: this.progress,
        };
    }

    static unserialize(data: any): StorageAssignment {
        return new StorageAssignment({
            ...data,
            // files: data.files.map(FileMetadata.unserialize),
            placements: data.placements.map(Placement.unserialize),
        });
    }

    calculateSummarizedStatus(): string {
        if (this.status === 'completed') return 'completed';
        if (this.status === 'error') return 'error';

        const placementStatuses = this.placements.map(p => p.status);

        if (placementStatuses.every(status => status === 'error')) return 'error';
        if (placementStatuses.some(status => status === 'completed')) return 'partially completed';
        if (this.status === 'created' || this.status === 'chunking' || this.status === 'uploading') return 'interrupted';

        return this.status;
    }
}

class PlacementQueue {
    placementId: string;
    assignmentId: string;
    provider: string;
    processing: boolean;
    placement: Placement;

    finalChunks: [];

    curFileIdx: number;

    constructor(placement: Placement) {
        this.placementId = placement.id;
        this.assignmentId = placement.assignmentId;
        this.provider = placement.provider;
        this.placement = placement;

        this.processing = false;

        this.finalChunks = [];
        this.curFileIdx = 0;
    }

    poke() {
        if (this.processing) return;
        this.processing = true;
        const moreWork = this.processNext(); // todo: try catch here
        if (moreWork) {
            setTimeout(this.poke, 0);
        }
    }

    processNext(): boolean {
        if (this.curFileIdx >= this.placement.assignment.rawFiles.length) {
            // we are done
            // todo: update placement status
            // todo: do path manifests etc
            return false;
        }

        const curFile = this.placement.assignment.files[this.curFileIdx];
        const curRawFile = this.placement.assignment.rawFiles[this.curFileIdx];

        // Let's read the first KB
        const encContainer = curFile.encContainer;
    }
}

class PlacementQueues {
    private queues: { [key: string]: PlacementQueue };

    constructor() {
        this.queues = {};
    }

    pokeAll() {
        for (const queue of Object.values(this.queues)) {
            queue.poke();
        }
    }

    add(placement: Placement) {
        if (this.queues[placement.id]) {
            return;
        }
        this.queues[placement.id] = new PlacementQueue(placement);
    }
}