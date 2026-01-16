#!/usr/bin/env bun

import { parseArgs } from "util";
import { type MetrixConfig, loadConfig } from "./config";

const USAGE = `Usage: metrix [options]

Options:
  -i, --interval <seconds>  Collection interval (default: 10)
  -e, --endpoint <url>      OTLP endpoint URL
  -H, --header <key=value>  Add header (can be repeated)
  -c, --config <path>       Path to config file
  -d, --dry-run             Print metrics to stdout instead of exporting
  -h, --help                Show this help message
`;

interface ParsedArgs {
  interval?: number;
  endpoint?: string;
  headers: Record<string, string>;
  configPath?: string;
  dryRun: boolean;
}

const cliOptions = {
  interval: { type: "string" as const, short: "i" as const },
  endpoint: { type: "string" as const, short: "e" as const },
  header: { type: "string" as const, multiple: true as const, short: "H" as const },
  config: { type: "string" as const, short: "c" as const },
  "dry-run": { type: "boolean" as const, short: "d" as const },
  help: { type: "boolean" as const, short: "h" as const },
};

function parseCliArgs(): ParsedArgs {
  let values: ReturnType<typeof parseArgs<{ options: typeof cliOptions }>>["values"];

  try {
    const result = parseArgs({
      args: Bun.argv.slice(2),
      options: cliOptions,
      strict: true,
      allowPositionals: false,
    });
    values = result.values;
  } catch {
    console.error(USAGE);
    process.exit(1);
  }

  if (values.help) {
    console.log(USAGE);
    process.exit(0);
  }

  const headers: Record<string, string> = {};
  if (values.header) {
    for (const h of values.header) {
      const eqIndex = h.indexOf("=");
      if (eqIndex === -1) {
        console.error(`Invalid header format: "${h}". Expected "Key=Value".`);
        process.exit(1);
      }
      const key = h.slice(0, eqIndex);
      const value = h.slice(eqIndex + 1);
      headers[key] = value;
    }
  }

  let interval: number | undefined;
  if (values.interval !== undefined) {
    const parsed = Number.parseInt(values.interval, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      console.error(`Invalid interval: "${values.interval}". Must be a positive integer.`);
      process.exit(1);
    }
    interval = parsed;
  }

  if (values.endpoint !== undefined) {
    try {
      new URL(values.endpoint);
    } catch {
      console.error(`Invalid endpoint URL: "${values.endpoint}".`);
      process.exit(1);
    }
  }

  return {
    interval,
    endpoint: values.endpoint,
    headers,
    configPath: values.config,
    dryRun: values["dry-run"] ?? false,
  };
}

function mergeConfig(fileConfig: MetrixConfig, cliArgs: ParsedArgs): MetrixConfig {
  return {
    interval: cliArgs.interval ?? fileConfig.interval,
    otlp: {
      endpoint: cliArgs.endpoint ?? fileConfig.otlp.endpoint,
      headers: { ...fileConfig.otlp.headers, ...cliArgs.headers },
    },
    metrics: fileConfig.metrics,
  };
}

export interface RuntimeConfig {
  config: MetrixConfig;
  dryRun: boolean;
}

export async function initConfig(): Promise<RuntimeConfig> {
  const cliArgs = parseCliArgs();
  const fileConfig = await loadConfig(cliArgs.configPath);
  const config = mergeConfig(fileConfig, cliArgs);
  return { config, dryRun: cliArgs.dryRun };
}

async function main(): Promise<void> {
  const { config, dryRun } = await initConfig();

  if (dryRun) {
    console.log("Dry-run mode enabled");
    console.log("Config:", JSON.stringify(config, null, 2));
  } else {
    console.log("Metrix starting with interval:", config.interval, "seconds");
  }
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
