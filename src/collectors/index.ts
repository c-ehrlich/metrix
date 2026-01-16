import type { Metric } from "../types";
import type { MetricsToggle } from "../config";
import { cpuCollector } from "./cpu";
import { memoryCollector } from "./memory";
import { diskCollector } from "./disk";
import { networkCollector } from "./network";
import { loadCollector } from "./load";
import { swapCollector } from "./swap";
import { batteryCollector } from "./battery";
import { diskIoCollector } from "./disk-io";
import { uptimeCollector } from "./uptime";
import { thermalCollector } from "./thermal";
import { wifiCollector } from "./wifi";
import { bluetoothCollector } from "./bluetooth";
import { displayCollector } from "./display";

export interface Collector {
  name: keyof MetricsToggle;
  collect(): Promise<Metric[]>;
}

const collectors: Collector[] = [
  cpuCollector,
  memoryCollector,
  diskCollector,
  networkCollector,
  loadCollector,
  swapCollector,
  batteryCollector,
  diskIoCollector,
  uptimeCollector,
  thermalCollector,
  wifiCollector,
  bluetoothCollector,
  displayCollector,
];

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
