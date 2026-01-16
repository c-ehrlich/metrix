import { uptime } from "os";
import type { Metric } from "../types";
import type { Collector } from "./index";

export function getUptimeSeconds(): number {
  return Math.floor(uptime());
}

export const uptimeCollector: Collector = {
  name: "uptime",
  async collect(): Promise<Metric[]> {
    const uptimeSeconds = getUptimeSeconds();
    const timestamp = Date.now();

    return [
      {
        name: "system.uptime",
        type: "gauge",
        unit: "s",
        description: "Time since boot",
        dataPoints: [
          {
            timestamp,
            value: uptimeSeconds,
          },
        ],
      },
    ];
  },
};
