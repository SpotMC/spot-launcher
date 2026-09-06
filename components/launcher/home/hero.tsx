interface HeroProps {
  onJoinServer?: () => void
  serverStats?: { online: boolean; players: number; max: number } | null
}

const WEBSITE_URL = "https://spotmc.ru"

export function Hero({ onJoinServer, serverStats }: HeroProps) {
  return (
    <div className="relative h-[280px] flex-shrink-0 overflow-hidden rounded-xl border border-white/[0.08]">
      <div className="absolute inset-0">
        <img src="./spot-banner.png" alt="Spot Launcher" className="h-full w-full object-cover" draggable={false} />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0b0e]/90 via-[#0a0b0e]/40 to-transparent" />
      </div>

      <div className="relative z-10 flex h-full flex-col justify-center gap-4 p-6">
        <div>
          <h1 className="text-[28px] font-bold text-white tracking-wide drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">Spot Launcher</h1>
          <p className="mt-1 text-[14px] text-white/80 drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)]">Играйте на нашем сервере</p>
          {serverStats && (
            <p className="mt-1 text-[12px] text-emerald-300 drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)]">
              {serverStats.online ? `Онлайн: ${serverStats.players} / ${serverStats.max}` : "Сервер оффлайн"}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onJoinServer}
            className="rounded-lg bg-[#5a6ff2] px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#6c7ff6]"
          >
            Играть на нашем сервере
          </button>
          <a
            href={WEBSITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-white/30 bg-white/5 px-5 py-2.5 text-[13px] font-medium text-white/90 backdrop-blur-sm transition-colors hover:bg-white/15"
          >
            Подробнее
          </a>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#5a6ff2]/40 to-transparent" />
    </div>
  )
}
