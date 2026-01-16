import type { Metric } from "../types";
import type { Collector } from "./index";

export interface SwapInfo {
  total: number;
  used: number;
  free: number;
}

export async function getSwapInfo(): Promise<SwapInfo> {
  const proc = Bun.spawn(["sysctl", "vm.swapusage"], {
    stdout: "pipe",
    stderr: "ignore",
  });

  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(`sysctl command failed with exit code ${exitCode}`);
  }

  const match = output.match(/total\s*=\s*([\d.]+)M\s+used\s*=\s*([\d.]+)M\s+free\s*=\s*([\d.]+)M/);

  if (!match) {
    throw new Error("Failed to parse swap usage from sysctl output");
  }

  const totalMb = parseFloat(match[1] ?? "0");
  const usedMb = parseFloat(match[2] ?? "0");
  const freeMb = parseFloat(match[3] ?? "0");

  const bytesPerMb = 1024 * 1024;

  return {
    total: totalMb * bytesPerMb,
    used: usedMb * bytesPerMb,
    free: freeMb * bytesPerMb,
  };
}

export const swapCollector: Collector = {
  name: "swap",
  async collect(): Promise<Metric[]> {
    const info = await getSwapInfo();
    const timestamp = Date.now();

    const rawUtilization = info.total > 0 ? info.used / info.total : 0;
    const utilization = Math.min(1, Math.max(0, rawUtilization));

    return [
      {
        name: "system.swap.usage",
        type: "gauge",
        unit: "bytes",
        description: "Swap space used",
        dataPoints: [{ timestamp, value: info.used }],
      },
      {
        name: "system.swap.available",
        type: "gauge",
        unit: "bytes",
        description: "Swap space available",
        dataPoints: [{ timestamp, value: info.free }],
      },
      {
        name: "system.swap.utilization",
        type: "gauge",
        unit: "ratio",
        description: "Swap usage percentage",
        dataPoints: [{ timestamp, value: utilization }],
      },
    ];
  },
};
