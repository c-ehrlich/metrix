import type { Metric } from "../types";
import type { Collector } from "./index";

export interface FanInfo {
  fans: Array<{
    id: string;
    speed: number;
  }>;
}

async function runCommand(command: string, args: string[]): Promise<string> {
  const proc = Bun.spawn([command, ...args], {
    stdout: "pipe",
    stderr: "ignore",
  });

  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(`${command} command failed with exit code ${exitCode}`);
  }

  return output;
}

export async function getFanInfo(): Promise<FanInfo> {
  const fans: FanInfo["fans"] = [];

  try {
    const output = await runCommand("sudo", [
      "powermetrics",
      "--samplers",
      "smc",
      "-i",
      "1",
      "-n",
      "1",
    ]);

    const fanRegex = /Fan:\s*(\d+)\s*rpm/gi;
    let match;
    let fanIndex = 0;

    while ((match = fanRegex.exec(output)) !== null) {
      const speed = parseInt(match[1] ?? "0", 10);
      fans.push({
        id: `fan${fanIndex}`,
        speed,
      });
      fanIndex++;
    }
  } catch {
    return { fans: [] };
  }

  return { fans };
}

export const fanCollector: Collector = {
  name: "fan",
  async collect(): Promise<Metric[]> {
    try {
      const info = await getFanInfo();
      const timestamp = Date.now();

      if (info.fans.length === 0) {
        return [];
      }

      return [
        {
          name: "system.fan.speed",
          type: "gauge",
          unit: "rpm",
          description: "Fan speed in revolutions per minute",
          dataPoints: info.fans.map((fan) => ({
            timestamp,
            value: fan.speed,
            attributes: { fan: fan.id },
          })),
        },
      ];
    } catch {
      return [];
    }
  },
};
