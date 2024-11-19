export class CallbackQueue {
    private queue: [(...args: any[]) => void, (...args: any[]) => void][] = [];

    status: "idle" | "calculating" | "done" = "idle";

    result: any;

    // resolve/reject
    add(callback: [(...args: any[]) => void, (...args: any[]) => void]) {
        this.queue.push(callback);
    }

    done(result: any) {
        this.status = "done";
        this.result = result;
        for (const callback of this.queue) {
            setTimeout(() => {
                callback[0](this.result);
            }, 0);
        }
        return this.result;
    }
}