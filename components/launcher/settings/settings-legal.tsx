import { useState } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import {
  IconScale,
  IconShieldLock,
  IconCookie,
  IconAlertTriangle,
  IconExternalLink,
  IconBook,
  IconChevronRight,
} from "@tabler/icons-react"

const DOCS = [
  { id: "agreement", icon: <IconScale className="w-5 h-5 text-primary" strokeWidth={1.75} />, title: "Правила лаунчера и пользовательское соглашение", desc: "Условия использования лаунчера, обязанности сторон и запрещённые действия." },
  { id: "privacy", icon: <IconShieldLock className="w-5 h-5 text-primary" strokeWidth={1.75} />, title: "Обработка персональных данных", desc: "Какие данные собираются, зачем и как они защищены." },

  { id: "cookie", icon: <IconCookie className="w-5 h-5 text-primary" strokeWidth={1.75} />, title: "Политика использования файлов cookie", desc: "Какие cookie-файлы используются на сайте и как ими управлять." },
  { id: "disclaimer", icon: <IconAlertTriangle className="w-5 h-5 text-primary" strokeWidth={1.75} />, title: "Отказ от ответственности", desc: "Ограничение ответственности администрации и сторонние сервисы." },
]

export function SettingsLegal() {
  const { t } = useTranslation()
  const [opening, setOpening] = useState(false)

  const openDocs = async () => {
    if (opening) return
    setOpening(true)
    try {
      await window.electronAPI?.openLegalWindow?.()
    } catch {}
    setOpening(false)
  }

  return (
    <div className="space-y-4 animate-in fade-in-0 slide-in-from-left-4 duration-300">
      <section className="space-y-3">
        <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
          <IconBook className="w-5 h-5 text-primary" strokeWidth={1.5} />
          {t("settings.legal.title")}
        </h3>

        <button
          type="button"
          onClick={() => void openDocs()}
          disabled={opening}
          className="w-full rounded-xl border border-primary/40 bg-primary/10 p-4 flex items-center justify-between gap-3 hover:bg-primary/15 transition-colors group text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center">
              <IconExternalLink className="w-5 h-5 text-primary" strokeWidth={1.75} />
            </div>
            <div>
              <div className="font-medium text-foreground">Открыть все документы</div>
              <div className="text-sm text-muted-foreground">Все правила и документы откроются в отдельном окне</div>
            </div>
          </div>
          <IconChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" strokeWidth={2} />
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DOCS.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => void openDocs()}
              className={cn(
                "flex items-center gap-3 p-3.5 rounded-xl border border-border bg-muted/30 text-left",
                "hover:border-primary/50 hover:bg-muted/50 transition-all duration-200 group"
              )}
            >
              <div className="w-9 h-9 shrink-0 rounded-lg bg-primary/12 flex items-center justify-center">
                {doc.icon}
              </div>
              <div className="min-w-0">
                <div className="font-medium text-[13px] text-foreground leading-tight">{doc.title}</div>
                <div className="text-[12px] text-muted-foreground mt-0.5 line-clamp-2">{doc.desc}</div>
              </div>
            </button>
          ))}
        </div>

        <p className="text-[12px] text-muted-foreground/70 px-0.5">
          Все документы доступны в актуальной редакции и открываются в отдельном окне лаунчера.
        </p>
      </section>
    </div>
  )
}
