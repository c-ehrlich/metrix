import type { Metric } from "../types";
import type { MetricsToggle } from "../config";
import { cpuCollector } from "./cpu";
import { memoryCollector } from "./memory";

export interface Collector {
  name: keyof MetricsToggle;
  collect(): Promise<Metric[]>;
}

const collectors: Collector[] = [cpuCollector, memoryCollector];

export function registerCollector(collector: Collector): void {
  collectors.push(collector);
}

export async function collectAll(enabledMetrics: MetricsToggle): Promise<Metric[]> {
  const results: Metric[] = [];

  const collectPromises = collectors
    .filter((collector) => enabledMetrics[collector.name])
    .map(async (collector) => {
      try {
        return await collector.collect();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Collector ${collector.name} failed: ${message}`);
        return [];
      }
    });

  const collected = await Promise.all(collectPromises);
  for (const metrics of collected) {
    results.push(...metrics);
  }

  return results;
}
