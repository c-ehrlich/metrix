import type { Metric, MetricBatch, DataPoint } from "./types";
import protobuf from "protobufjs";

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

const otlpProtoSchema = `
syntax = "proto3";

package opentelemetry.proto.collector.metrics.v1;

message ExportMetricsServiceRequest {
  repeated ResourceMetrics resource_metrics = 1;
}

message ResourceMetrics {
  Resource resource = 1;
  repeated ScopeMetrics scope_metrics = 2;
}

message Resource {
  repeated KeyValue attributes = 1;
}

message ScopeMetrics {
  InstrumentationScope scope = 1;
  repeated Metric metrics = 2;
}

message InstrumentationScope {
  string name = 1;
  string version = 2;
}

message Metric {
  string name = 1;
  string description = 2;
  string unit = 3;
  oneof data {
    Gauge gauge = 5;
    Sum sum = 7;
  }
}

message Gauge {
  repeated NumberDataPoint data_points = 1;
}

message Sum {
  repeated NumberDataPoint data_points = 1;
  int32 aggregation_temporality = 2;
  bool is_monotonic = 3;
}

message NumberDataPoint {
  repeated KeyValue attributes = 7;
  fixed64 start_time_unix_nano = 2;
  fixed64 time_unix_nano = 3;
  oneof value {
    double as_double = 4;
    sfixed64 as_int = 6;
  }
}

message KeyValue {
  string key = 1;
  AnyValue value = 2;
}

message AnyValue {
  oneof value {
    string string_value = 1;
    bool bool_value = 2;
    int64 int_value = 3;
    double double_value = 4;
  }
}
`;

let cachedRoot: protobuf.Root | null = null;

function getProtoRoot(): protobuf.Root {
  if (!cachedRoot) {
    cachedRoot = protobuf.parse(otlpProtoSchema).root;
  }
  return cachedRoot;
}

interface ProtoDataPoint {
  attributes?: Array<{ key: string; value: { stringValue?: string } }>;
  timeUnixNano: bigint;
  startTimeUnixNano?: bigint;
  asDouble: number;
}

interface ProtoMetric {
  name: string;
  description: string;
  unit: string;
  gauge?: { dataPoints: ProtoDataPoint[] };
  sum?: { dataPoints: ProtoDataPoint[]; aggregationTemporality: number; isMonotonic: boolean };
}

function convertPayloadForProtobuf(payload: OtlpPayload): unknown {
  return {
    resourceMetrics: payload.resourceMetrics.map((rm) => ({
      resource: {
        attributes: rm.resource.attributes.map((attr) => ({
          key: attr.key,
          value: attr.value,
        })),
      },
      scopeMetrics: rm.scopeMetrics.map((sm) => ({
        scope: sm.scope,
        metrics: sm.metrics.map((m): ProtoMetric => {
          const base = {
            name: m.name,
            description: m.description,
            unit: m.unit,
          };
          if (m.gauge) {
            return {
              ...base,
              gauge: {
                dataPoints: m.gauge.dataPoints.map(
                  (dp): ProtoDataPoint => ({
                    attributes: dp.attributes?.map((a) => ({
                      key: a.key,
                      value: { stringValue: a.value.stringValue },
                    })),
                    timeUnixNano: BigInt(dp.timeUnixNano),
                    startTimeUnixNano: dp.startTimeUnixNano ? BigInt(dp.startTimeUnixNano) : undefined,
                    asDouble: dp.asDouble,
                  }),
                ),
              },
            };
          }
          if (m.sum) {
            return {
              ...base,
              sum: {
                dataPoints: m.sum.dataPoints.map(
                  (dp): ProtoDataPoint => ({
                    attributes: dp.attributes?.map((a) => ({
                      key: a.key,
                      value: { stringValue: a.value.stringValue },
                    })),
                    timeUnixNano: BigInt(dp.timeUnixNano),
                    startTimeUnixNano: dp.startTimeUnixNano ? BigInt(dp.startTimeUnixNano) : undefined,
                    asDouble: dp.asDouble,
                  }),
                ),
                aggregationTemporality: m.sum.aggregationTemporality,
                isMonotonic: m.sum.isMonotonic,
              },
            };
          }
          return base;
        }),
      })),
    })),
  };
}

export function encodeOtlpProtobuf(payload: OtlpPayload): Uint8Array {
  const root = getProtoRoot();
  const ExportMetricsServiceRequest = root.lookupType(
    "opentelemetry.proto.collector.metrics.v1.ExportMetricsServiceRequest",
  );
  const protoPayload = convertPayloadForProtobuf(payload) as { [k: string]: unknown };
  const message = ExportMetricsServiceRequest.create(protoPayload);
  return ExportMetricsServiceRequest.encode(message).finish();
}
