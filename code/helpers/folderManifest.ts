import { FileMetadata } from "../contexts/ArFleetContext";
import { Arp } from "./arp";
import { bufferToAscii, stringToBuffer } from "./buf";
import { stringToB64Url } from "./encodeUtils";
import { Folder } from "./folder";
import { sha256, sha256hex } from "./hash";
import { Sliceable, SliceParts } from "./sliceable";

export class FolderManifest extends Sliceable {
    private files: FileMetadata[] = [];

    private dryRunCached: Uint8Array | null = null;
    private actualCached: Uint8Array | null = null;

    constructor(files: FileMetadata[]) {
        super();
        this.files = files;
        this.dryRunCached = null;
        this.actualCached = null;
    }

    async buildParts(): Promise<SliceParts> {
        const manifestTemplate = await this.getManifest(true);

        return [
            [manifestTemplate.byteLength, this.sliceManifest.bind(this)],
        ];
    }

    async sliceManifest(start: number, end: number): Promise<Uint8Array> {
        return (await this.getManifest(false)).slice(start, end);
    }

    async getManifest(dryRun: boolean = false): Promise<Uint8Array> {
        if (dryRun && this.dryRunCached) {
            return this.dryRunCached;
        }

        if (!dryRun && this.actualCached) {
            return this.actualCached;
        }

        let paths: any = {};
        for (const file of this.files) {
            paths[file.name] = {
            //    id: dryRun ? stringToB64Url(' '.repeat(32)) : await file.encryptedDataItem!.getDataItemId(),
               id: dryRun ? stringToB64Url(' '.repeat(32)) : await file.dataItem!.getDataItemId(),
               size: file.size,
            //    arp: dryRun ? stringToB64Url(' '.repeat(32)) : await file.arp!.getId()
               arp: dryRun ? await sha256hex('') : await file.arp!.getHexId()
            };
        }

        const root = {
            "manifest": "arweave/paths",
            "version": "0.2.0",
            // "index": {
            //   "path": "index.html"
            // },
            // "fallback": {
            //   "id": "cG7Hdi_iTQPoEYgQJFqJ8NMpN4KoZ-vH_j7pG4iP7NI"
            // },
            "paths": paths
        };

        const manifest = JSON.stringify(root);
        const manifestBuffer = stringToBuffer(manifest);

        if (!dryRun && !this.dryRunCached) {
            throw new Error("Dry run not cached to compare against");
        }

        if (dryRun && this.dryRunCached && manifestBuffer.length !== this.dryRunCached.length) {
            throw new Error("Manifest length mismatch between dry run and actual");
        }

        if (dryRun) {
            this.dryRunCached = manifestBuffer;
        } else {
            this.actualCached = manifestBuffer;
        }

        return manifestBuffer;
    }
}
