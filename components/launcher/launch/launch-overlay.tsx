import { createPortal } from "react-dom"
import { useEffect, useMemo, useRef } from "react"
import { useLaunchLogs } from "@/src/LaunchLogsContext"

export function LaunchOverlay() {
  const { logs, launchUi } = useLaunchLogs()
  const logEndRef = useRef<HTMLDivElement | null>(null)

  const visible = launchUi.isLaunching || launchUi.phase === "installing" || launchUi.phase === "launching"

  useEffect(() => {
    if (visible && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "auto", block: "end" })
    }
  }, [visible, logs.length])

  const stageText = useMemo(() => {
    if (launchUi.status) return launchUi.status
    if (launchUi.phase === "installing") return "Установка Minecraft..."
    if (launchUi.phase === "launching") return "Запуск Minecraft..."
    return "Подготовка..."
  }, [launchUi.phase, launchUi.status])

  const progress = typeof launchUi.progress === "number" ? Math.max(0, Math.min(100, Math.round(launchUi.progress))) : null

  if (!visible) return null

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0a0b0e] px-4">
      <div className="pointer-events-none absolute -top-32 -left-24 h-[460px] w-[520px] rounded-full bg-[#8d9ff5]/[0.06] blur-[120px]" />
      <div className="flex w-full max-w-3xl flex-col">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5a6ff2]/15">
            <span className="text-lg font-black text-[#5a6ff2]">S</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Spot Launcher</h1>
            <p className="text-sm text-white/40">Загрузка и запуск игры</p>
          </div>
        </div>

        <div className="mb-3 flex items-end justify-between gap-4">
          <p className="truncate text-sm text-white/70">{stageText}</p>
          {progress !== null && (
            <span className="shrink-0 text-2xl font-black tabular-nums text-white">{progress}%</span>
          )}
        </div>

        <div className="mb-3 h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#5a6ff2] to-[#8d9ff5] transition-[width] duration-200"
            style={{ width: `${progress ?? 0}%` }}
          />
        </div>

        {(launchUi.currentFile !== null && launchUi.totalFiles !== null && launchUi.totalFiles > 0) && (
          <div className="mb-4 flex items-center gap-2 text-[12px] text-white/45">
            <span>Файл {launchUi.currentFile} / {launchUi.totalFiles}</span>
            {launchUi.currentFileName && <span className="truncate">{launchUi.currentFileName}</span>}
          </div>
        )}

        <div className="h-[260px] overflow-y-auto rounded-xl border border-white/[0.06] bg-black/40 p-3 font-mono text-[11px] leading-relaxed" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.15) transparent" }}>
          {logs.length === 0 && <p className="text-white/25">Ожидание вывода...</p>}
          {logs.map((entry) => {
            const color = entry.level === "error" ? "text-red-400" : entry.level === "warn" ? "text-amber-300" : entry.level === "debug" ? "text-white/30" : "text-white/65"
            return (
              <div key={entry.id} className={color}>
                {entry.text}
              </div>
            )
          })}
          <div ref={logEndRef} />
        </div>

        <p className="mt-4 text-center text-[11px] text-white/25">Не закрывайте окно во время загрузки</p>
      </div>
    </div>,
    document.body
  )
}
