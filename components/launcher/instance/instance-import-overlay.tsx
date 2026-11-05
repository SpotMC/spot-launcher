import { IconAlertTriangle, IconDownload, IconLoader2, IconX } from "@tabler/icons-react"
import { formatBytes } from "@/lib/format-bytes"
import type { ImportProgressState } from "./use-import"

interface InstanceImportOverlayProps {
  importProgress: ImportProgressState | null
  importError: string | null
  isCancelling: boolean
  onCancel: () => void
}

const SOURCE_META: Record<ImportProgressState["source"], { label: string; className: string }> = {
  modrinth: { label: "Modrinth", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
  curseforge: { label: "CurseForge", className: "border-orange-500/30 bg-orange-500/10 text-orange-400" },
  ftb: { label: "FTB", className: "border-sky-500/30 bg-sky-500/10 text-sky-400" },
  local: { label: "Файл", className: "border-violet-500/30 bg-violet-500/10 text-violet-400" },
}

function formatItemName(itemName?: string): string | null {
  const trimmed = itemName?.trim()
  return trimmed ? trimmed : null
}

function formatProgressLabel(message: string, source: ImportProgressState["source"]): string {
  const trimmed = message.trim()
  const isModpack = source === "curseforge" || source === "ftb"
  if (!trimmed) {
    return isModpack ? "Загрузка модпака" : "Загрузка файлов"
  }

  if (/^\d+\s*\/\s*\d+/.test(trimmed)) {
    return isModpack ? "Загрузка модпака" : "Загрузка файлов"
  }

  return trimmed
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value)
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function InstanceImportOverlay({
  importProgress,
  importError,
  isCancelling,
  onCancel,
}: InstanceImportOverlayProps) {
  if (!importProgress) return null

  const isError = Boolean(importError)
  const total = Math.max(importProgress.total, 1)
  const current = Math.min(Math.max(importProgress.current, 0), total)
  const progressPercent = clampPercent((current / total) * 100)
  const currentItem = formatItemName(importProgress.itemName)
  const progressLabel = formatProgressLabel(importProgress.message, importProgress.source)
  const sourceMeta = SOURCE_META[importProgress.source] ?? SOURCE_META.local

  const fileTotal = importProgress.fileTotal ?? 0
  const fileCurrent = importProgress.fileCurrent ?? 0
  const hasFileProgress = fileTotal > 0
  const filePercent = hasFileProgress ? clampPercent((fileCurrent / fileTotal) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/78 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Импорт сборки"
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Импорт модпака</p>
            <h3 className="mt-1 truncate text-lg font-semibold text-foreground">
              {isError ? "Не удалось импортировать" : "Загрузка сборки"}
            </h3>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium ${sourceMeta.className}`}>
            {sourceMeta.label}
          </span>
        </div>

        <div className="space-y-4 px-5 py-5">
          {isError ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3">
                <IconAlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-destructive">Загрузка прервана</p>
                  <p className="mt-1 break-words text-sm text-destructive/90">{importError}</p>
                </div>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                Уже скачанные файлы сохранены. Повторите импорт — загрузка продолжится с недостающих файлов.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                  <IconLoader2 className="h-5 w-5 animate-spin" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{progressLabel}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {formatCount(current)} из {formatCount(total)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{progressPercent}%</span>
              </div>

              <div className="space-y-1.5">
                <div
                  className="h-2 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressPercent}
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-[width] duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Общий прогресс</span>
                  <span className="tabular-nums">{formatCount(current)}/{formatCount(total)}</span>
                </div>
              </div>

              {hasFileProgress && (
                <div className="space-y-1.5 rounded-xl border border-border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <IconDownload className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{currentItem ?? "Скачивание файла"}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">{filePercent}%</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/60 transition-[width] duration-200"
                      style={{ width: `${filePercent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="truncate tabular-nums">
                      {formatBytes(fileCurrent)} из {formatBytes(fileTotal)}
                    </span>
                    <span className="shrink-0 tabular-nums">{formatBytes(Math.max(fileTotal - fileCurrent, 0))} осталось</span>
                  </div>
                </div>
              )}

              {currentItem && !hasFileProgress && (
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Сейчас скачивается</p>
                  <p className="mt-2 truncate text-sm text-foreground" title={currentItem}>{currentItem}</p>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={isCancelling && !isError}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isError || isCancelling ? <IconX className="h-4 w-4" /> : null}
              {isError ? "Закрыть" : isCancelling ? "Отмена..." : "Отменить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
