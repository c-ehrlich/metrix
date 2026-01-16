export type MetricType = "gauge" | "counter";

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
