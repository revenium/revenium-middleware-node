import { getConfig, initializeConfig } from "./config/manager.js";

let autoInitAttempted = false;

export function ensureInitialized(): boolean {
  if (getConfig()) return true;
  if (autoInitAttempted) return false;

  autoInitAttempted = true;
  return initializeConfig();
}

export function resetAutoInit(): void {
  autoInitAttempted = false;
}
