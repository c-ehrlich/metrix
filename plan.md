#
Metrix Implementation Plan

Each ticket is atomic—typecheck + lint must pass after completion.

**Check command:** `bun run typecheck && bun run lint`

---

## Phase 1: Core Infrastructure

### 1.1 Config Types
- [x] Create `src/config.ts` with TypeScript types for the config schema (MetrixConfig, OtlpConfig, MetricsToggle). Export a default config object. No loading logic yet.

### 1.2 Config Loading
- [x] Add config file loading from `~/.config/metrix/config.json`. Handle missing file gracefully (use defaults). Add `loadConfig()` function.

### 1.3 CLI Argument Parsing
- [x] Update `src/index.ts` to parse CLI args: `--interval`, `--endpoint`, `--header`, `--config`, `--dry-run`. Merge with loaded config. Use `Bun.argv` or `parseArgs`.

### 1.4 Metric Types
- [x] Create `src/types.ts` with OTLP-compatible metric types: `Metric`, `DataPoint`, `MetricType` (gauge/counter). These will be used by collectors and exporter.

### 1.5 Scheduler
- [x] Create `src/scheduler.ts` with a simple interval loop that calls a collector callback and exporter callback. Support graceful shutdown via SIGINT/SIGTERM.

### 1.6 Device / User name
- [x] Make sure the device / user name is attached to each metric. Parse them from macos, they do not need to be user configurable for now.

---

## Phase 2: Collectors (one ticket each)

### 2.1 Collector Interface
- [x] Create `src/collectors/index.ts` with a `Collector` interface and a `collectAll()` function that aggregates results from enabled collectors.

### 2.2 CPU Collector
- [x] Create `src/collectors/cpu.ts`. Use `Bun.spawn` with `top -l 1` or similar to get CPU utilization. Return `system.cpu.utilization` gauge.

### 2.3 Memory Collector
- [x] Create `src/collectors/memory.ts`. Parse `vm_stat` output. Return `system.memory.usage`, `system.memory.available`, `system.memory.utilization`.

### 2.4 Disk Collector
- [x] Create `src/collectors/disk.ts`. Parse `df -k` output. Return `system.disk.usage`, `system.disk.available`, `system.disk.utilization` with `device` attribute.

### 2.5 Network Collector
- [x] Create `src/collectors/network.ts`. Parse `netstat -ib` output. Return `system.network.io` counter with `device` and `direction` attributes.

### 2.6 Load Average Collector
- [ ] Create `src/collectors/load.ts`. Use `os.loadavg()` or parse `uptime`. Return `system.cpu.load_average` with `period` attribute (1m, 5m, 15m).

### 2.7 Swap Collector
- [ ] Create `src/collectors/swap.ts`. Parse `sysctl vm.swapusage`. Return `system.swap.usage`, `system.swap.available`, `system.swap.utilization`.

### 2.8 Battery Collector
- [ ] Create `src/collectors/battery.ts`. Parse `pmset -g batt` output. Return `system.battery.charge`, `system.battery.charging`, `system.battery.cycle_count`.

### 2.9 Disk I/O Collector
- [ ] Create `src/collectors/disk-io.ts`. Parse `iostat -d` output. Return `system.disk.io` and `system.disk.operations` with `device` and `direction` attributes.

### 2.10 Uptime Collector
- [ ] Create `src/collectors/uptime.ts`. Use `Bun.spawn` with `sysctl kern.boottime`. Return `system.uptime` gauge in seconds.

### 2.11 Thermal Collector
- [ ] Create `src/collectors/thermal.ts`. Use `pmset -g therm` for thermal state. Return `system.thermal.state` gauge.

### 2.12 Wi-Fi Collector
- [ ] Create `src/collectors/wifi.ts`. Parse `/System/Library/PrivateFrameworks/Apple80211.framework/.../airport -I`. Return `system.wifi.signal_strength` with `ssid` and `interface` attributes.

### 2.13 Bluetooth Collector
- [ ] Create `src/collectors/bluetooth.ts`. Use `system_profiler SPBluetoothDataType` to count connected devices. Return `system.bluetooth.connected_devices`.

### 2.14 Display Brightness Collector
- [ ] Create `src/collectors/display.ts`. Use `brightness` CLI or IOKit approach. Return `system.display.brightness` with `display` attribute.

### 2.15 Fan Speed Collector
- [ ] Create `src/collectors/fan.ts`. Use `powermetrics` or third-party tool if available. Return `system.fan.speed` with `fan` attribute. May return empty on Apple Silicon.

---

## Phase 3: Export

### 3.1 OTLP Payload Builder
- [ ] Create `src/otlp.ts`. Build OTLP/HTTP JSON payload from `Metric[]`. Follow OTLP JSON schema with resourceMetrics, scopeMetrics, metrics.

### 3.2 Exporter
- [ ] Create `src/exporter.ts`. Implement `exportMetrics(metrics: Metric[], config: OtlpConfig)` using `fetch()`. Handle errors gracefully. Support dry-run mode (log to stdout).

### 3.3 Wire Up Main Loop
- [ ] Update `src/index.ts` to: load config, start scheduler, collect metrics, export via OTLP. Add `--dry-run` support to print instead of export.

---

## Phase 4: CLI Commands

### 4.1 Status Command
- [ ] Add `metrix status` subcommand that checks if the launchd service is running and prints status.

### 4.2 Setup Command (Interactive)
- [ ] Add `metrix setup` subcommand that prompts for OTLP endpoint, headers, and interval. Writes config to `~/.config/metrix/config.json`.

---

## Phase 5: Distribution

### 5.1 Launchd Plist
- [ ] Create `launchd/co.metrix.agent.plist` with correct paths. Use `$HOME` expansion for log path.

### 5.2 Install Script
- [ ] Create `scripts/install.sh` that builds binary, copies to `/usr/local/bin`, installs plist, and loads service.

### 5.3 Uninstall Script
- [ ] Create `scripts/uninstall.sh` that unloads service, removes plist, and removes binary.

### 5.4 README
- [ ] Update `README.md` with installation instructions, configuration examples, and usage documentation.

---

## Ticket Summary

| # | Ticket | Est. Size |
|---|--------|-----------|
| 1.1 | Config Types | XS |
| 1.2 | Config Loading | S |
| 1.3 | CLI Argument Parsing | S |
| 1.4 | Metric Types | XS |
| 1.5 | Scheduler | S |
| 1.6 | Device / User name | S |
| 2.1 | Collector Interface | XS |
| 2.2 | CPU Collector | S |
| 2.3 | Memory Collector | S |
| 2.4 | Disk Collector | S |
| 2.5 | Network Collector | S |
| 2.6 | Load Average Collector | XS |
| 2.7 | Swap Collector | S |
| 2.8 | Battery Collector | S |
| 2.9 | Disk I/O Collector | S |
| 2.10 | Uptime Collector | XS |
| 2.11 | Thermal Collector | S |
| 2.12 | Wi-Fi Collector | S |
| 2.13 | Bluetooth Collector | S |
| 2.14 | Display Brightness Collector | S |
| 2.15 | Fan Speed Collector | S |
| 3.1 | OTLP Payload Builder | M |
| 3.2 | Exporter | S |
| 3.3 | Wire Up Main Loop | M |
| 4.1 | Status Command | S |
| 4.2 | Setup Command | M |
| 5.1 | Launchd Plist | XS |
| 5.2 | Install Script | S |
| 5.3 | Uninstall Script | XS |
| 5.4 | README | S |
