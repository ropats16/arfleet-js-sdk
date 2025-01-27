interface QueueConfig<T> {
  REBOOT_INTERVAL?: number;
  addCandidates?: () => Promise<T[]>;
  processCandidate?: (candidate: T) => Promise<void>;
}

export class BackgroundQueue<T> {
  private queue: T[];
  private running: boolean;
  private readonly addCandidates: () => Promise<T[]>;
  private readonly processCandidate: (candidate: T) => Promise<void>;
  private readonly REBOOT_INTERVAL: number;
  private readonly name: string;

  constructor(
    {
      REBOOT_INTERVAL = 5 * 1000,
      addCandidates = async () => [],
      processCandidate = async () => {},
    }: QueueConfig<T>,
    name = "unnamed-queue",
  ) {
    this.queue = [];
    this.running = false;
    this.addCandidates = addCandidates;
    this.processCandidate = processCandidate;
    this.REBOOT_INTERVAL = REBOOT_INTERVAL;
    this.name = name;
    this.boot();
  }

  private async boot(): Promise<void> {
    console.log(`Starting queue: ${this.name}`);
    this.running = true;
    while (this.running) {
      try {
        // Add new candidates to the queue
        const candidates = await this.addCandidates();
        this.queue.push(...candidates);

        // Process each candidate in the queue
        while (this.queue.length > 0) {
          const candidate = this.queue.shift();
          if (candidate !== undefined) {
            await this.processCandidate(candidate);
          }
        }

        // Wait for the reboot interval before checking the queue again
        await this.sleep(this.REBOOT_INTERVAL);
      } catch (error) {
        console.error(`Error in queue ${this.name}:`, error);
      }
    }
  }

  public add(id: T): void {
    this.queue.push(id);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
