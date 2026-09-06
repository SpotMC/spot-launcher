import { useEffect, useRef, useState, type CSSProperties } from "react"
import { IconBell, IconCheck, IconLoader2, IconPlayerPlay, IconX } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { useActivityCenter, type ActivityNotification } from "./ActivityCenterContext"

const dragRegionStyle = { WebkitAppRegion: "drag" } as CSSProperties
const noDragStyle = { WebkitAppRegion: "no-drag" } as CSSProperties

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000))
  if (diffMinutes < 1) return "только что"
  if (diffMinutes < 60) return `${diffMinutes} мин назад`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} ч назад`
  return `${Math.floor(diffHours / 24)} д назад`
}

function NotificationIcon({ notification }: { notification: ActivityNotification }) {
  if (notification.kind === "success") return <IconCheck className="h-3.5 w-3.5" />
  if (notification.kind === "error") return <IconX className="h-3.5 w-3.5" />
  if (notification.kind === "progress") {
    return notification.source === "launch"
      ? <IconPlayerPlay className="h-3.5 w-3.5" />
      : <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
  }
  return <IconBell className="h-3.5 w-3.5" />
}

export function TitleBar() {
  const { notifications, unreadCount, isOpen, setIsOpen, toggleOpen, markAllRead } = useActivityCenter()
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    window.electronAPI?.isMaximized().then(setIsMaximized)
    const handler = (_e: unknown, maximized: boolean) => setIsMaximized(maximized)
    window.addEventListener("spot:maximized", handler as EventListener)
    return () => window.removeEventListener("spot:maximized", handler as EventListener)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    markAllRead()
    const handlePointerDown = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    window.addEventListener("mousedown", handlePointerDown)
    return () => window.removeEventListener("mousedown", handlePointerDown)
  }, [isOpen, markAllRead, setIsOpen])

  return (
    <header
      className="relative z-50 flex h-[34px] items-center justify-between bg-[#1a1b20] px-0 shrink-0 select-none"
      style={dragRegionStyle}
    >
      {/* Left: logo + title */}
      <div className="flex items-center gap-2 pl-3">
        <img
          src="./spot-logo-mono-2.png"
          alt="Spot"
          className="h-[14px] w-auto"
          style={noDragStyle}
          draggable={false}
        />
        <span className="text-[12px] font-medium text-white/70 tracking-wide">Spot Launcher</span>
      </div>

      {/* Right: notifications + window controls */}
      <div className="flex items-center h-full" style={noDragStyle}>
        {/* Notification bell */}
        <button
          type="button"
          onClick={toggleOpen}
          className={cn(
            "relative flex h-full w-[42px] items-center justify-center text-white/40 transition-all duration-150 hover:bg-white/[0.06] hover:text-white/70",
            isOpen && "bg-white/[0.06] text-white/70",
          )}
        >
          <IconBell className="h-[15px] w-[15px]" strokeWidth={1.75} />
          {unreadCount > 0 && (
            <span className="absolute right-2 top-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#8d9ff5] px-1 text-[9px] font-bold leading-none text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* Separator */}
        <div className="h-[18px] w-px bg-white/[0.08]" />

        {/* Window controls - Windows style */}
        <button
          type="button"
          onClick={() => window.electronAPI?.minimize()}
          className="flex h-full w-[46px] items-center justify-center text-white/50 transition-colors duration-100 hover:bg-white/[0.08]"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor"><rect width="10" height="1" /></svg>
        </button>
        <button
          type="button"
          onClick={() => window.electronAPI?.maximize()}
          className="flex h-full w-[46px] items-center justify-center text-white/50 transition-colors duration-100 hover:bg-white/[0.08]"
        >
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="2.5" y="0" width="7" height="7" rx="0.5" />
              <rect x="0" y="2.5" width="7" height="7" rx="0.5" fill="#1a1b20" />
              <rect x="0" y="2.5" width="7" height="7" rx="0.5" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="0.5" y="0.5" width="9" height="9" rx="0.5" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={() => window.electronAPI?.close()}
          className="flex h-full w-[46px] items-center justify-center text-white/50 transition-colors duration-100 hover:bg-[#c42b1c] hover:text-white"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M1 1l8 8M9 1l-8 8" />
          </svg>
        </button>
      </div>

      {/* Notification panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-[360px] overflow-hidden rounded-xl border border-white/[0.08] bg-[#1a1b20]/98 shadow-[0_16px_48px_rgba(0,0,0,0.6)] backdrop-blur-2xl" style={noDragStyle}>
          <div className="border-b border-white/[0.06] px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-white">Уведомления</p>
                <p className="mt-0.5 text-[11px] text-white/40">Запуски, импорт и другие события</p>
              </div>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[#8d9ff5]/20 px-2 py-0.5 text-[11px] font-medium text-[#8d9ff5]">
                  {unreadCount} нов.
                </span>
              )}
            </div>
          </div>

          <div className="max-h-[380px] overflow-y-auto p-2">
            {notifications.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-8 text-center">
                <p className="text-[13px] font-medium text-white/60">Пока уведомлений нет</p>
                <p className="mt-1 text-[11px] text-white/30">Здесь будут события запуска</p>
              </div>
            ) : (
              <div className="space-y-1">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      "rounded-lg px-3 py-2.5 transition-colors",
                      notification.read ? "bg-transparent" : "bg-[#8d9ff5]/[0.06]",
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={cn(
                          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                          notification.kind === "error" && "bg-red-500/15 text-red-400",
                          notification.kind === "success" && "bg-emerald-500/15 text-emerald-400",
                          notification.kind === "progress" && "bg-[#8d9ff5]/15 text-[#8d9ff5]",
                          notification.kind === "info" && "bg-white/[0.06] text-white/40",
                        )}
                      >
                        <NotificationIcon notification={notification} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[12px] font-medium text-white">{notification.title}</p>
                          <span className="shrink-0 text-[10px] text-white/30">
                            {formatRelativeTime(notification.timestamp)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] leading-4 text-white/40">{notification.message}</p>

                        {typeof notification.progress === "number" && (
                          <div className="mt-2">
                            <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                              <div
                                className="h-full rounded-full bg-[#8d9ff5] transition-[width] duration-300"
                                style={{ width: `${notification.progress}%` }}
                              />
                            </div>
                            <div className="mt-1 flex items-center justify-between text-[10px] text-white/30">
                              <span>{notification.source === "launch" ? "Запуск" : "Импорт"}</span>
                              <span>{notification.progress}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
