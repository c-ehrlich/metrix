import type { Metric } from "../types";
import type { Collector } from "./index";

export interface DisplayInfo {
  brightness: number;
  display: string;
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

interface DisplayBlock {
  name: string;
  brightnessLevel: number;
  brightnessScale: number;
}

function parseDisplayBlocks(output: string): DisplayBlock[] {
  const blocks: DisplayBlock[] = [];
  const lines = output.split("\n");

  let pendingScale = 65536;
  let pendingLevel = -1;

  for (const line of lines) {
    const scaleMatch = line.match(/"Brightness_Scale"\s*=\s*(\d+)/);
    if (scaleMatch) {
      pendingScale = parseInt(scaleMatch[1] ?? "65536", 10);
      continue;
    }

    const levelMatch = line.match(/"IOMFBBrightnessLevel"\s*=\s*(\d+)/);
    if (levelMatch && pendingLevel < 0) {
      pendingLevel = parseInt(levelMatch[1] ?? "0", 10);
      continue;
    }

    const nameMatch = line.match(/"IONameMatched"\s*=\s*"([^"]+)"/);
    if (nameMatch) {
      if (pendingLevel >= 0) {
        blocks.push({
          name: nameMatch[1] ?? "",
          brightnessLevel: pendingLevel,
          brightnessScale: pendingScale,
        });
      }
      pendingScale = 65536;
      pendingLevel = -1;
    }
  }

  return blocks;
}

export async function getDisplayBrightness(): Promise<DisplayInfo[]> {
  const output = await runCommand("ioreg", ["-r", "-c", "IOMobileFramebuffer", "-d", "3"]);

  const blocks = parseDisplayBlocks(output);
  const displays: DisplayInfo[] = [];

  for (const block of blocks) {
    if (block.brightnessLevel < 0 || block.brightnessScale <= 0) {
      continue;
    }

    const maxBrightness = block.brightnessScale * 100;
    const brightness = Math.min(1, Math.max(0, block.brightnessLevel / maxBrightness));

    displays.push({
      brightness,
      display: block.name,
    });
  }

  return displays;
}

export const displayCollector: Collector = {
  name: "display",
  async collect(): Promise<Metric[]> {
    try {
      const displays = await getDisplayBrightness();

      if (displays.length === 0) {
        return [];
      }

      const timestamp = Date.now();

      return [
        {
          name: "system.display.brightness",
          type: "gauge",
          unit: "ratio",
          description: "Screen brightness level",
          dataPoints: displays.map((d) => ({
            timestamp,
            value: d.brightness,
            attributes: { display: d.display },
          })),
        },
      ];
    } catch {
      return [];
    }
  },
};
