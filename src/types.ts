export type MetricType = "gauge" | "counter";

export interface ResourceAttributes {
  hostname: string;
  username: string;
}

export interface DataPoint {
  timestamp: number;
  value: number;
  attributes?: Record<string, string>;
}

export interface Metric {
  name: string;
  type: MetricType;
  unit: string;
  description: string;
  dataPoints: DataPoint[];
}

export interface MetricBatch {
  resource: ResourceAttributes;
  metrics: Metric[];
}
