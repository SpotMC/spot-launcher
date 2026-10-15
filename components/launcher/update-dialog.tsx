import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  IconDownload,
  IconPlayerPlay,
  IconAlertTriangle,
  IconSparkles,
  IconArrowDown,
  IconLoader2,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { APP_VERSION } from "@/lib/app-meta"
import type { UpdateErrorCode } from "@/src/electron"

type DialogStatus = "available" | "downloading" | "downloaded" | "error"

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

export function UpdateDialog() {
  const { t, i18n } = useTranslation()
  const [status, setStatus] = useState<DialogStatus | null>(null)
  const [version, setVersion] = useState<string | null>(null)
  const [releaseNotes, setReleaseNotes] = useState<string | null>(null)
  const [releaseDate, setReleaseDate] = useState<string | null>(null)
  const [size, setSize] = useState<number | null>(null)
  const [progress, setProgress] = useState(0)
  const [transferred, setTransferred] = useState(0)
  const [forced, setForced] = useState(false)
  const [errorCode, setErrorCode] = useState<UpdateErrorCode | undefined>(undefined)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const close = useCallback((defer?: boolean) => {
    if (defer && version) void window.electronAPI?.updateDeferVersion?.(version)
    setDismissed(true)
  }, [version])

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return

    void api.updateInfo?.().then((info) => {
      if (!info) return
      setForced(info.forced)
      if (info.downloaded && info.version) {
        setStatus("downloaded")
        setVersion(info.version)
        setReleaseNotes(info.releaseNotes ?? null)
        setReleaseDate(info.releaseDate ?? null)
        setSize(info.size ?? null)
        setProgress(100)
      }
    })

    const unsubStatus = api.onUpdateStatus((s) => {
      if (s.version) setVersion(s.version)
      if (typeof s.forced === "boolean") setForced(s.forced)
      switch (s.status) {
        case "available":
          setStatus("available")
          setReleaseNotes(s.releaseNotes ?? null)
          setReleaseDate(s.releaseDate ?? null)
          setSize(s.size ?? null)
          setErrorCode(undefined)
          setErrorMsg(null)
          setDismissed(false)
          break
        case "downloaded":
          setStatus("downloaded")
          setProgress(100)
          setReleaseNotes(s.releaseNotes ?? null)
          if (s.size != null) setSize(s.size)
          setDismissed(false)
          break
        case "error":
          setStatus("error")
          setErrorCode(s.code)
          setErrorMsg(s.error ?? null)
          break
        default:
          break
      }
    })

    const unsubProgress = api.onUpdateProgress((p) => {
      setProgress(p.percent)
      setTransferred(p.transferred)
      if (p.total > 0) setSize(p.total)
      setStatus((prev) => (prev === "downloaded" ? prev : "downloading"))
    })

    return () => {
      unsubStatus()
      unsubProgress()
    }
  }, [])

  const handleDownload = useCallback(async () => {
    setBusy(true)
    setProgress(0)
    setErrorCode(undefined)
    setErrorMsg(null)
    setStatus("downloading")
    const result = await window.electronAPI?.updateDownload()
    setBusy(false)
    if (!result?.success) {
      setStatus("error")
      setErrorCode(result?.code)
      setErrorMsg(result?.error ?? null)
    }
  }, [])

  const handleInstall = useCallback(() => {
    void window.electronAPI?.updateInstall()
  }, [])

  const errorLabel = useMemo(() => {
    if (errorCode === "GAME_RUNNING") return t("settings.update.errors.gameRunning")
    if (errorCode === "NO_UPDATE") return t("settings.update.errors.noUpdate")
    if (errorCode === "DOWNLOAD_BUSY") return t("settings.update.errors.downloadBusy")
    if (errorCode === "NETWORK") return t("settings.update.errors.network")
    if (errorCode === "UNKNOWN") return t("settings.update.errors.unknown")
    return errorMsg ?? t("settings.update.errors.unknown")
  }, [errorCode, errorMsg, t])

  if (!status || dismissed) return null

  const isReady = status === "downloaded"
  const isError = status === "error"
  const downloading = status === "downloading" && !isReady

  const headerTitle = isError
    ? t("updateDialog.errorTitle")
    : isReady
      ? t("updateDialog.readyTitle")
      : forced
        ? t("updateDialog.forcedTitle")
        : t("updateDialog.title")

  const headerSubtitle = isError
    ? errorLabel
    : isReady
      ? t("updateDialog.readySubtitle")
      : forced
        ? t("updateDialog.forcedSubtitle")
        : t("updateDialog.subtitle")

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-background/70 backdrop-blur-md animate-in fade-in duration-200"
        onClick={() => { if (!forced && !busy && !downloading) close(true) }}
      />

      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-card/95 shadow-2xl backdrop-blur-2xl animate-in zoom-in-95 fade-in duration-200">
        <div
          className={cn(
            "relative px-6 pt-7 pb-6",
            isError
              ? "bg-gradient-to-br from-red-500/25 via-red-500/10 to-transparent"
              : isReady
                ? "bg-gradient-to-br from-emerald-500/25 via-emerald-500/10 to-transparent"
                : "bg-gradient-to-br from-primary/30 via-primary/10 to-transparent",
          )}
        >
          <div
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 shadow-lg",
              isError ? "bg-red-500/20" : isReady ? "bg-emerald-500/20" : "bg-primary/25",
            )}
          >
            {isError ? (
              <IconAlertTriangle className="h-7 w-7 text-red-400" strokeWidth={2} />
            ) : isReady ? (
              <IconPlayerPlay className="h-7 w-7 text-emerald-400" strokeWidth={2} />
            ) : (
              <IconSparkles className="h-7 w-7 text-primary" strokeWidth={2} />
            )}
          </div>

          <h2 className="mt-5 text-xl font-semibold tracking-tight text-foreground">{headerTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{headerSubtitle}</p>

          {version && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-foreground">
                {t("updateDialog.newVersion", { version })}
              </span>
              {APP_VERSION && APP_VERSION !== version && (
                <span className="text-xs text-muted-foreground">← {APP_VERSION}</span>
              )}
              {size ? (
                <span className="text-xs text-muted-foreground">
                  {t("updateDialog.size")}: {formatBytes(size)}
                </span>
              ) : null}
              {releaseDate ? (
                <span className="text-xs text-muted-foreground">{formatDate(releaseDate, i18n.language)}</span>
              ) : null}
            </div>
          )}
        </div>

        <div className="px-6 py-5">
          {downloading && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <IconLoader2 className="h-4 w-4 animate-spin text-primary" strokeWidth={2} />
                {t("updateDialog.downloading")}
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-300",
                    progress <= 0 && "animate-pulse",
                  )}
                  style={{ width: `${Math.max(progress, progress <= 0 ? 8 : 0)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("settings.update.progress", { percent: Math.round(progress) })}</span>
                <span>{formatBytes(transferred)}</span>
              </div>
            </div>
          )}

          {!downloading && releaseNotes && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("updateDialog.whatsNew")}
              </div>
              <div className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-2xl border border-border bg-background/40 p-3 text-xs leading-relaxed text-muted-foreground">
                {releaseNotes}
              </div>
            </div>
          )}

          {isError && !releaseNotes && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
              {errorLabel}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-background/20 px-6 py-4">
          {!forced && !busy && !downloading && (
            <button
              onClick={() => close(false)}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {t("updateDialog.later")}
            </button>
          )}

          {isError && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <IconDownload className="h-4 w-4" strokeWidth={2} />
              {t("updateDialog.retry")}
            </button>
          )}

          {status === "available" && (
            <button
              onClick={handleDownload}
              disabled={busy}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              <IconArrowDown className="h-4 w-4" strokeWidth={2} />
              {t("updateDialog.download")}
            </button>
          )}

          {isReady && (
            <button
              onClick={handleInstall}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              <IconPlayerPlay className="h-4 w-4" strokeWidth={2} />
              {t("updateDialog.installRestart")}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
