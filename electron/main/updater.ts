import { autoUpdater, UpdateInfo } from "electron-updater"
import { app, ipcMain, BrowserWindow } from "electron"
import { isDev, logRuntime, logRuntimeDebug } from "./runtime"
import { isLaunchActive } from "./minecraft-core"
import { dbHelpers } from "../db"

export type UpdateChannel = "stable" | "beta"

export type UpdateSettings = {
  channel: UpdateChannel
  autoCheck: boolean
  autoDownload: boolean
  skipVersion: string | null
  forced: boolean
  checkIntervalHours: number
  feedUrlOverride: string | null
}

export type UpdateErrorCode =
  | "GAME_RUNNING"
  | "NO_UPDATE"
  | "DOWNLOAD_BUSY"
  | "INVALID_SETTINGS"
  | "NETWORK"
  | "UNKNOWN"

const DEFAULT_SETTINGS: UpdateSettings = {
  channel: "stable",
  autoCheck: true,
  autoDownload: false,
  skipVersion: null,
  forced: false,
  checkIntervalHours: 6,
  feedUrlOverride: null,
}

const SETTINGS_KEY = "updateSettings"
const CHANNEL_URLS: Record<UpdateChannel, string> = {
  stable: "https://admin.nexus-manage.ru/updates",
  beta: "https://admin.nexus-manage.ru/updates-beta",
}

let pendingUpdate: UpdateInfo | null = null
let isDownloading = false
let updateDownloaded = false
let settings: UpdateSettings = { ...DEFAULT_SETTINGS }
let settingsLoaded = false
let checkTimer: NodeJS.Timeout | null = null
const deferredVersions = new Set<string>()

const CURRENT_VERSION = app.getVersion()

function isVersionNewer(remote: string, local: string): boolean {
  const r = remote.replace(/^v/, "").split(".").map(Number)
  const l = local.replace(/^v/, "").split(".").map(Number)
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const a = r[i] ?? 0
    const b = l[i] ?? 0
    if (a > b) return true
    if (a < b) return false
  }
  return false
}

function sendToRenderer(channel: string, ...args: unknown[]) {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) win.webContents.send(channel, ...args)
  })
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === "true") return true
  if (value === "false") return false
  return fallback
}

async function loadSettings(): Promise<UpdateSettings> {
  if (settingsLoaded) return settings
  try {
    const raw = await dbHelpers.getSetting(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UpdateSettings>
      settings = {
        channel: parsed.channel === "beta" ? "beta" : "stable",
        autoCheck: typeof parsed.autoCheck === "boolean" ? parsed.autoCheck : DEFAULT_SETTINGS.autoCheck,
        autoDownload: typeof parsed.autoDownload === "boolean" ? parsed.autoDownload : DEFAULT_SETTINGS.autoDownload,
        skipVersion: typeof parsed.skipVersion === "string" ? parsed.skipVersion : null,
        forced: typeof parsed.forced === "boolean" ? parsed.forced : DEFAULT_SETTINGS.forced,
        checkIntervalHours:
          typeof parsed.checkIntervalHours === "number" && parsed.checkIntervalHours >= 1
            ? Math.min(168, Math.round(parsed.checkIntervalHours))
            : DEFAULT_SETTINGS.checkIntervalHours,
        feedUrlOverride: typeof parsed.feedUrlOverride === "string" && parsed.feedUrlOverride
          ? parsed.feedUrlOverride
          : null,
      }
    } else {
      settings = { ...DEFAULT_SETTINGS }
    }
  } catch (e) {
    logRuntime(`[Updater] Failed to load settings: ${e instanceof Error ? e.message : String(e)}`)
    settings = { ...DEFAULT_SETTINGS }
  }
  settingsLoaded = true
  return settings
}

async function persistSettings(next: UpdateSettings): Promise<void> {
  settings = next
  settingsLoaded = true
  await dbHelpers.setSetting(SETTINGS_KEY, JSON.stringify(next))
}

function applyFeedUrl(): void {
  const base = settings.feedUrlOverride?.trim() || CHANNEL_URLS[settings.channel]
  try {
    autoUpdater.setFeedURL({ provider: "generic", url: base.replace(/\/+$/, "") })
    logRuntimeDebug(`[Updater] Feed URL: ${base}`)
  } catch (e) {
    logRuntime(`[Updater] Failed to set feed URL: ${e instanceof Error ? e.message : String(e)}`)
  }
}

function restartCheckTimer(): void {
  if (checkTimer) {
    clearInterval(checkTimer)
    checkTimer = null
  }
  if (isDev || !settings.autoCheck) return
  const intervalMs = Math.max(1, settings.checkIntervalHours) * 60 * 60 * 1000
  checkTimer = setInterval(() => {
    if (isLaunchActive()) {
      logRuntimeDebug("[Updater] Scheduled check skipped: Minecraft is running")
      return
    }
    autoUpdater.checkForUpdates().catch((err) => {
      logRuntime(`[Updater] Scheduled check failed: ${err.message}`)
    })
  }, intervalMs)
}

function totalSizeBytes(info: UpdateInfo | null): number | null {
  if (!info || !Array.isArray(info.files) || info.files.length === 0) return null
  const sum = info.files.reduce((acc, f) => acc + (f.size ?? 0), 0)
  return sum > 0 ? sum : null
}

/**
 * electron-updater отдаёт releaseNotes как строку либо как массив
 * { version, note }. IPC-контракт и UI ждут строку, поэтому схлопываем
 * массив в текст с заголовками версий.
 */
function normalizeReleaseNotes(info: UpdateInfo | null): string | null {
  const notes = info?.releaseNotes
  if (!notes) return null
  if (typeof notes === "string") return notes.trim() || null
  const text = notes
    .map((entry) => {
      const note = (entry?.note ?? "").trim()
      return entry?.version ? `## ${entry.version}\n\n${note}` : note
    })
    .filter(Boolean)
    .join("\n\n")
  return text.trim() || null
}

function isSkipped(version: string): boolean {
  if (deferredVersions.has(version)) return true
  if (settings.skipVersion && settings.skipVersion === version) return true
  return false
}

export async function isUpdateRequired(): Promise<boolean> {
  if (!settings.forced) return false
  return pendingUpdate !== null && isVersionNewer(pendingUpdate.version, CURRENT_VERSION)
}

export async function getUpdateSettings(): Promise<UpdateSettings> {
  return loadSettings()
}

export function registerUpdater() {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.forceDevUpdateConfig = false

  if (isDev) {
    autoUpdater.logger = {
      info: (msg: string) => logRuntime(`[Updater] ${msg}`),
      warn: (msg: string) => logRuntime(`[Updater WARN] ${msg}`),
      error: (msg: string) => logRuntime(`[Updater ERROR] ${msg}`),
      debug: (msg: string) => logRuntimeDebug(`[Updater] ${msg}`),
    } as any
  }

  autoUpdater.on("checking-for-update", () => {
    logRuntime("[Updater] Checking for updates...")
    sendToRenderer("update:status", { status: "checking" })
  })

  autoUpdater.on("update-available", (info: UpdateInfo) => {
    if (!isVersionNewer(info.version, CURRENT_VERSION)) {
      logRuntime(`[Updater] Update ${info.version} is not newer than current ${CURRENT_VERSION}, skipping`)
      return
    }
    if (isSkipped(info.version)) {
      logRuntime(`[Updater] Update ${info.version} skipped by user preference`)
      sendToRenderer("update:status", { status: "skipped", version: info.version })
      return
    }
    logRuntime(`[Updater] Update available: ${info.version}`)
    pendingUpdate = info
    sendToRenderer("update:status", {
      status: "available",
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: normalizeReleaseNotes(info),
      size: totalSizeBytes(info),
      forced: settings.forced,
    })
    if (settings.autoDownload) {
      void autoUpdater.downloadUpdate().catch((err) => {
        logRuntime(`[Updater] Auto-download failed: ${err.message}`)
      })
    }
  })

  autoUpdater.on("update-not-available", () => {
    logRuntime("[Updater] No update available")
    pendingUpdate = null
    sendToRenderer("update:status", { status: "not-available" })
  })

  autoUpdater.on("download-progress", (progress) => {
    sendToRenderer("update:progress", {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
    logRuntime(`[Updater] Update downloaded: ${info.version}`)
    updateDownloaded = true
    pendingUpdate = info
    isDownloading = false
    sendToRenderer("update:status", {
      status: "downloaded",
      version: info.version,
      releaseNotes: normalizeReleaseNotes(info),
      size: totalSizeBytes(info),
    })
  })

  autoUpdater.on("error", (err) => {
    logRuntime(`[Updater] Error: ${err.message}`)
    isDownloading = false
    const code: UpdateErrorCode = /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|network|socket/i.test(err.message)
      ? "NETWORK"
      : "UNKNOWN"
    sendToRenderer("update:status", { status: "error", code, error: err.message })
  })

  ipcMain.handle("update:settings-get", async () => {
    return loadSettings()
  })

  ipcMain.handle("update:settings-set", async (_event, patch: Partial<UpdateSettings>) => {
    const current = await loadSettings()
    const next: UpdateSettings = {
      channel: patch.channel === "beta" || patch.channel === "stable" ? patch.channel : current.channel,
      autoCheck: typeof patch.autoCheck === "boolean" ? patch.autoCheck : current.autoCheck,
      autoDownload: typeof patch.autoDownload === "boolean" ? patch.autoDownload : current.autoDownload,
      skipVersion: "skipVersion" in patch ? (typeof patch.skipVersion === "string" ? patch.skipVersion : null) : current.skipVersion,
      forced: typeof patch.forced === "boolean" ? patch.forced : current.forced,
      checkIntervalHours:
        typeof patch.checkIntervalHours === "number" && patch.checkIntervalHours >= 1
          ? Math.min(168, Math.round(patch.checkIntervalHours))
          : current.checkIntervalHours,
      feedUrlOverride:
        "feedUrlOverride" in patch
          ? (typeof patch.feedUrlOverride === "string" && patch.feedUrlOverride.trim() ? patch.feedUrlOverride.trim() : null)
          : current.feedUrlOverride,
    }
    await persistSettings(next)
    applyFeedUrl()
    restartCheckTimer()
    return next
  })

  ipcMain.handle("update:check", async () => {
    const current = await loadSettings()
    if (isLaunchActive()) {
      logRuntime("[Updater] Update check blocked: Minecraft is running")
      return { available: false, code: "GAME_RUNNING" as UpdateErrorCode }
    }
    try {
      applyFeedUrl()
      const result = await autoUpdater.checkForUpdates()
      const info = result?.updateInfo
      if (!info) return { available: false }
      if (!isVersionNewer(info.version, CURRENT_VERSION)) return { available: false }
      if (isSkipped(info.version)) {
        return { available: false, skipped: true, version: info.version }
      }
      return { available: true, version: info.version, forced: current.forced }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const code: UpdateErrorCode = /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|network|socket/i.test(message)
        ? "NETWORK"
        : "UNKNOWN"
      return { available: false, code, error: message }
    }
  })

  ipcMain.handle("update:download", async () => {
    if (!pendingUpdate) return { success: false, code: "NO_UPDATE" as UpdateErrorCode }
    if (isDownloading) return { success: false, code: "DOWNLOAD_BUSY" as UpdateErrorCode }
    if (isLaunchActive()) {
      logRuntime("[Updater] Update download blocked: Minecraft is running")
      return { success: false, code: "GAME_RUNNING" as UpdateErrorCode }
    }
    try {
      isDownloading = true
      await autoUpdater.downloadUpdate()
      isDownloading = false
      return { success: true }
    } catch (err) {
      isDownloading = false
      return { success: false, code: "UNKNOWN" as UpdateErrorCode, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle("update:install", () => {
    if (isLaunchActive()) {
      logRuntime("[Updater] Update install blocked: Minecraft is running")
      return
    }
    logRuntime("[Updater] Installing update and restarting...")
    autoUpdater.quitAndInstall(false, true)
  })

  ipcMain.handle("update:info", async () => {
    const current = await loadSettings()
    return {
      version: pendingUpdate?.version ?? null,
      downloaded: updateDownloaded,
      currentVersion: CURRENT_VERSION,
      releaseNotes: normalizeReleaseNotes(pendingUpdate),
      releaseDate: pendingUpdate?.releaseDate ?? null,
      size: totalSizeBytes(pendingUpdate),
      forced: current.forced,
      skipVersion: current.skipVersion,
      channel: current.channel,
    }
  })

  ipcMain.handle("update:skip-version", async (_event, version: string) => {
    const current = await loadSettings()
    const next: string | null = version || null
    await persistSettings({ ...current, skipVersion: next })
    pendingUpdate = null
    sendToRenderer("update:status", { status: "skipped", version: next })
    return next
  })

  // Отложить = «напомнить позже»: работает в рамках текущей сессии,
  // поэтому хранится в памяти, а не в настройках. Версию пропускает skip.
  ipcMain.handle("update:defer-version", async (_event, version: string) => {
    deferredVersions.add(version)
    sendToRenderer("update:status", { status: "deferred", version })
    return true
  })

  void (async () => {
    const loaded = await loadSettings()
    applyFeedUrl()
    restartCheckTimer()
    if (isDev) {
      logRuntimeDebug(`[Updater] Settings loaded: ${JSON.stringify(loaded)}`)
    }
    if (!isDev && loaded.autoCheck) {
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch((err) => {
          logRuntime(`[Updater] Auto-check failed: ${err.message}`)
        })
      }, 5000)
    }
  })()
}
