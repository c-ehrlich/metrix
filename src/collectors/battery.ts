import type { Metric } from "../types";
import type { Collector } from "./index";

export interface BatteryInfo {
  charge: number;
  isCharging: boolean;
  cycleCount: number;
  hasBattery: boolean;
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

export async function getBatteryInfo(): Promise<BatteryInfo> {
  const pmsetOutput = await runCommand("pmset", ["-g", "batt"]);

  const chargeMatch = pmsetOutput.match(/(\d+)%/);
  const hasBattery = pmsetOutput.includes("InternalBattery");

  if (!hasBattery) {
    return {
      charge: 0,
      isCharging: false,
      cycleCount: 0,
      hasBattery: false,
    };
  }

  if (!chargeMatch) {
    throw new Error("Failed to parse battery charge from pmset output");
  }

  const chargePercent = parseInt(chargeMatch[1] ?? "0", 10);
  const charge = chargePercent / 100;

  const isCharging = pmsetOutput.includes("charging") && !pmsetOutput.includes("discharging");

  const ioregOutput = await runCommand("ioreg", ["-l"]);

  const cycleMatch = ioregOutput.match(/"CycleCount"\s*=\s*(\d+)/);
  const cycleCount = cycleMatch ? parseInt(cycleMatch[1] ?? "0", 10) : 0;

  return {
    charge: Math.min(1, Math.max(0, charge)),
    isCharging,
    cycleCount,
    hasBattery: true,
  };
}

export const batteryCollector: Collector = {
  name: "battery",
  async collect(): Promise<Metric[]> {
    const info = await getBatteryInfo();

    if (!info.hasBattery) {
      return [];
    }

    const timestamp = Date.now();

    return [
      {
        name: "system.battery.charge",
        type: "gauge",
        unit: "ratio",
        description: "Current charge level",
        dataPoints: [{ timestamp, value: info.charge }],
      },
      {
        name: "system.battery.charging",
        type: "gauge",
        unit: "boolean",
        description: "Whether plugged in and charging",
        dataPoints: [{ timestamp, value: info.isCharging ? 1 : 0 }],
      },
      {
        name: "system.battery.cycle_count",
        type: "gauge",
        unit: "cycles",
        description: "Battery cycle count",
        dataPoints: [{ timestamp, value: info.cycleCount }],
      },
    ];
  },
};
