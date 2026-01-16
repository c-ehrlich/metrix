import type { Metric, DataPoint } from "../types";
import type { Collector } from "./index";

interface DiskIOStats {
  device: string;
  bytesRead: number;
  bytesWritten: number;
  operationsRead: number;
  operationsWrite: number;
}

export async function getDiskIOStats(): Promise<DiskIOStats[]> {
  const proc = Bun.spawn(["ioreg", "-c", "IOBlockStorageDriver", "-r", "-w", "0"], {
    stdout: "pipe",
    stderr: "ignore",
  });

  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(`ioreg command failed with exit code ${exitCode}`);
  }

  const stats: DiskIOStats[] = [];
  const lines = output.trim().split("\n");

  let deviceIndex = 0;

  for (const line of lines) {
    const statisticsMatch = line.match(/"Statistics"\s*=\s*\{([^}]+)\}/);
    if (!statisticsMatch) continue;

    const statsStr = statisticsMatch[1];
    if (!statsStr) continue;

    const bytesReadMatch = statsStr.match(/"Bytes \(Read\)"=(\d+)/);
    const bytesWrittenMatch = statsStr.match(/"Bytes \(Write\)"=(\d+)/);
    const opsReadMatch = statsStr.match(/"Operations \(Read\)"=(\d+)/);
    const opsWriteMatch = statsStr.match(/"Operations \(Write\)"=(\d+)/);

    const bytesRead = bytesReadMatch ? parseInt(bytesReadMatch[1] ?? "0", 10) : 0;
    const bytesWritten = bytesWrittenMatch ? parseInt(bytesWrittenMatch[1] ?? "0", 10) : 0;
    const operationsRead = opsReadMatch ? parseInt(opsReadMatch[1] ?? "0", 10) : 0;
    const operationsWrite = opsWriteMatch ? parseInt(opsWriteMatch[1] ?? "0", 10) : 0;

    if (bytesRead > 0 || bytesWritten > 0 || operationsRead > 0 || operationsWrite > 0) {
      stats.push({
        device: `disk${deviceIndex}`,
        bytesRead,
        bytesWritten,
        operationsRead,
        operationsWrite,
      });
      deviceIndex++;
    }
  }

  if (stats.length === 0) {
    throw new Error("No disk I/O statistics found");
  }

  return stats;
}

export const diskIoCollector: Collector = {
  name: "diskIo",
  async collect(): Promise<Metric[]> {
    const stats = await getDiskIOStats();
    const timestamp = Date.now();

    const ioDataPoints: DataPoint[] = [];
    const operationsDataPoints: DataPoint[] = [];

    for (const stat of stats) {
      ioDataPoints.push({
        timestamp,
        value: stat.bytesRead,
        attributes: {
          device: stat.device,
          direction: "read",
        },
      });
      ioDataPoints.push({
        timestamp,
        value: stat.bytesWritten,
        attributes: {
          device: stat.device,
          direction: "write",
        },
      });

      operationsDataPoints.push({
        timestamp,
        value: stat.operationsRead,
        attributes: {
          device: stat.device,
          direction: "read",
        },
      });
      operationsDataPoints.push({
        timestamp,
        value: stat.operationsWrite,
        attributes: {
          device: stat.device,
          direction: "write",
        },
      });
    }

    return [
      {
        name: "system.disk.io",
        type: "counter",
        unit: "bytes",
        description: "Bytes read/written",
        dataPoints: ioDataPoints,
      },
      {
        name: "system.disk.operations",
        type: "counter",
        unit: "operations",
        description: "Read/write operations",
        dataPoints: operationsDataPoints,
      },
    ];
  },
};
