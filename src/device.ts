import { hostname, userInfo } from "os";
import type { ResourceAttributes } from "./types";

let cachedDeviceInfo: ResourceAttributes | null = null;

function getUsername(): string {
  try {
    return userInfo().username;
  } catch {
    return process.env.USER ?? "unknown";
  }
}

export function getDeviceInfo(): ResourceAttributes {
  if (cachedDeviceInfo !== null) {
    return cachedDeviceInfo;
  }

  cachedDeviceInfo = {
    hostname: hostname(),
    username: getUsername(),
  };

  return cachedDeviceInfo;
}
