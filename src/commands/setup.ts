import { mkdir } from "fs/promises";
import { dirname } from "path";
import { defaultConfig, getConfigPath, type MetrixConfig } from "../config";

const NEWLINE = 10;

async function prompt(question: string, defaultValue?: string): Promise<string> {
  const suffix = defaultValue ? ` (${defaultValue})` : "";
  process.stdout.write(`${question}${suffix}: `);

  const reader = Bun.stdin.stream().getReader();
  const chunks: Uint8Array[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      for (let i = 0; i < value.length; i++) {
        if (value[i] === NEWLINE) {
          const decoder = new TextDecoder();
          const input = decoder.decode(Buffer.concat(chunks)).trim();
          return input || defaultValue || "";
        }
        chunks.push(value.slice(i, i + 1));
      }
    }

    const decoder = new TextDecoder();
    const input = decoder.decode(Buffer.concat(chunks)).trim();
    return input || defaultValue || "";
  } finally {
    reader.releaseLock();
  }
}

function parseInterval(input: string): number | null {
  const parsed = Number.parseInt(input, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function validateUrl(input: string): boolean {
  try {
    new URL(input);
    return true;
  } catch {
    return false;
  }
}

function parseHeaders(input: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!input.trim()) {
    return headers;
  }

  const pairs = input.split(",").map((s) => s.trim());
  for (const pair of pairs) {
    const eqIndex = pair.indexOf("=");
    if (eqIndex === -1) continue;
    const key = pair.slice(0, eqIndex).trim();
    const value = pair.slice(eqIndex + 1).trim();
    if (key && value) {
      headers[key] = value;
    }
  }
  return headers;
}

export async function setupCommand(): Promise<void> {
  console.log("Metrix Setup");
  console.log("─".repeat(40));
  console.log("This will configure your OTLP export settings.\n");

  const endpoint = await prompt("OTLP endpoint URL", defaultConfig.otlp.endpoint);
  if (!validateUrl(endpoint)) {
    console.error("Invalid URL. Please run setup again with a valid endpoint.");
    process.exit(1);
  }

  console.log("\nEnter headers as comma-separated key=value pairs.");
  console.log("Example: Authorization=Bearer token123, X-Axiom-Dataset=metrics");
  const headersInput = await prompt("Headers", "");
  const headers = parseHeaders(headersInput);

  const intervalInput = await prompt(
    "\nCollection interval (seconds)",
    String(defaultConfig.interval),
  );
  const interval = parseInterval(intervalInput);
  if (interval === null) {
    console.error("Invalid interval. Please enter a positive integer.");
    process.exit(1);
  }

  const config: MetrixConfig = {
    interval,
    otlp: {
      endpoint,
      headers,
    },
    metrics: { ...defaultConfig.metrics },
  };

  const configPath = getConfigPath();
  const configDir = dirname(configPath);

  try {
    await mkdir(configDir, { recursive: true });
    const configJson = JSON.stringify(config, null, 2);
    await Bun.write(configPath, configJson);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to write config: ${message}`);
    process.exit(1);
  }

  console.log("\n" + "─".repeat(40));
  console.log(`Configuration saved to ${configPath}`);
  console.log("\nTo start collecting metrics, run: metrix");
  console.log("To run in dry-run mode first: metrix --dry-run");
}
