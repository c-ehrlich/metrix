import { homedir } from "os";
import { join } from "path";

export type OtlpFormat = "json" | "protobuf";

export interface OtlpConfig {
  endpoint: string;
  headers: Record<string, string>;
  format: OtlpFormat;
}

export interface MetricsToggle {
  cpu: boolean;
  memory: boolean;
  disk: boolean;
  network: boolean;
  load: boolean;
  swap: boolean;
  battery: boolean;
  diskIo: boolean;
  uptime: boolean;
  thermal: boolean;
  wifi: boolean;
  bluetooth: boolean;
  display: boolean;
  fan: boolean;
}

export interface MetrixConfig {
  interval: number;
  otlp: OtlpConfig;
  metrics: MetricsToggle;
}

export const defaultConfig: MetrixConfig = {
  interval: 10,
  otlp: {
    endpoint: "https://api.axiom.co/v1/metrics",
    headers: {},
    format: "json",
  },
  metrics: {
    cpu: true,
    memory: true,
    disk: true,
    network: true,
    load: true,
    swap: true,
    battery: true,
    diskIo: true,
    uptime: true,
    thermal: true,
    wifi: true,
    bluetooth: true,
    display: true,
    fan: true,
  },
};

export function getConfigPath(): string {
  return join(homedir(), ".config", "metrix", "config.json");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseHeaders(headers: unknown): Record<string, string> {
  if (!isRecord(headers)) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string") {
      result[key] = value;
    }
  }
  return result;
}

export async function loadConfig(configPath?: string): Promise<MetrixConfig> {
  const path = configPath ?? getConfigPath();

  try {
    const file = Bun.file(path);
    const exists = await file.exists();

    if (!exists) {
      return { ...defaultConfig };
    }

    const content = await file.text();
    const parsed: unknown = JSON.parse(content);

    if (!isRecord(parsed)) {
      console.error(`Invalid config format in ${path}, using defaults`);
      return { ...defaultConfig };
    }

    const interval =
      typeof parsed.interval === "number" && parsed.interval > 0
        ? parsed.interval
        : defaultConfig.interval;

    const otlp = isRecord(parsed.otlp) ? parsed.otlp : {};
    const endpoint =
      typeof otlp.endpoint === "string" ? otlp.endpoint : defaultConfig.otlp.endpoint;
    const headers = {
      ...defaultConfig.otlp.headers,
      ...parseHeaders(otlp.headers),
    };
    const format: OtlpFormat =
      otlp.format === "json" || otlp.format === "protobuf"
        ? otlp.format
        : defaultConfig.otlp.format;

    const metricsInput = isRecord(parsed.metrics) ? parsed.metrics : {};
    const metrics = { ...defaultConfig.metrics };
    for (const key of Object.keys(defaultConfig.metrics) as Array<keyof MetricsToggle>) {
      if (typeof metricsInput[key] === "boolean") {
        metrics[key] = metricsInput[key];
      }
    }

    return { interval, otlp: { endpoint, headers, format }, metrics };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to load config from ${path}: ${message}`);
    return { ...defaultConfig };
  }
}
