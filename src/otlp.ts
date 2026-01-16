import type { Metric, MetricBatch, DataPoint } from "./types";

interface OtlpAttribute {
  key: string;
  value: {
    stringValue?: string;
    intValue?: string;
    doubleValue?: number;
    boolValue?: boolean;
  };
}

interface OtlpDataPoint {
  asDouble: number;
  timeUnixNano: string;
  startTimeUnixNano?: string;
  attributes?: OtlpAttribute[];
}

interface OtlpGauge {
  dataPoints: OtlpDataPoint[];
}

interface OtlpSum {
  aggregationTemporality: number;
  isMonotonic: boolean;
  dataPoints: OtlpDataPoint[];
}

interface OtlpMetric {
  name: string;
  unit: string;
  description: string;
  gauge?: OtlpGauge;
  sum?: OtlpSum;
}

interface OtlpScopeMetrics {
  scope: {
    name: string;
    version: string;
  };
  metrics: OtlpMetric[];
}

interface OtlpResourceMetrics {
  resource: {
    attributes: OtlpAttribute[];
  };
  scopeMetrics: OtlpScopeMetrics[];
}

export interface OtlpPayload {
  resourceMetrics: OtlpResourceMetrics[];
}

function toNanoString(timestampMs: number): string {
  return (BigInt(timestampMs) * BigInt(1_000_000)).toString();
}

function convertAttributes(attrs?: Record<string, string>): OtlpAttribute[] {
  if (!attrs) return [];
  return Object.entries(attrs).map(([key, value]) => ({
    key,
    value: { stringValue: value },
  }));
}

function convertDataPoint(dp: DataPoint): OtlpDataPoint {
  const result: OtlpDataPoint = {
    asDouble: dp.value,
    timeUnixNano: toNanoString(dp.timestamp),
  };
  if (dp.attributes && Object.keys(dp.attributes).length > 0) {
    result.attributes = convertAttributes(dp.attributes);
  }
  return result;
}

function convertDataPointWithStart(dp: DataPoint): OtlpDataPoint {
  const result = convertDataPoint(dp);
  result.startTimeUnixNano = result.timeUnixNano;
  return result;
}

function convertMetric(metric: Metric): OtlpMetric {
  const base = {
    name: metric.name,
    unit: metric.unit,
    description: metric.description,
  };

  if (metric.type === "gauge") {
    return {
      ...base,
      gauge: {
        dataPoints: metric.dataPoints.map(convertDataPoint),
      },
    };
  }

  return {
    ...base,
    sum: {
      aggregationTemporality: 2,
      isMonotonic: true,
      dataPoints: metric.dataPoints.map(convertDataPointWithStart),
    },
  };
}

export function buildOtlpPayload(batch: MetricBatch): OtlpPayload {
  const resourceAttributes: OtlpAttribute[] = [
    { key: "host.name", value: { stringValue: batch.resource.hostname } },
    { key: "user.name", value: { stringValue: batch.resource.username } },
  ];

  return {
    resourceMetrics: [
      {
        resource: {
          attributes: resourceAttributes,
        },
        scopeMetrics: [
          {
            scope: {
              name: "metrix",
              version: "0.1.0",
            },
            metrics: batch.metrics.map(convertMetric),
          },
        ],
      },
    ],
  };
}
