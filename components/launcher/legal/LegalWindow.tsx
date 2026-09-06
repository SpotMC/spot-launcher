import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import {
  IconScale,
  IconShieldLock,
  IconCookie,
  IconAlertTriangle,
  IconArrowUp,
  IconX,
} from "@tabler/icons-react"
import { LEGAL_DOCS, type LegalDocId } from "./legal-content"
import { APP_NAME } from "@/lib/app-meta"

const ICONS: Record<string, React.ReactNode> = {
  scale: <IconScale className="w-4 h-4" strokeWidth={1.75} />,
  shield: <IconShieldLock className="w-4 h-4" strokeWidth={1.75} />,

  cookie: <IconCookie className="w-4 h-4" strokeWidth={1.75} />,
  alert: <IconAlertTriangle className="w-4 h-4" strokeWidth={1.75} />,
}

const TITLES: Record<LegalDocId, string> = {
  agreement: "Правила лаунчера и пользовательское соглашение",
  privacy: "Обработка персональных данных и политика конфиденциальности",
  cookie: "Политика использования файлов cookie",
  disclaimer: "Отказ от ответственности",
}

export function LegalWindow() {
  const { t } = useTranslation()
  const [active, setActive] = useState<LegalDocId>("agreement")

  useEffect(() => {
    document.title = `${TITLES[active]} — ${APP_NAME}`
  }, [active])

  const doc = LEGAL_DOCS.find((d) => d.id === active)!

  const close = () => {
    // Закрываем окно через IPC главного процесса; если IPC недоступен
    // (например, окно открыто в обычном браузере), используем window.close().
    window.close()
  }

  return (
    <div className="flex h-screen flex-col bg-[#0d0e13] text-[#e8eaf1]">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/[0.06] bg-[#131419] px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <img src="./spot-logo-mono-2.png" alt="Spot" className="h-8 w-8 shrink-0 object-contain" draggable={false} />
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold leading-tight">{TITLES[active]}</div>
            <div className="text-[11px] text-white/40">Официальные документы · редакция от {doc.lastUpdated}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://spotmc.ru"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden rounded-lg px-3 py-1.5 text-[12px] font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white sm:block"
          >
            spotmc.ru
          </a>
          <button
            type="button"
            onClick={close}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            title="Закрыть"
          >
            <IconX className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
      </header>

      <nav className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-white/[0.06] bg-[#101116] px-5 py-2.5">
        {LEGAL_DOCS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setActive(d.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg border px-3.5 py-2 text-[12.5px] font-medium transition-all",
              active === d.id
                ? "border-[#5a6ff2]/60 bg-[#5a6ff2]/15 text-white"
                : "border-white/[0.06] bg-white/[0.02] text-white/60 hover:border-white/15 hover:text-white"
            )}
          >
            <span className="text-[#8d9ff5]">{ICONS[d.icon]}</span>
            {TITLES[d.id]}
          </button>
        ))}
      </nav>

      <div data-legal-scroll={active} className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="rounded-xl border border-white/[0.06] bg-[#16171c] p-5">
            <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-[#8d9ff5]">{ICONS[doc.icon]}</span>
                <h3 className="text-[16px] font-semibold">{TITLES[active]}</h3>
              </div>
              <span className="shrink-0 text-[11px] text-white/40">Редакция от {doc.lastUpdated}</span>
            </div>

            <div className="mt-4 space-y-6">
              {doc.sections.map((s, i) => (
                <div key={i}>
                  <h4 className="mb-2 text-[15px] font-semibold">{s.title}</h4>
                  {s.paragraphs.map((p, j) => (
                    <p key={j} className="mb-2.5 text-[13.5px] leading-6 text-white/65">
                      {p}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-white/[0.06] bg-[#101116] px-5 py-2.5">
        <span className="text-[11.5px] text-white/35">
          {APP_NAME} © {new Date().getFullYear()} · Документы подготовлены в соответствии с законодательством РФ
        </span>
        <button
          type="button"
          onClick={() => {
            const scroller = document.querySelector(`[data-legal-scroll="${active}"]`)
            scroller?.scrollTo({ top: 0, behavior: "smooth" })
          }}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] text-white/50 transition-colors hover:bg-white/5 hover:text-white"
        >
          <IconArrowUp className="h-3.5 w-3.5" strokeWidth={2} />
          {t("settings.legal.toTop")}
        </button>
      </footer>
    </div>
  )
}
