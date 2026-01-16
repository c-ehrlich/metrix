import { loadavg } from "os";
import type { Metric } from "../types";
import type { Collector } from "./index";

export interface LoadAverages {
  "1m": number;
  "5m": number;
  "15m": number;
}

export function getLoadAverages(): LoadAverages {
  const [oneMin, fiveMin, fifteenMin] = loadavg();
  return {
    "1m": oneMin ?? 0,
    "5m": fiveMin ?? 0,
    "15m": fifteenMin ?? 0,
  };
}

export const loadCollector: Collector = {
  name: "load",
  async collect(): Promise<Metric[]> {
    const averages = getLoadAverages();
    const timestamp = Date.now();

    return [
      {
        name: "system.cpu.load_average",
        type: "gauge",
        unit: "1",
        description: "System load average",
        dataPoints: [
          {
            timestamp,
            value: averages["1m"],
            attributes: { period: "1m" },
          },
          {
            timestamp,
            value: averages["5m"],
            attributes: { period: "5m" },
          },
          {
            timestamp,
            value: averages["15m"],
            attributes: { period: "15m" },
          },
        ],
      },
    ];
  },
};
