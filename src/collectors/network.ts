import type { Metric, DataPoint } from "../types";
import type { Collector } from "./index";

interface NetworkStats {
  device: string;
  ibytes: number;
  obytes: number;
}

export async function getNetworkStats(): Promise<NetworkStats[]> {
  const proc = Bun.spawn(["netstat", "-ib"], {
    stdout: "pipe",
    stderr: "ignore",
  });

  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(`netstat command failed with exit code ${exitCode}`);
  }

  const lines = output.trim().split("\n");
  const stats: NetworkStats[] = [];
  const seenDevices = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const parts = line.split(/\s+/).filter((p) => p.length > 0);
    if (parts.length < 7) continue;

    const name = parts[0];
    if (!name) continue;

    const device = name.replace(/\*$/, "");

    if (!device.match(/^(en|lo|bridge|awdl|llw|utun)\d+$/)) continue;

    const network = parts[2];
    if (!network || !network.startsWith("<Link#")) continue;

    if (seenDevices.has(device)) continue;
    seenDevices.add(device);

    const ibytes = parseInt(parts[parts.length - 5] ?? "0", 10);
    const obytes = parseInt(parts[parts.length - 2] ?? "0", 10);

    if (!isNaN(ibytes) && ibytes >= 0 && !isNaN(obytes) && obytes >= 0) {
      stats.push({ device, ibytes, obytes });
    }
  }

  if (stats.length === 0) {
    throw new Error("No network statistics found");
  }

  return stats;
}

export const networkCollector: Collector = {
  name: "network",
  async collect(): Promise<Metric[]> {
    const stats = await getNetworkStats();
    const timestamp = Date.now();

    const dataPoints: DataPoint[] = [];

    for (const stat of stats) {
      dataPoints.push({
        timestamp,
        value: stat.ibytes,
        attributes: {
          device: stat.device,
          direction: "receive",
        },
      });
      dataPoints.push({
        timestamp,
        value: stat.obytes,
        attributes: {
          device: stat.device,
          direction: "transmit",
        },
      });
    }

    return [
      {
        name: "system.network.io",
        type: "counter",
        unit: "bytes",
        description: "Bytes transmitted/received",
        dataPoints,
      },
    ];
  },
};
