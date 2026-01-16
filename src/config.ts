export interface OtlpConfig {
  endpoint: string;
  headers: Record<string, string>;
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
