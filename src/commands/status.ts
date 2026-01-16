import { $ } from "bun";

const SERVICE_LABEL = "co.metrix.agent";

interface ServiceStatus {
  running: boolean;
  pid?: number;
  error?: string;
}

async function checkLaunchdService(): Promise<ServiceStatus> {
  try {
    const result = await $`launchctl list ${SERVICE_LABEL}`.quiet().nothrow();

    if (result.exitCode !== 0) {
      return { running: false };
    }

    const output = result.stdout.toString();
    const pidMatch = output.match(/"PID"\s*=\s*(\d+)/);
    if (pidMatch?.[1]) {
      return { running: true, pid: Number.parseInt(pidMatch[1], 10) };
    }

    return { running: false };
  } catch (error) {
    return {
      running: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function checkPlistInstalled(): Promise<boolean> {
  const home = process.env.HOME;
  if (!home) {
    return false;
  }
  const plistPath = `${home}/Library/LaunchAgents/${SERVICE_LABEL}.plist`;
  const file = Bun.file(plistPath);
  return file.exists();
}

export async function statusCommand(): Promise<void> {
  console.log("Metrix Status");
  console.log("─".repeat(40));

  const plistInstalled = await checkPlistInstalled();
  const serviceStatus = await checkLaunchdService();

  console.log(`Service plist: ${plistInstalled ? "installed" : "not installed"}`);

  if (serviceStatus.error) {
    console.log(`Service status: error (${serviceStatus.error})`);
  } else if (serviceStatus.running) {
    console.log(`Service status: running (PID ${serviceStatus.pid})`);
  } else {
    console.log("Service status: not running");
  }

  if (!plistInstalled) {
    console.log("\nTo install the service, run: ./scripts/install.sh");
  } else if (!serviceStatus.running) {
    console.log(
      `\nTo start the service, run: launchctl load ~/Library/LaunchAgents/${SERVICE_LABEL}.plist`,
    );
  }
}
