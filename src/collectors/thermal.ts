import type { Metric } from "../types";
import type { Collector } from "./index";

export interface ThermalInfo {
  state: number;
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

export async function getThermalInfo(): Promise<ThermalInfo> {
  const output = await runCommand("pmset", ["-g", "therm"]);

  let state = 0;

  if (output.includes("CPU_Speed_Limit") && !output.includes("CPU_Speed_Limit	= 100")) {
    const speedMatch = output.match(/CPU_Speed_Limit\s*=\s*(\d+)/);
    if (speedMatch) {
      const speedLimit = parseInt(speedMatch[1] ?? "100", 10);
      if (speedLimit < 50) {
        state = 3;
      } else if (speedLimit < 75) {
        state = 2;
      } else if (speedLimit < 100) {
        state = 1;
      }
    }
  }

  if (output.includes("thermal warning level") || output.includes("performance warning level")) {
    const warningMatch = output.match(/warning level[^\d]*(\d+)/i);
    if (warningMatch) {
      const level = parseInt(warningMatch[1] ?? "0", 10);
      state = Math.max(state, Math.min(level, 3));
    }
  }

  return { state };
}

export const thermalCollector: Collector = {
  name: "thermal",
  async collect(): Promise<Metric[]> {
    try {
      const info = await getThermalInfo();
      const timestamp = Date.now();

      return [
        {
          name: "system.thermal.state",
          type: "gauge",
          unit: "enum",
          description: "Thermal state (0=nominal, 1=fair, 2=serious, 3=critical)",
          dataPoints: [{ timestamp, value: info.state }],
        },
      ];
    } catch {
      return [];
    }
  },
};
