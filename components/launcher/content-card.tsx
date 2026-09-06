import { IconHome, IconFileText, IconUserPlus, IconSettings, IconColorSwatch, IconShirt, IconBox, IconPuzzle, IconBlocks, IconChartBar } from "@tabler/icons-react"
import type { TabId } from "./sidebar"

interface ContentCardProps {
  activeTab: TabId
}

const tabContent: Record<TabId, { title: string; message: string; icon: React.ReactNode }> = {
  home: {
    title: "Главная",
    message: "Главная страница",
    icon: <IconHome className="w-12 h-12" strokeWidth={1.5} />,
  },
  builds: {
    title: "Сборки",
    message: "Сборки, модпаки и установка",
    icon: <IconBlocks className="w-12 h-12" strokeWidth={1.5} />,
  },
  stats: {
    title: "Статистика",
    message: "Статистика сервера SpotMC",
    icon: <IconChartBar className="w-12 h-12" strokeWidth={1.5} />,
  },
  logs: {
    title: "Логи",
    message: "Просмотр логов запуска Minecraft",
    icon: <IconFileText className="w-12 h-12" strokeWidth={1.5} />,
  },
  accounts: {
    title: "Аккаунты",
    message: "Управление аккаунтами",
    icon: <IconUserPlus className="w-12 h-12" strokeWidth={1.5} />,
  },
  settings: {
    title: "Настройки",
    message: "Настройки лаунчера",
    icon: <IconSettings className="w-12 h-12" strokeWidth={1.5} />,
  },
  themes: {
    title: "Темы",
    message: "Настройки тем",
    icon: <IconColorSwatch className="w-12 h-12" strokeWidth={1.5} />,
  },
  skins: {
    title: "Скины",
    message: "Управление скинами",
    icon: <IconShirt className="w-12 h-12" strokeWidth={1.5} />,
  },
  versions: {
    title: "Версии",
    message: "Скачивание и запуск версий Minecraft",
    icon: <IconBox className="w-12 h-12" strokeWidth={1.5} />,
  },
  mods: {
    title: "Моды",
    message: "Поиск и установка модов",
    icon: <IconPuzzle className="w-12 h-12" strokeWidth={1.5} />,
  },
}

export function ContentCard({ activeTab }: ContentCardProps) {
  const content = tabContent[activeTab]

  return (
    <div className="relative overflow-hidden rounded-2xl bg-card border border-border transition-all duration-300 animate-in fade-in-0 slide-in-from-bottom-4">
      <div className="relative z-10 p-8">
        <h2 className="text-xl font-semibold text-foreground mb-6">{content.title}</h2>

        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-24 h-24 rounded-2xl bg-muted/50 flex items-center justify-center mb-6 text-muted-foreground">
            {content.icon}
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent/10 border border-accent/20 text-accent">
            <IconHome className="w-5 h-5" strokeWidth={1.5} />
            <span className="font-medium">{content.message}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
