import { createPortal } from "react-dom"
import { useEffect, useMemo, useRef, useState } from "react"
import { IconChevronDown } from "@tabler/icons-react"
import { useLaunchLogs } from "@/src/LaunchLogsContext"

export function LaunchOverlay() {
  const { logs, launchUi } = useLaunchLogs()
  const logEndRef = useRef<HTMLDivElement | null>(null)
  const [showLogs, setShowLogs] = useState(false)

  const visible = launchUi.isLaunching || launchUi.phase === "installing" || launchUi.phase === "launching"

  useEffect(() => {
    if (visible && showLogs && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "auto", block: "end" })
    }
  }, [visible, showLogs, logs.length])

  const stageText = useMemo(() => {
    if (launchUi.status) return launchUi.status
    if (launchUi.phase === "installing") return "Установка Minecraft..."
    if (launchUi.phase === "launching") return "Запуск Minecraft..."
    return "Подготовка..."
  }, [launchUi.phase, launchUi.status])

  const progress = typeof launchUi.progress === "number" ? Math.max(0, Math.min(100, Math.round(launchUi.progress))) : null

  if (!visible) return null

  return createPortal(
    <div className="absolute inset-0 z-[200] flex items-center justify-center bg-[#0a0b0e]/95 px-4">
      <div className="pointer-events-none absolute -top-32 -left-24 h-[460px] w-[520px] rounded-full bg-[#8d9ff5]/[0.06] blur-[120px]" />
      <div className="flex w-full max-w-[420px] flex-col items-center text-center">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5a6ff2]/15">
          <span className="text-lg font-black text-[#5a6ff2]">S</span>
        </div>

        <p className="mb-1.5 min-h-5 truncate text-sm font-medium text-white/70">{stageText}</p>

        {progress !== null && (
          <span className="mb-2.5 text-4xl font-black tabular-nums text-white">
            {progress}
            <span className="ml-1 text-base font-bold text-white/40">%</span>
          </span>
        )}

        <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
          {progress !== null ? (
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#5a6ff2] to-[#8d9ff5] transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          ) : (
            <div className="absolute inset-0 animate-pulse rounded-full bg-white/[0.08]" />
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowLogs((v) => !v)}
          className="mt-4 flex items-center gap-1.5 self-end rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <IconChevronDown className={`h-3.5 w-3.5 transition-transform ${showLogs ? "rotate-180" : ""}`} />
          {showLogs ? "Скрыть журнал" : "Показать журнал"}
        </button>

        {showLogs && (
          <div className="mt-2 h-[180px] w-full overflow-y-auto rounded-xl border border-white/[0.06] bg-black/40 p-3 font-mono text-[11px] leading-relaxed" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.15) transparent" }}>
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
        )}

        <p className="mt-3 text-[11px] text-white/25">Не закрывайте окно во время загрузки</p>
      </div>
    </div>,
    document.body
  )
}
