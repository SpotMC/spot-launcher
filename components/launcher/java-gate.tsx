import { useCallback, useEffect, useRef, useState } from "react"
import { IconCpu, IconDownload, IconLoader2, IconRotate, IconAlertTriangle, IconCheck } from "@tabler/icons-react"

type JavaStatus =
  | { kind: "checking" }
  | { kind: "found"; label?: string }
  | { kind: "missing" }
  | { kind: "installing"; percent: number | null; message: string }
  | { kind: "error"; error: string }

export function JavaGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<JavaStatus>({ kind: "checking" })
  const startedRef = useRef(false)

  const runCheck = useCallback(async () => {
    setStatus({ kind: "checking" })
    try {
      const result = await window.electronAPI?.checkJava()
      if (!result || result.installed) {
        setStatus({ kind: "found", label: result?.label })
      } else {
        setStatus({ kind: "missing" })
      }
    } catch {
      setStatus({ kind: "missing" })
    }
  }, [])

  const runInstall = useCallback(async () => {
    setStatus({ kind: "installing", percent: 0, message: "Подготовка..." })
    try {
      const result = await window.electronAPI?.installJava()
      if (result?.success) {
        await runCheck()
      } else {
        setStatus({ kind: "error", error: result?.error || "Не удалось установить Java" })
      }
    } catch (e) {
      setStatus({ kind: "error", error: e instanceof Error ? e.message : "Не удалось установить Java" })
    }
  }, [runCheck])

  useEffect(() => {
    void runCheck()
  }, [runCheck])

  useEffect(() => {
    const off = window.electronAPI?.onJavaInstallProgress?.((progress) => {
      setStatus({
        kind: "installing",
        percent: progress.percent,
        message: progress.message || "Установка Java...",
      })
    })
    return () => off?.()
  }, [])

  // Автоматически запускаем установку, если Java не найдена.
  useEffect(() => {
    if (status.kind === "missing" && !startedRef.current) {
      startedRef.current = true
      void runInstall()
    }
  }, [status, runInstall])

  if (status.kind === "found") {
    return <>{children}</>
  }

  const installing = status.kind === "installing"

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#0e0f12] p-6">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#8d9ff5]/10 blur-[100px] animate-aurora" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[360px] w-[360px] rounded-full bg-[#b9c4fa]/8 blur-[90px] animate-spot-glow" />

      <div className="w-full max-w-md animate-spot-fade-scale">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 text-center backdrop-blur-sm">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#8d9ff5]/15 text-[#8d9ff5]">
            {status.kind === "checking" ? (
              <IconLoader2 className="h-8 w-8 animate-spin" />
            ) : installing ? (
              <IconDownload className="h-8 w-8 animate-bounce" />
            ) : status.kind === "error" ? (
              <IconAlertTriangle className="h-8 w-8 text-red-400" />
            ) : (
              <IconCpu className="h-8 w-8" />
            )}
          </div>

          {status.kind === "checking" && (
            <>
              <h2 className="text-xl font-bold text-white">Проверка Java</h2>
              <p className="mt-2 text-sm text-white/40">Проверяем установку Java на вашем устройстве...</p>
            </>
          )}

          {status.kind === "missing" && (
            <>
              <h2 className="text-xl font-bold text-white">Java не найдена</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/40">
                Для запуска Minecraft нужна Java. Устанавливаем её автоматически...
              </p>
              <div className="mt-5 flex justify-center">
                <div className="flex items-center gap-2 text-xs font-medium text-[#8d9ff5]">
                  <IconLoader2 className="h-4 w-4 animate-spin" />
                  Начинаем установку
                </div>
              </div>
            </>
          )}

          {installing && (
            <>
              <h2 className="text-xl font-bold text-white">Установка Java</h2>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#8d9ff5]/10 px-3 py-1 text-[11px] font-semibold text-[#8d9ff5]">
                <IconCpu className="h-3.5 w-3.5" />
                Java 21 LTS · Adoptium
              </div>
              <p className="mt-3 text-sm text-white/40">{status.message}</p>
              {status.percent !== null ? (
                <div className="mt-5">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#7d9bfa] to-[#8d9ff5] transition-[width] duration-200"
                      style={{ width: `${Math.max(0, Math.min(100, status.percent))}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-white/40">Скачивание и установка Java</p>
                    <p className="text-xs font-semibold text-[#8d9ff5] tabular-nums">{status.percent}%</p>
                  </div>
                </div>
              ) : (
                <div className="mt-5">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.07]">
                    <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-[#7d9bfa] to-[#8d9ff5] animate-[indeterminate-bar_1.1s_ease-in-out_infinite]" />
                  </div>
                  <p className="mt-2 text-xs text-white/40">Распаковка и подготовка...</p>
                </div>
              )}
            </>
          )}

          {status.kind === "error" && (
            <>
              <h2 className="text-xl font-bold text-white">Не удалось установить Java</h2>
              <p className="mt-2 text-sm text-white/40">{status.error}</p>
              <button
                type="button"
                onClick={() => void runInstall()}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#8d9ff5] px-5 py-3 text-sm font-bold text-white transition-all hover:bg-[#b9c4fa]"
              >
                <IconRotate className="h-4 w-4" strokeWidth={2.5} />
                Повторить
              </button>
            </>
          )}
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-white/25">
          <IconCheck className="h-3.5 w-3.5" />
          Всё происходит автоматически, без вашего участия
        </p>
      </div>
    </div>
  )
}
