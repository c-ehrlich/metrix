import type { Metric, MetricBatch, ResourceAttributes } from "./types";

export type CollectorFn = () => Promise<Metric[]>;
export type ExporterFn = (batch: MetricBatch) => Promise<void>;

export interface SchedulerOptions {
  intervalSeconds: number;
  resource: ResourceAttributes;
  collect: CollectorFn;
  export: ExporterFn;
}

export interface Scheduler {
  start(): void;
  stop(): Promise<void>;
}

export function createScheduler(options: SchedulerOptions): Scheduler {
  const { intervalSeconds, resource, collect, export: exportFn } = options;

  if (intervalSeconds <= 0) {
    throw new Error("intervalSeconds must be positive");
  }

  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;
  let cycleInProgress = false;
  let currentCycle: Promise<void> | null = null;

  async function runCycle(): Promise<void> {
    if (cycleInProgress || !running) {
      return;
    }
    cycleInProgress = true;

    try {
      const metrics = await collect();
      if (metrics.length > 0) {
        await exportFn({ resource, metrics });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Collection/export cycle failed: ${message}`);
    } finally {
      cycleInProgress = false;
    }
  }

  function start(): void {
    if (running) {
      return;
    }
    running = true;

    currentCycle = runCycle();

    timer = setInterval(() => {
      if (running) {
        currentCycle = runCycle();
      }
    }, intervalSeconds * 1000);
  }

  async function stop(): Promise<void> {
    running = false;

    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }

    if (currentCycle !== null) {
      await currentCycle;
      currentCycle = null;
    }
  }

  return { start, stop };
}

export function setupGracefulShutdown(scheduler: Scheduler): void {
  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    console.log(`\nReceived ${signal}, shutting down...`);
    await scheduler.stop();
    console.log("Shutdown complete");
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}
