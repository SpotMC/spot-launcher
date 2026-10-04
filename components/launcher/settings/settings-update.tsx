import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { IconRefresh, IconDownload, IconCheck, IconPlayerPlay, IconClock, IconBan, IconAlertTriangle } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { APP_VERSION } from "@/lib/app-meta"
import type { UpdateSettings, UpdateErrorCode, UpdateChannel } from "@/src/electron"

type UpdateStatus = "idle" | "checking" | "available" | "downloaded" | "error" | "not-available" | "skipped" | "deferred"

const DEFAULT_SETTINGS: UpdateSettings = {
  channel: "stable",
  autoCheck: true,
  autoDownload: false,
  skipVersion: null,
  forced: false,
  checkIntervalHours: 6,
  feedUrlOverride: null,
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return ""
  const units = ["B", "KB", "MB", "GB"]
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" })
}

export function SettingsUpdate() {
  const { t, i18n } = useTranslation()
  const [status, setStatus] = useState<UpdateStatus>("idle")
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [transferred, setTransferred] = useState(0)
  const [totalSize, setTotalSize] = useState<number | null>(null)
  const [releaseNotes, setReleaseNotes] = useState<string | null>(null)
  const [releaseDate, setReleaseDate] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<UpdateErrorCode | undefined>(undefined)
  const [forced, setForced] = useState(false)
  const [settings, setSettings] = useState<UpdateSettings>(DEFAULT_SETTINGS)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [feedDraft, setFeedDraft] = useState("")

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return
    void api.updateSettingsGet?.().then((s) => {
      if (s) {
        setSettings(s)
        setFeedDraft(s.feedUrlOverride ?? "")
      }
    })
    void api.updateInfo?.().then((info) => {
      if (!info) return
      setForced(info.forced)
      if (info.downloaded && info.version) {
        setStatus("downloaded")
        setRemoteVersion(info.version)
      }
    })
  }, [])

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return
    const unsubStatus = api.onUpdateStatus((s) => {
      if (s.version) setRemoteVersion(s.version)
      if (typeof s.forced === "boolean") setForced(s.forced)
      switch (s.status) {
        case "available":
          setStatus("available")
          setReleaseNotes(s.releaseNotes ?? null)
          setReleaseDate(s.releaseDate ?? null)
          setTotalSize(s.size ?? null)
          setErrorMsg(null)
          setErrorCode(undefined)
          break
        case "downloaded":
          setStatus("downloaded")
          setReleaseNotes(s.releaseNotes ?? null)
          setTotalSize(s.size ?? null)
          setProgress(100)
          break
        case "checking":
          setStatus("checking")
          break
        case "not-available":
          setStatus("not-available")
          break
        case "skipped":
          setStatus("skipped")
          break
        case "deferred":
          setStatus("deferred")
          break
        case "error":
          setStatus("error")
          setErrorCode(s.code)
          setErrorMsg(s.error ?? null)
          break
      }
    })
    const unsubProgress = api.onUpdateProgress((p) => {
      setProgress(p.percent)
      setTransferred(p.transferred)
      if (p.total > 0) setTotalSize(p.total)
    })
    return () => { unsubStatus(); unsubProgress() }
  }, [])

  const errorLabel = useCallback(() => {
    if (errorCode === "GAME_RUNNING") return t("settings.update.errors.gameRunning")
    if (errorCode === "NO_UPDATE") return t("settings.update.errors.noUpdate")
    if (errorCode === "DOWNLOAD_BUSY") return t("settings.update.errors.downloadBusy")
    if (errorCode === "NETWORK") return t("settings.update.errors.network")
    if (errorCode === "UNKNOWN") return t("settings.update.errors.unknown")
    return errorMsg ?? t("settings.update.errors.unknown")
  }, [errorCode, errorMsg, t])

  const patchSettings = useCallback(async (patch: Partial<UpdateSettings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    const saved = await window.electronAPI?.updateSettingsSet?.(patch)
    if (saved) {
      setSettings(saved)
      setFeedDraft(saved.feedUrlOverride ?? "")
    }
  }, [settings])

  const handleCheck = useCallback(async () => {
    setStatus("checking")
    setErrorMsg(null)
    setErrorCode(undefined)
    setProgress(0)
    const result = await window.electronAPI?.updateCheck()
    if (!result) {
      setStatus("idle")
      return
    }
    if (result.skipped) {
      setStatus("skipped")
      setRemoteVersion(result.version ?? null)
      return
    }
    if (result.available) {
      setStatus("available")
      setRemoteVersion(result.version ?? null)
      void window.electronAPI?.updateInfo?.().then((info) => {
        if (!info) return
        setReleaseNotes(info.releaseNotes ?? null)
        setReleaseDate(info.releaseDate ?? null)
        setTotalSize(info.size ?? null)
      })
    } else if (result.code) {
      setStatus("error")
      setErrorCode(result.code)
      setErrorMsg(result.error ?? null)
    } else {
      setStatus("not-available")
    }
  }, [])

  const handleDownload = useCallback(async () => {
    setProgress(0)
    const result = await window.electronAPI?.updateDownload()
    if (!result?.success) {
      setStatus("error")
      setErrorCode(result?.code)
      setErrorMsg(result?.error ?? null)
    }
  }, [])

  const handleInstall = useCallback(() => {
    void window.electronAPI?.updateInstall()
  }, [])

  const handleSkip = useCallback(async () => {
    if (!remoteVersion) return
    await window.electronAPI?.updateSkipVersion?.(remoteVersion)
    await patchSettings({ skipVersion: remoteVersion })
    setStatus("skipped")
  }, [remoteVersion, patchSettings])

  const handleDefer = useCallback(async () => {
    if (!remoteVersion) return
    await window.electronAPI?.updateDeferVersion?.(remoteVersion)
    setStatus("deferred")
  }, [remoteVersion])

  const handleUnskip = useCallback(async () => {
    await window.electronAPI?.updateSkipVersion?.("")
    await patchSettings({ skipVersion: null })
    if (status === "skipped") setStatus("idle")
  }, [status, patchSettings])

  const downloading = progress > 0 && progress < 100 && (status === "available" || status === "checking")

  const statusLabel = (() => {
    switch (status) {
      case "checking": return t("settings.update.status.checking")
      case "available": return t("settings.update.status.available", { version: remoteVersion })
      case "downloaded": return t("settings.update.status.downloaded", { version: remoteVersion })
      case "not-available": return t("settings.update.status.notAvailable")
      case "skipped": return t("settings.update.status.skipped", { version: remoteVersion })
      case "deferred": return t("settings.update.status.deferred")
      case "error": return t("settings.update.status.error", { message: errorLabel() })
      default: return null
    }
  })()

  return (
    <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="font-medium text-foreground">{t("settings.update.title")}</div>
          <p className="text-sm text-muted-foreground mt-1">
            {t("settings.update.currentVersion", { version: APP_VERSION })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {status === "idle" && (
            <button
              onClick={handleCheck}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              <IconRefresh className="w-4 h-4" strokeWidth={2} />
              {t("settings.update.check")}
            </button>
          )}
          {status === "checking" && (
            <button disabled className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted text-muted-foreground font-medium">
              <IconRefresh className="w-4 h-4 animate-spin" strokeWidth={2} />
              {t("settings.update.check")}
            </button>
          )}
          {status === "available" && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              <IconDownload className="w-4 h-4" strokeWidth={2} />
              {t("settings.update.download")}
            </button>
          )}
          {status === "downloaded" && (
            <button
              onClick={handleInstall}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 transition-colors"
            >
              <IconPlayerPlay className="w-4 h-4" strokeWidth={2} />
              {t("settings.update.install")}
            </button>
          )}
          {(status === "not-available" || status === "error" || status === "skipped" || status === "deferred" || status === "idle") && (
            <button
              onClick={handleCheck}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted text-muted-foreground font-medium hover:bg-muted/80 transition-colors"
            >
              <IconRefresh className="w-4 h-4" strokeWidth={2} />
              {t("settings.update.checkAgain")}
            </button>
          )}
        </div>
      </div>

      {forced && (status === "available" || status === "deferred") && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <IconAlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" strokeWidth={2} />
          <p className="text-xs text-red-300">{t("settings.update.forcedWarning")}</p>
        </div>
      )}

      {downloading && (
        <div className="space-y-2">
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("settings.update.progress", { percent: Math.round(progress) })}</span>
            <span>{formatBytes(transferred > 0 ? transferred : totalSize)}</span>
          </div>
        </div>
      )}

      {(status === "available" || status === "downloaded") && (
        <div className="space-y-3 pt-3 border-t border-border">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {releaseDate && (
              <span>{t("settings.update.released", { date: formatDate(releaseDate, i18n.language) })}</span>
            )}
            {totalSize ? <span>{formatBytes(totalSize)}</span> : null}
          </div>

          {releaseNotes && (
            <details className="rounded-lg border border-border bg-background/40 overflow-hidden">
              <summary className="px-3 py-2 text-xs font-medium text-foreground cursor-pointer select-none">
                {t("settings.update.changelog")}
              </summary>
              <div className="px-3 pb-3 pt-1 text-xs text-muted-foreground whitespace-pre-wrap break-words">
                {releaseNotes}
              </div>
            </details>
          )}

          {status === "available" && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleDefer}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-medium hover:bg-muted/80 transition-colors"
              >
                <IconClock className="w-3.5 h-3.5" strokeWidth={2} />
                {t("settings.update.defer")}
              </button>
              <button
                onClick={handleSkip}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-medium hover:bg-muted/80 transition-colors"
              >
                <IconBan className="w-3.5 h-3.5" strokeWidth={2} />
                {t("settings.update.skipVersion")}
              </button>
            </div>
          )}
        </div>
      )}

      {statusLabel && (
        <p className={cn(
          "text-sm",
          status === "error" ? "text-red-400" :
          status === "downloaded" ? "text-green-400" :
          "text-muted-foreground"
        )}>
          {statusLabel}
        </p>
      )}

      {settings.skipVersion && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/40 border border-border">
          <p className="text-xs text-muted-foreground">
            {t("settings.update.skippedVersion", { version: settings.skipVersion })}
          </p>
          <button
            onClick={handleUnskip}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            {t("settings.update.unskip")}
          </button>
        </div>
      )}

      <div className="pt-4 border-t border-border space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">{t("settings.update.channel")}</div>
            <p className="text-xs text-muted-foreground mt-0.5">{t("settings.update.channelDesc")}</p>
          </div>
          <div className="flex gap-1 shrink-0 p-1 rounded-lg bg-muted">
            {(["stable", "beta"] as UpdateChannel[]).map((c) => (
              <button
                key={c}
                onClick={() => void patchSettings({ channel: c })}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  settings.channel === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t(`settings.update.channels.${c}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">{t("settings.update.autoCheck")}</div>
            <p className="text-xs text-muted-foreground mt-0.5">{t("settings.update.autoCheckDesc")}</p>
          </div>
          <button
            onClick={() => void patchSettings({ autoCheck: !settings.autoCheck })}
            className={cn(
              "relative w-14 h-8 shrink-0 rounded-full transition-all duration-300",
              settings.autoCheck ? "bg-primary" : "bg-muted"
            )}
            aria-label={t("settings.update.autoCheck")}
          >
            <span className={cn("absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300", settings.autoCheck ? "left-7" : "left-1")} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">{t("settings.update.autoDownload")}</div>
            <p className="text-xs text-muted-foreground mt-0.5">{t("settings.update.autoDownloadDesc")}</p>
          </div>
          <button
            onClick={() => void patchSettings({ autoDownload: !settings.autoDownload })}
            className={cn(
              "relative w-14 h-8 shrink-0 rounded-full transition-all duration-300",
              settings.autoDownload ? "bg-primary" : "bg-muted"
            )}
            aria-label={t("settings.update.autoDownload")}
          >
            <span className={cn("absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300", settings.autoDownload ? "left-7" : "left-1")} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">{t("settings.update.forced")}</div>
            <p className="text-xs text-muted-foreground mt-0.5">{t("settings.update.forcedDesc")}</p>
          </div>
          <button
            onClick={() => void patchSettings({ forced: !settings.forced })}
            className={cn(
              "relative w-14 h-8 shrink-0 rounded-full transition-all duration-300",
              settings.forced ? "bg-primary" : "bg-muted"
            )}
            aria-label={t("settings.update.forced")}
          >
            <span className={cn("absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300", settings.forced ? "left-7" : "left-1")} />
          </button>
        </div>

        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-xs font-medium text-primary hover:underline transition-colors"
        >
          {showAdvanced ? t("settings.update.hideAdvanced") : t("settings.update.showAdvanced")}
        </button>

        {showAdvanced && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">{t("settings.update.interval")}</div>
                <p className="text-xs text-muted-foreground mt-0.5">{t("settings.update.intervalDesc")}</p>
              </div>
              <select
                value={settings.checkIntervalHours}
                onChange={(e) => void patchSettings({ checkIntervalHours: Number(e.target.value) })}
                className="shrink-0 px-3 py-2 rounded-lg bg-muted text-foreground text-sm border border-border focus:outline-none"
              >
                {[1, 3, 6, 12, 24, 48, 168].map((h) => (
                  <option key={h} value={h}>{t("settings.update.hours", { count: h })}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-sm font-medium text-foreground">{t("settings.update.feedUrl")}</div>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">{t("settings.update.feedUrlDesc")}</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={feedDraft}
                  onChange={(e) => setFeedDraft(e.target.value)}
                  placeholder={t("settings.update.feedUrlPlaceholder")}
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-muted text-foreground text-sm border border-border focus:outline-none"
                />
                <button
                  onClick={() => void patchSettings({ feedUrlOverride: feedDraft.trim() || null })}
                  className="shrink-0 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  {t("settings.update.save")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
