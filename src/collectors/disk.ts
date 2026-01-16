import type { Metric, DataPoint } from "../types";
import type { Collector } from "./index";

interface DiskStats {
  device: string;
  usage: number;
  available: number;
  utilization: number;
}

export async function getDiskStats(): Promise<DiskStats[]> {
  const proc = Bun.spawn(["df", "-Pk"], {
    stdout: "pipe",
    stderr: "ignore",
  });

  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(`df command failed with exit code ${exitCode}`);
  }

  const lines = output.trim().split("\n");
  if (lines.length < 2) {
    throw new Error("Unexpected df output format");
  }

  const stats: DiskStats[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const parts = line.split(/\s+/);
    if (parts.length < 6) continue;

    const filesystem = parts[0];
    if (!filesystem || !filesystem.startsWith("/dev/disk")) continue;

    const usedKb = parseInt(parts[2] ?? "", 10);
    const availableKb = parseInt(parts[3] ?? "", 10);
    const mountPoint = parts.slice(5).join(" ");

    if (isNaN(usedKb) || isNaN(availableKb)) continue;

    const usage = usedKb * 1024;
    const available = availableKb * 1024;
    const total = usage + available;
    const utilization = total > 0 ? usage / total : 0;

    stats.push({
      device: mountPoint,
      usage,
      available,
      utilization: Math.min(1, Math.max(0, utilization)),
    });
  }

  if (stats.length === 0) {
    throw new Error("No disk statistics found");
  }

  return stats;
}

export const diskCollector: Collector = {
  name: "disk",
  async collect(): Promise<Metric[]> {
    const stats = await getDiskStats();
    const timestamp = Date.now();

    const usagePoints: DataPoint[] = [];
    const availablePoints: DataPoint[] = [];
    const utilizationPoints: DataPoint[] = [];

    for (const stat of stats) {
      usagePoints.push({
        timestamp,
        value: stat.usage,
        attributes: { device: stat.device },
      });
      availablePoints.push({
        timestamp,
        value: stat.available,
        attributes: { device: stat.device },
      });
      utilizationPoints.push({
        timestamp,
        value: stat.utilization,
        attributes: { device: stat.device },
      });
    }

    return [
      {
        name: "system.disk.usage",
        type: "gauge",
        unit: "bytes",
        description: "Disk space used",
        dataPoints: usagePoints,
      },
      {
        name: "system.disk.available",
        type: "gauge",
        unit: "bytes",
        description: "Disk space available",
        dataPoints: availablePoints,
      },
      {
        name: "system.disk.utilization",
        type: "gauge",
        unit: "ratio",
        description: "Disk usage percentage",
        dataPoints: utilizationPoints,
      },
    ];
  },
};
