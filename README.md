# Enter the metrix

A lightweight macOS daemon that exports system metrics via OpenTelemetry (OTLP).

## Features

- Minimal resource footprint
- Easy installation on any Mac
- Proper macOS service integration via launchd
- Configurable metrics collection and export
- Interactive setup wizard

## Prerequisites

- macOS
- [Bun](https://bun.sh) runtime (`curl -fsSL https://bun.sh/install | bash`)

## Quick Start

```bash
# 1. Clone and build
git clone https://github.com/c-ehrlich/metrix.git
cd metrix
bun install
bun run build

# 2. Configure your OTLP endpoint
./dist/metrix setup

# 3. Test metrics collection
./dist/metrix --dry-run

# 4. Install as background service
./scripts/install.sh

# 5. Verify it's running
metrix status
```

## Installation

### Using the Install Script

After building and configuring (steps 1-2 above):

```bash
./scripts/install.sh
```

This copies the binary to `/usr/local/bin` and sets up a launchd service that runs in the background.

### Manual Installation

```bash
# Copy binary to /usr/local/bin
sudo cp ./dist/metrix /usr/local/bin/

# Install launchd service
cp ./launchd/co.metrix.agent.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/co.metrix.agent.plist

# Verify
metrix status
```

### Uninstall

```bash
./scripts/uninstall.sh
```

## Configuration

### Interactive Setup

Run the setup wizard to configure your OTLP endpoint (do this before installing the service):

```bash
metrix setup
```

### Configuration File

Config location: `~/.config/metrix/config.json`

```json
{
  "interval": 10,
  "otlp": {
    "endpoint": "https://api.axiom.co/v1/metrics",
    "headers": {
      "Authorization": "Bearer your-token-here",
      "X-Axiom-Dataset": "system-metrics"
    }
  },
  "metrics": {
    "cpu": true,
    "memory": true,
    "disk": true,
    "network": true,
    "load": true,
    "swap": true,
    "battery": true,
    "diskIo": true,
    "uptime": true,
    "thermal": true,
    "wifi": true,
    "bluetooth": true,
    "display": true,
    "fan": true
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
metrix --dry-run  # Print metrics to stdout instead of exporting
```

## Usage

```
Usage: metrix [command] [options]

Commands:
  setup     Interactive configuration wizard
  status    Check if the metrix service is running

Options:
  -i, --interval <seconds>  Collection interval (default: 10)
  -e, --endpoint <url>      OTLP endpoint URL
  -H, --header <key=value>  Add header (can be repeated)
  -c, --config <path>       Path to config file
  -d, --dry-run             Print metrics to stdout instead of exporting
  --debug                   Save last request to ~/metrix.txt
  -h, --help                Show this help message
```

### Check Service Status

```bash
metrix status
```

### Test Metrics Collection

```bash
metrix --dry-run
```

## Metrics

All metrics follow OpenTelemetry semantic conventions.

| Metric | Type | Description |
|--------|------|-------------|
| `system.cpu.utilization` | Gauge | CPU usage (0-1) |
| `system.cpu.load_average` | Gauge | Load average (1m, 5m, 15m) |
| `system.memory.usage` | Gauge | Memory in use (bytes) |
| `system.memory.available` | Gauge | Memory available (bytes) |
| `system.memory.utilization` | Gauge | Memory usage (0-1) |
| `system.disk.usage` | Gauge | Disk space used (bytes) |
| `system.disk.available` | Gauge | Disk space available (bytes) |
| `system.disk.utilization` | Gauge | Disk usage (0-1) |
| `system.disk.io` | Counter | Bytes read/written |
| `system.disk.operations` | Counter | Read/write operations |
| `system.network.io` | Counter | Bytes transmitted/received |
| `system.swap.usage` | Gauge | Swap space used (bytes) |
| `system.swap.available` | Gauge | Swap space available (bytes) |
| `system.swap.utilization` | Gauge | Swap usage (0-1) |
| `system.battery.charge` | Gauge | Battery charge level (0-1) |
| `system.battery.charging` | Gauge | Charging state (0/1) |
| `system.battery.cycle_count` | Gauge | Battery cycle count |
| `system.uptime` | Gauge | Time since boot (seconds) |
| `system.thermal.state` | Gauge | Thermal state (0-3) |
| `system.wifi.signal_strength` | Gauge | Wi-Fi RSSI (dBm) |
| `system.bluetooth.connected_devices` | Gauge | Connected Bluetooth devices |
| `system.display.brightness` | Gauge | Display brightness (0-1) |
| `system.fan.speed` | Gauge | Fan speed (rpm) |

## Axiom Integration

To send metrics to [Axiom](https://axiom.co):

1. Create an API token in Axiom
2. Create a dataset for your metrics
3. Configure metrix:

```json
{
  "otlp": {
    "endpoint": "https://api.axiom.co/v1/metrics",
    "headers": {
      "Authorization": "Bearer xaat-your-token-here",
      "X-Axiom-Dataset": "your-dataset-name"
    }
  }
}
```

## launchd Service

The service is managed via launchd:

- Plist: `~/Library/LaunchAgents/co.metrix.agent.plist`
- Logs: `~/Library/Logs/metrix.log`
- Starts on login
- Restarts automatically on crash

### Manual Service Control

```bash
# Stop
launchctl unload ~/Library/LaunchAgents/co.metrix.agent.plist

# Start
launchctl load ~/Library/LaunchAgents/co.metrix.agent.plist

# Check status
launchctl list | grep metrix
```

## Development

```bash
# Install dependencies
bun install

# Run in development mode
bun run dev

# Build binary
bun run build

# Type check
bun run typecheck

# Lint
bun run lint

# Format
bun run format
```

## License

MIT
