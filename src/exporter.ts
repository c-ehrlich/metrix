import type { MetricBatch } from "./types";
import type { OtlpConfig } from "./config";
import { buildOtlpPayload } from "./otlp";

export interface ExportResult {
  success: boolean;
  statusCode?: number;
  error?: string;
}

export async function exportMetrics(
  batch: MetricBatch,
  config: OtlpConfig,
  dryRun: boolean = false,
): Promise<ExportResult> {
  const payload = buildOtlpPayload(batch);

  if (dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    return { success: true };
  }

  try {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...config.headers,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return { success: true, statusCode: response.status };
    }

    const errorText = await response.text().catch(() => "");
    return {
      success: false,
      statusCode: response.status,
      error: `HTTP ${response.status}: ${errorText}`.trim(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}
