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
  contentType: string,
  binaryFile?: string,
): string {
  const allHeaders = { "Content-Type": contentType, ...headers };
  const headerArgs = Object.entries(allHeaders)
    .map(([k, v]) => `-H '${k}: ${v}'`)
    .join(" \\\n  ");
  if (binaryFile) {
    return `curl -X POST '${endpoint}' \\\n  ${headerArgs} \\\n  --data-binary '@${binaryFile}'`;
  }
  const body = JSON.stringify(payload);
  return `curl -X POST '${endpoint}' \\\n  ${headerArgs} \\\n  -d '${body.replace(/'/g, "'\\''")}'`;
}

function dumpDebug(
  endpoint: string,
  headers: Record<string, string>,
  payload: unknown,
  baseName: string,
  contentType: string,
  protobufBody?: Uint8Array,
): void {
  const filePath = join(homedir(), `${baseName}.txt`);
  if (protobufBody) {
    const binPath = join(homedir(), `${baseName}.bin`);
    writeFileSync(binPath, protobufBody);
    const curlCmd = buildCurlCommand(endpoint, headers, payload, contentType, binPath);
    writeFileSync(filePath, curlCmd, "utf-8");
    console.error(`Curl command written to: ${filePath}`);
    console.error(`Protobuf payload written to: ${binPath}`);
  } else {
    const curlCmd = buildCurlCommand(endpoint, headers, payload, contentType);
    writeFileSync(filePath, curlCmd, "utf-8");
    console.error(`Curl command written to: ${filePath}`);
  }
}

export async function exportMetrics(
  batch: MetricBatch,
  config: OtlpConfig,
  dryRun: boolean = false,
  debug: boolean = false,
): Promise<ExportResult> {
  const payload = buildOtlpPayload(batch);
  const isProtobuf = config.format === "protobuf";
  const contentType = isProtobuf ? "application/x-protobuf" : "application/json";
  const protobufBody = isProtobuf ? encodeOtlpProtobuf(payload) : undefined;
  const body = isProtobuf ? protobufBody : JSON.stringify(payload);

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

    if (debug) {
      dumpDebug(config.endpoint, config.headers, payload, "metrix", contentType, protobufBody);
    }

    if (response.ok) {
      return { success: true, statusCode: response.status };
    }

    const errorText = await response.text().catch(() => "");
    if (!debug) {
      dumpDebug(config.endpoint, config.headers, payload, "metrix-error", contentType, protobufBody);
    }
    return {
      success: false,
      statusCode: response.status,
      error: `HTTP ${response.status}: ${errorText}`.trim(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (debug) {
      dumpDebug(config.endpoint, config.headers, payload, "metrix", contentType, protobufBody);
    } else {
      dumpDebug(config.endpoint, config.headers, payload, "metrix-error", contentType, protobufBody);
    }
    return { success: false, error: message };
  }
}
