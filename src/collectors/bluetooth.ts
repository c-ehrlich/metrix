import type { Metric } from "../types";
import type { Collector } from "./index";

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

export async function getConnectedDeviceCount(): Promise<number> {
  let output: string;
  try {
    output = await runCommand("system_profiler", ["SPBluetoothDataType"]);
  } catch {
    return 0;
  }

  const lines = output.split("\n");
  let inConnectedSection = false;
  let connectedCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "Connected:") {
      inConnectedSection = true;
      continue;
    }

    if (trimmed === "Not Connected:" || trimmed === "Bluetooth Controller:") {
      inConnectedSection = false;
      continue;
    }

    // Device names in the Connected section:
    // - Are at 10-space indentation (not 12+, which are properties)
    // - End with a colon (e.g., "AirPods Pro:", "Magic Keyboard:")
    const isDeviceIndent = line.startsWith("          ") && !line.startsWith("            ");
    if (inConnectedSection && trimmed !== "" && trimmed.endsWith(":") && isDeviceIndent) {
      connectedCount++;
    }
  }

  return connectedCount;
}

export const bluetoothCollector: Collector = {
  name: "bluetooth",
  async collect(): Promise<Metric[]> {
    try {
      const count = await getConnectedDeviceCount();
      const timestamp = Date.now();

      return [
        {
          name: "system.bluetooth.connected_devices",
          type: "gauge",
          unit: "count",
          description: "Number of connected Bluetooth devices",
          dataPoints: [
            {
              timestamp,
              value: count,
              attributes: {},
            },
          ],
        },
      ];
    } catch {
      return [];
    }
  },
};
