export class AODB {
    data: Map<string, string>;
    initialized: boolean;

    constructor() {
        this.data = new Map();
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        this.initialized = true;

        // grab from local storage
        const data = localStorage.getItem("aodb");
        if (data) {
            const parsedData = JSON.parse(data);
            this.data = new Map(Object.entries(parsedData));
        }

        this.logContents();
    }

    has(key: string) {
        if (!this.initialized) throw new Error("AODB not initialized");
        return this.data.has(key);
    }

    get(key: string, defaultValue: any = undefined): any {
        if (!this.initialized) throw new Error("AODB not initialized");
        if (this.data.has(key)) {
            return this.data.get(key);
        }
        return defaultValue;
    }

    async set(key: string, value: any) {
        if (!this.initialized) throw new Error("AODB not initialized");
        this.data.set(key, JSON.stringify(value));
        localStorage.setItem("aodb", JSON.stringify(Object.fromEntries(this.data)));
    }
 
    async reset() {
        this.data.clear();
        localStorage.removeItem("aodb");
        console.log("AODB reset");
    }

    logContents() {
        console.log('AODB contents:');
        for (const [key, value] of this.data) {
            console.log(`${key}: ${value}`);
        }
    }
}