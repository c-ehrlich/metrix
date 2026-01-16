import type { Metric } from "../types";
import type { Collector } from "./index";

interface MemoryStats {
  usage: number;
  available: number;
  utilization: number;
}

export async function getMemoryStats(): Promise<MemoryStats> {
  const vmStatProc = Bun.spawn(["vm_stat"], {
    stdout: "pipe",
    stderr: "ignore",
  });

  const vmStatOutput = await new Response(vmStatProc.stdout).text();
  const vmStatExitCode = await vmStatProc.exited;

  if (vmStatExitCode !== 0) {
    throw new Error(`vm_stat command failed with exit code ${vmStatExitCode}`);
  }

  const pageSizeMatch = vmStatOutput.match(/page size of (\d+) bytes/);
  const pageSize = pageSizeMatch?.[1] ? parseInt(pageSizeMatch[1], 10) : 16384;

  const parsePages = (pattern: RegExp): number => {
    const match = vmStatOutput.match(pattern);
    return match?.[1] ? parseInt(match[1], 10) : 0;
  };

  const free = parsePages(/Pages free:\s+(\d+)/);
  const active = parsePages(/Pages active:\s+(\d+)/);
  const inactive = parsePages(/Pages inactive:\s+(\d+)/);
  const speculative = parsePages(/Pages speculative:\s+(\d+)/);
  const wired = parsePages(/Pages wired down:\s+(\d+)/);
  const compressed = parsePages(/Pages occupied by compressor:\s+(\d+)/);
  const purgeable = parsePages(/Pages purgeable:\s+(\d+)/);

  const sysctlProc = Bun.spawn(["sysctl", "-n", "hw.memsize"], {
    stdout: "pipe",
    stderr: "ignore",
  });

  const sysctlOutput = await new Response(sysctlProc.stdout).text();
  const sysctlExitCode = await sysctlProc.exited;

  if (sysctlExitCode !== 0) {
    throw new Error(`sysctl command failed with exit code ${sysctlExitCode}`);
  }

  const totalMemory = parseInt(sysctlOutput.trim(), 10);
  if (isNaN(totalMemory) || totalMemory <= 0) {
    throw new Error("Failed to parse total memory from sysctl output");
  }

  if (active === 0 && free === 0 && wired === 0) {
    throw new Error("Failed to parse memory statistics from vm_stat output");
  }

  const available = (free + inactive + purgeable + speculative) * pageSize;
  const usage = (active + wired + compressed) * pageSize;
  const utilization = totalMemory > 0 ? usage / totalMemory : 0;

  return {
    usage,
    available,
    utilization: Math.min(1, Math.max(0, utilization)),
  };
}

export const memoryCollector: Collector = {
  name: "memory",
  async collect(): Promise<Metric[]> {
    const stats = await getMemoryStats();
    const timestamp = Date.now();

    return [
      {
        name: "system.memory.usage",
        type: "gauge",
        unit: "bytes",
        description: "Memory currently in use",
        dataPoints: [{ timestamp, value: stats.usage }],
      },
      {
        name: "system.memory.available",
        type: "gauge",
        unit: "bytes",
        description: "Memory available",
        dataPoints: [{ timestamp, value: stats.available }],
      },
      {
        name: "system.memory.utilization",
        type: "gauge",
        unit: "ratio",
        description: "Memory usage percentage",
        dataPoints: [{ timestamp, value: stats.utilization }],
      },
    ];
  },
};
