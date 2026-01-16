import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { MetricBatch } from "./types";
import type { OtlpConfig } from "./config";
import { buildOtlpPayload, encodeOtlpProtobuf } from "./otlp";

export interface ExportResult {
  success: boolean;
  statusCode?: number;
  error?: string;
}

function buildCurlCommand(
  endpoint: string,
  headers: Record<string, string>,
  payload: unknown,
): string {
  const allHeaders = { "Content-Type": "application/json", ...headers };
  const headerArgs = Object.entries(allHeaders)
    .map(([k, v]) => `-H '${k}: ${v}'`)
    .join(" \\\n  ");
  const body = JSON.stringify(payload);
  return `curl -X POST '${endpoint}' \\\n  ${headerArgs} \\\n  -d '${body.replace(/'/g, "'\\''")}'`;
}

function dumpCurlOnError(
  endpoint: string,
  headers: Record<string, string>,
  payload: unknown,
): void {
  const curlCmd = buildCurlCommand(endpoint, headers, payload);
  const errorFile = join(homedir(), "metrix-error.txt");
  writeFileSync(errorFile, curlCmd, "utf-8");
  console.error(`Curl command written to: ${errorFile}`);
}

export async function exportMetrics(
  batch: MetricBatch,
  config: OtlpConfig,
  dryRun: boolean = false,
): Promise<ExportResult> {
  const payload = buildOtlpPayload(batch);
  const isProtobuf = config.format === "protobuf";
  const contentType = isProtobuf ? "application/x-protobuf" : "application/json";
  const body = isProtobuf ? encodeOtlpProtobuf(payload) : JSON.stringify(payload);

  if (dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    return { success: true };
  }

  try {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        ...config.headers,
      },
      body,
    });

    if (response.ok) {
      return { success: true, statusCode: response.status };
    }

    const errorText = await response.text().catch(() => "");
    dumpCurlOnError(config.endpoint, config.headers, payload);
    return {
      success: false,
      statusCode: response.status,
      error: `HTTP ${response.status}: ${errorText}`.trim(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    dumpCurlOnError(config.endpoint, config.headers, payload);
    return { success: false, error: message };
  }
}
