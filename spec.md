# Metrix - macOS System Metrics Daemon

A lightweight daemon that collects system metrics from macOS and exports them via OpenTelemetry Protocol (OTLP) over HTTP.

## Goals

- Minimal resource footprint
- Easy installation on any Mac
- Proper macOS service integration via launchd
- Configurable metrics collection and export
- Guides the user to setup config via interactive assistant

## Tech Stack

- **Runtime:** Bun
- **Language:** TypeScript
- **Build:** Single executable via `bun build --compile`
- **Config:** JSON (the user will likely never read the config)

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Collector  │────▶│   Exporter   │────▶│ OTLP/HTTP   │
│  (metrics)  │     │  (batching)  │     │  Endpoint   │
└─────────────┘     └──────────────┘     └─────────────┘
       ▲
       │
┌──────┴──────┐
│   Scheduler │  (configurable interval, default 10s)
└─────────────┘
```

## Configuration

Location: `~/.config/metrix/config.json`

```json
{
  "interval": 10,
  "otlp": {
    "endpoint": "https://api.axiom.co/v1/metrics",
    "headers": {
      "Authorization": "Bearer xaat-your-token-here",
      "X-Axiom-Dataset": "system-metrics"
    }
  },
  "metrics": {
    "cpu": true,
    "memory": true,
    "disk": true,
    "network": true
  }
}
```

### CLI Overrides

All config values can be overridden via CLI flags:

```bash
metrix --interval 5
metrix --endpoint "https://..."
metrix --header "Authorization=Bearer xxx" --header "X-Custom=value"
metrix --config /path/to/config.json
```

## Metrics

All metrics follow OpenTelemetry semantic conventions where applicable.

### CPU

| Metric | Type | Unit | Description |
|--------|------|------|-------------|
| `system.cpu.utilization` | Gauge | ratio (0-1) | CPU usage percentage |

### Memory

| Metric | Type | Unit | Description |
|--------|------|------|-------------|
| `system.memory.usage` | Gauge | bytes | Memory currently in use |
| `system.memory.available` | Gauge | bytes | Memory available |
| `system.memory.utilization` | Gauge | ratio (0-1) | Memory usage percentage |

### Disk

| Metric | Type | Unit | Description |
|--------|------|------|-------------|
| `system.disk.usage` | Gauge | bytes | Disk space used |
| `system.disk.available` | Gauge | bytes | Disk space available |
| `system.disk.utilization` | Gauge | ratio (0-1) | Disk usage percentage |

Attributes: `device` (mount point, e.g., `/`, `/Volumes/Data`)

### Network

| Metric | Type | Unit | Description |
|--------|------|------|-------------|
| `system.network.io` | Counter | bytes | Bytes transmitted/received |

Attributes: `device` (interface, e.g., `en0`), `direction` (`transmit` | `receive`)

### Load Average

| Metric | Type | Unit | Description |
|--------|------|------|-------------|
| `system.cpu.load_average` | Gauge | 1 | System load average |

Attributes: `period` (`1m` | `5m` | `15m`)

### Swap

| Metric | Type | Unit | Description |
|--------|------|------|-------------|
| `system.swap.usage` | Gauge | bytes | Swap space used |
| `system.swap.available` | Gauge | bytes | Swap space available |
| `system.swap.utilization` | Gauge | ratio (0-1) | Swap usage percentage |

### Battery

| Metric | Type | Unit | Description |
|--------|------|------|-------------|
| `system.battery.charge` | Gauge | ratio (0-1) | Current charge level |
| `system.battery.charging` | Gauge | boolean (0/1) | Whether plugged in and charging |
| `system.battery.cycle_count` | Gauge | cycles | Battery cycle count |

### Disk I/O

| Metric | Type | Unit | Description |
|--------|------|------|-------------|
| `system.disk.io` | Counter | bytes | Bytes read/written |
| `system.disk.operations` | Counter | operations | Read/write operations |

Attributes: `device`, `direction` (`read` | `write`)

### Uptime

| Metric | Type | Unit | Description |
|--------|------|------|-------------|
| `system.uptime` | Gauge | seconds | Time since boot |

### Thermal

| Metric | Type | Unit | Description |
|--------|------|------|-------------|
| `system.thermal.state` | Gauge | enum (0-3) | Thermal state (0=nominal, 1=fair, 2=serious, 3=critical) |
| `system.thermal.temperature` | Gauge | celsius | CPU temperature |

### Wi-Fi

| Metric | Type | Unit | Description |
|--------|------|------|-------------|
| `system.wifi.signal_strength` | Gauge | dBm | RSSI of current connection |

Attributes: `ssid`, `interface`

### Bluetooth

| Metric | Type | Unit | Description |
|--------|------|------|-------------|
| `system.bluetooth.connected_devices` | Gauge | count | Number of connected Bluetooth devices |

### Display

| Metric | Type | Unit | Description |
|--------|------|------|-------------|
| `system.display.brightness` | Gauge | ratio (0-1) | Screen brightness level |

Attributes: `display` (display identifier)

### Fan

| Metric | Type | Unit | Description |
|--------|------|------|-------------|
| `system.fan.speed` | Gauge | rpm | Fan speed |

Attributes: `fan` (fan identifier)

## OTLP Export

- Protocol: OTLP/HTTP (JSON)
- Endpoint: Configurable, defaults assume Axiom
- Headers: Fully configurable for auth tokens, dataset names, etc.
- Batching: Metrics collected each interval are sent as a single batch

### Axiom Integration

Per [Axiom OTLP docs](https://axiom.co/docs/send-data/opentelemetry#send-opentelemetry-data-to-axiom):

```json
{
  "otlp": {
    "endpoint": "https://api.axiom.co/v1/metrics",
    "headers": {
      "Authorization": "Bearer xaat-xxxxxxxx",
      "X-Axiom-Dataset": "your-dataset-name"
    }
  }
}
```

## Installation

### Manual

```bash
# Build
bun install
bun run build

# Install binary
sudo cp ./dist/metrix /usr/local/bin/

# Install launchd service
cp ./launchd/co.metrix.agent.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/co.metrix.agent.plist
```

### Install Script

```bash
./scripts/install.sh    # Installs binary + launchd service
./scripts/uninstall.sh  # Removes both
```

## launchd Service

Plist location: `~/Library/LaunchAgents/co.metrix.agent.plist`

Behavior:
- Starts on login
- Restarts on crash
- Logs to `~/Library/Logs/metrix.log`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>co.metrix.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/metrix</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>~/Library/Logs/metrix.log</string>
    <key>StandardErrorPath</key>
    <string>~/Library/Logs/metrix.log</string>
</dict>
</plist>
```

## Project Structure

```
metrix/
├── src/
│   ├── index.ts          # Entry point, CLI parsing
│   ├── config.ts         # JSON config loading
│   ├── scheduler.ts      # Collection loop
│   ├── collectors/
│   │   ├── cpu.ts
│   │   ├── memory.ts
│   │   ├── disk.ts
│   │   └── network.ts
│   └── exporter.ts       # OTLP/HTTP export
├── launchd/
│   └── co.metrix.agent.plist
├── scripts/
│   ├── install.sh
│   └── uninstall.sh
├── spec.md
├── package.json
├── tsconfig.json
└── bunfig.toml
```

## Build Phases

### Phase 1: Core Infrastructure
- [ ] Project setup (Bun, TypeScript, dependencies)
- [ ] Config loading (TOML + CLI args)
- [ ] Scheduler loop

### Phase 2: Collectors
- [ ] CPU metrics
- [ ] Memory metrics
- [ ] Disk metrics
- [ ] Network metrics
- [ ] Load average
- [ ] Swap metrics
- [ ] Battery metrics
- [ ] Disk I/O metrics
- [ ] Uptime
- [ ] Thermal (state + temperature)
- [ ] Wi-Fi signal strength
- [ ] Bluetooth connected devices
- [ ] Display brightness
- [ ] Fan speed

### Phase 3: Export
- [ ] OTLP/HTTP exporter
- [ ] Axiom integration test

### Phase 4: Distribution
- [ ] Compile to single binary
- [ ] launchd plist
- [ ] Install/uninstall scripts
- [ ] README with usage docs

### Phase 5: Per-App Metrics (Future)
- [ ] Process enumeration (`ps` or `proc_pid_rusage`)
- [ ] Group by app name (aggregate helper processes)
- [ ] Top N by CPU/memory to limit cardinality
- [ ] Configurable app allowlist

## Dependencies

```json
{
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.0.0"
  }
}
```

## Design Decisions

1. **Disk volumes:** Support all mounted volumes (enumerate via `df`), each tagged with `device` attribute
2. **Network metrics:** Per-interface, tagged with `device` attribute (e.g., `en0`, `en1`)
3. **Status command:** `metrix status` to check if daemon is running
4. **Debug mode:** `metrix --dry-run` prints metrics to stdout instead of exporting
