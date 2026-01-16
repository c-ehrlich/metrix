import type { Metric } from "../types";
import type { Collector } from "./index";

export interface WifiInfo {
  ssid: string;
  signalStrength: number;
  interface: string;
}

const AIRPORT_PATH =
  "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport";

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

export async function getWifiInfo(): Promise<WifiInfo | null> {
  let output: string;
  try {
    output = await runCommand(AIRPORT_PATH, ["-I"]);
  } catch {
    return null;
  }

  const lines = output.split("\n");

  let ssid = "";
  let signalStrength: number | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("SSID:")) {
      ssid = trimmed.replace("SSID:", "").trim();
    } else if (trimmed.startsWith("agrCtlRSSI:")) {
      const rssiStr = trimmed.replace("agrCtlRSSI:", "").trim();
      const parsed = parseInt(rssiStr, 10);
      if (!isNaN(parsed)) {
        signalStrength = parsed;
      }
    }
  }

  if (!ssid || signalStrength === null) {
    return null;
  }

  return {
    ssid,
    signalStrength,
    interface: "en0",
  };
}

export const wifiCollector: Collector = {
  name: "wifi",
  async collect(): Promise<Metric[]> {
    try {
      const info = await getWifiInfo();

      if (!info) {
        return [];
      }

      const timestamp = Date.now();

      return [
        {
          name: "system.wifi.signal_strength",
          type: "gauge",
          unit: "dBm",
          description: "RSSI of current Wi-Fi connection",
          dataPoints: [
            {
              timestamp,
              value: info.signalStrength,
              attributes: {
                ssid: info.ssid,
                interface: info.interface,
              },
            },
          ],
        },
      ];
    } catch {
      return [];
    }
  },
};
