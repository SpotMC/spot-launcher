// ============================================================
// spot — Minecraft Core (backward-compat re-export layer)
// Delegates to LaunchOrchestrator for worker lifecycle
// ============================================================

import type * as SpotCoreNS from "@spot/core" with { "resolution-mode": "import" }
import type { SpotHandler, ResolvedLaunchRequest } from "@spot/core" with { "resolution-mode": "import" }
import { logRuntimeDebug } from "./runtime"
import { LaunchOrchestrator, getLaunchOrchestrator } from "./launch-orchestrator"
import { dbHelpers, type DbAccount } from "../db"

type LaunchAccountPayload = {
  type: "elyby" | "microsoft" | "offline"
  username: string
  uuid?: string
  accessToken?: string
}

type LaunchResultPayload = {
  success: boolean
  pid?: number
  error?: string
}

type SpotModule = typeof SpotCoreNS

let SpotModulePromise: Promise<SpotModule> | null = null
let handler: SpotHandler | undefined

export function loadSpotModule(): Promise<SpotModule> {
  if (!SpotModulePromise) {
    SpotModulePromise = import("@spot/core")
  }
  return SpotModulePromise
}

// ---------- Handler Management ----------

export async function getHandler(): Promise<SpotHandler> {
  if (!handler) {
    const { createDefaultHandler, getDefaultMinecraftRootFromEnv } = await loadSpotModule()
    process.env.SPOT_GAME_DIR = getDefaultMinecraftRootFromEnv()
    handler = createDefaultHandler({
      memoryMax: "4G",
      memoryMin: "512M",
    })
  }

  return handler
}

export async function callHandler<T>(
  label: string,
  fallback: T,
  action: (handler: SpotHandler) => Promise<T>,
): Promise<T> {
  try {
    return await action(await getHandler())
  } catch (error) {
    console.error(`Failed to ${label}:`, error)
    return fallback
  }
}

// ---------- Game Dir ----------

export async function getGameDir(): Promise<string> {
  const { getDefaultMinecraftRootFromEnv } = await loadSpotModule()
  return getDefaultMinecraftRootFromEnv()
}

// ---------- Worker Lifecycle (delegated to LaunchOrchestrator) ----------

export function clearLaunchState(): void {
  getLaunchOrchestrator().clearState()
}

export function stopLaunchWorker(): void {
  getLaunchOrchestrator().stop()
}

export function isLaunchActive(): boolean {
  return getLaunchOrchestrator().isActive()
}

export async function resolveLaunchAccount(requestAccount?: LaunchAccountPayload): Promise<DbAccount | undefined> {
  return getLaunchOrchestrator().resolveLaunchAccount(requestAccount)
}

export async function runLaunchWorker(
  launchAccount: DbAccount,
  request: ResolvedLaunchRequest & { buildName?: string; buildId?: string; gameDir?: string },
): Promise<LaunchResultPayload> {
  return getLaunchOrchestrator().runLaunch(launchAccount, request)
}
