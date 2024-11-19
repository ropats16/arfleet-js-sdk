export class SingleThreadedQueue {
    private queue: (() => Promise<any>)[] = [];
    private isProcessing: boolean = false;

    numProcessed: number = 0;

    async add<T>(operation: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    const result = await operation();
                    this.numProcessed++;
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
            this.processQueue();
        });
    }

    private async processQueue() {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }

        this.isProcessing = true;

        while (this.queue.length > 0) {
            const operation = this.queue.shift();
            if (operation) {
                await operation();
            }
        }

        this.isProcessing = false;
    }
}