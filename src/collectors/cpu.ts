import type { Metric } from "../types";
import type { Collector } from "./index";

export async function getCpuUtilization(): Promise<number> {
  const proc = Bun.spawn(["top", "-l", "1", "-n", "0", "-stats", "cpu"], {
    stdout: "pipe",
    stderr: "ignore",
  });

  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(`top command failed with exit code ${exitCode}`);
  }

  const cpuMatch = output.match(/CPU usage:\s+([\d.]+)% user,\s+([\d.]+)% sys/);
  if (!cpuMatch || !cpuMatch[1] || !cpuMatch[2]) {
    throw new Error("Failed to parse CPU usage from top output");
  }

  const user = parseFloat(cpuMatch[1]);
  const sys = parseFloat(cpuMatch[2]);
  const total = (user + sys) / 100;

  return Math.min(1, Math.max(0, total));
}

export const cpuCollector: Collector = {
  name: "cpu",
  async collect(): Promise<Metric[]> {
    const utilization = await getCpuUtilization();

    return [
      {
        name: "system.cpu.utilization",
        type: "gauge",
        unit: "ratio",
        description: "CPU usage percentage",
        dataPoints: [
          {
            timestamp: Date.now(),
            value: utilization,
          },
        ],
      },
    ];
  },
};
