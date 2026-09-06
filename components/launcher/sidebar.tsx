import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import {
  IconHome,
  IconHeadphones,
  IconUser,
  IconFolder,
  IconSettings,
  IconBox,
  IconPuzzle,
  IconBlocks,
  IconChartBar,
} from "@tabler/icons-react";

type TabId = "home" | "builds" | "stats" | "logs" | "accounts" | "settings" | "themes" | "skins" | "versions" | "mods";

interface SidebarItem {
  id: TabId;
  labelKey: string;
  icon: React.ReactNode;
  activeIcon?: React.ReactNode;
}

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const sidebarItems: SidebarItem[] = [
  {
    id: "home",
    labelKey: "sidebar.home",
    icon: <IconHome className="w-5 h-5" strokeWidth={1.75} />,
    activeIcon: <IconHome className="w-5 h-5" strokeWidth={2.25} />,
  },
  {
    id: "builds",
    labelKey: "sidebar.builds",
    icon: <IconBlocks className="w-5 h-5" strokeWidth={1.75} />,
    activeIcon: <IconBlocks className="w-5 h-5" strokeWidth={2.25} />,
  },
  {
    id: "stats",
    labelKey: "sidebar.stats",
    icon: <IconChartBar className="w-5 h-5" strokeWidth={1.75} />,
    activeIcon: <IconChartBar className="w-5 h-5" strokeWidth={2.25} />,
  },
  {
    id: "skins",
    labelKey: "sidebar.skins",
    icon: <IconHeadphones className="w-5 h-5" strokeWidth={1.75} />,
    activeIcon: <IconHeadphones className="w-5 h-5" strokeWidth={2.25} />,
  },
  {
    id: "versions",
    labelKey: "sidebar.versions",
    icon: <IconBox className="w-5 h-5" strokeWidth={1.75} />,
    activeIcon: <IconBox className="w-5 h-5" strokeWidth={2.25} />,
  },
  {
    id: "mods",
    labelKey: "sidebar.mods",
    icon: <IconPuzzle className="w-5 h-5" strokeWidth={1.75} />,
    activeIcon: <IconPuzzle className="w-5 h-5" strokeWidth={2.25} />,
  },
  {
    id: "accounts",
    labelKey: "sidebar.accounts",
    icon: <IconUser className="w-5 h-5" strokeWidth={1.75} />,
    activeIcon: <IconUser className="w-5 h-5" strokeWidth={2.25} />,
  },
  {
    id: "logs",
    labelKey: "sidebar.logs",
    icon: <IconFolder className="w-5 h-5" strokeWidth={1.75} />,
    activeIcon: <IconFolder className="w-5 h-5" strokeWidth={2.25} />,
  },
  {
    id: "settings",
    labelKey: "sidebar.settings",
    icon: <IconSettings className="w-5 h-5" strokeWidth={1.75} />,
    activeIcon: <IconSettings className="w-5 h-5" strokeWidth={2.25} />,
  },
];

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const { t } = useTranslation();

  return (
    <aside
      className={cn(
        "h-full w-[62px] flex-shrink-0 flex flex-col transition-colors duration-300",
        "bg-[#0a0b0e] border-r border-white/[0.04]"
      )}
    >
      <div className="flex items-center justify-center h-[52px] mb-1">
        <img
          src="./spot-logo-mono-2.png"
          alt="Spot"
          className="w-8 h-8 object-contain drop-shadow-[0_0_12px_rgba(141,159,245,0.35)]"
          draggable={false}
        />
      </div>

      <div className="mx-3 mb-2 h-px bg-white/[0.06]" />

      <nav className="flex flex-col gap-1 flex-1 items-center px-2">
        {sidebarItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <div key={item.id} className="relative group w-full flex justify-center">
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[#8d9ff5]" />
              )}

              <button
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "relative rounded-xl flex items-center justify-center w-10 h-10 transition-all duration-200",
                  isActive
                    ? "bg-[#8d9ff5]/15 text-[#8d9ff5]"
                    : "text-white/25 hover:bg-white/[0.05] hover:text-white/60"
                )}
              >
                {isActive ? item.activeIcon : item.icon}
              </button>

              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 rounded-md bg-[#1a1b20] border border-white/[0.08] text-[11px] font-medium text-white/80 whitespace-nowrap opacity-0 scale-95 pointer-events-none transition-all duration-150 z-50 group-hover:opacity-100 group-hover:scale-100 shadow-lg">
                {t(item.labelKey)}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="mx-3 mt-2 mb-3 h-px bg-white/[0.06]" />
    </aside>
  );
}

export type { TabId };
