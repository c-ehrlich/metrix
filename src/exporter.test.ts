import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { exportMetrics } from "./exporter";
import type { MetricBatch } from "./types";
import type { OtlpConfig } from "./config";

const mockBatch: MetricBatch = {
  resource: {
    hostname: "test-host",
    username: "test-user",
  },
  metrics: [
    {
      name: "test.metric",
      type: "gauge",
      unit: "1",
      description: "A test metric",
      dataPoints: [{ value: 42, timestamp: 1700000000000 }],
    },
  ],
};

describe("exportMetrics", () => {
  let originalFetch: typeof globalThis.fetch;
  let capturedRequest: { headers: Headers; body: string | Uint8Array | null };

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    capturedRequest = { headers: new Headers(), body: null };

    globalThis.fetch = mock(async (_input: string | URL | Request, init?: RequestInit) => {
      capturedRequest.headers = new Headers(init?.headers);
      capturedRequest.body = (init?.body as string | Uint8Array) ?? null;
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("uses application/json Content-Type for JSON format", async () => {
    const config: OtlpConfig = {
      endpoint: "https://example.com/v1/metrics",
      headers: {},
      format: "json",
    };

    await exportMetrics(mockBatch, config);

    expect(capturedRequest.headers.get("Content-Type")).toBe("application/json");
  });

  it("uses application/x-protobuf Content-Type for protobuf format", async () => {
    const config: OtlpConfig = {
      endpoint: "https://example.com/v1/metrics",
      headers: {},
      format: "protobuf",
    };

    await exportMetrics(mockBatch, config);

    expect(capturedRequest.headers.get("Content-Type")).toBe("application/x-protobuf");
  });

  it("sends JSON string body for JSON format", async () => {
    const config: OtlpConfig = {
      endpoint: "https://example.com/v1/metrics",
      headers: {},
      format: "json",
    };

    await exportMetrics(mockBatch, config);

    expect(typeof capturedRequest.body).toBe("string");
    const parsed = JSON.parse(capturedRequest.body as string);
    expect(parsed.resourceMetrics).toBeDefined();
    expect(parsed.resourceMetrics[0].resource.attributes).toBeDefined();
  });

  it("sends Uint8Array body for protobuf format", async () => {
    const config: OtlpConfig = {
      endpoint: "https://example.com/v1/metrics",
      headers: {},
      format: "protobuf",
    };

    await exportMetrics(mockBatch, config);

    expect(capturedRequest.body).toBeInstanceOf(Uint8Array);
    expect((capturedRequest.body as Uint8Array).length).toBeGreaterThan(0);
  });

  it("includes custom headers in request", async () => {
    const config: OtlpConfig = {
      endpoint: "https://example.com/v1/metrics",
      headers: { Authorization: "Bearer token123" },
      format: "json",
    };

    await exportMetrics(mockBatch, config);

    expect(capturedRequest.headers.get("Authorization")).toBe("Bearer token123");
  });
});
