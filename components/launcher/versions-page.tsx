import { useCallback, useEffect, useMemo, useState } from "react"
import { useAccounts } from "@/src/AccountsContext"
import { useHomeLaunch } from "@/src/hooks/use-home-launch"
import { useMinecraftVersionOptions } from "@/src/hooks/use-minecraft-version-options"
import { useLoaderVersionOptions } from "@/src/hooks/use-loader-version-options"
import { cn } from "@/lib/utils"
import { IconBox, IconLoader2, IconSearch, IconSettings } from "@tabler/icons-react"
import { PageHeader } from "./page-header"

type GroupLabel = "release" | "snapshot" | "old_beta" | "old_alpha"
type ModLoader = "vanilla" | "fabric" | "forge" | "neoforge" | "quilt"

const MOD_LOADERS: { id: ModLoader; label: string; icon: string }[] = [
  { id: "vanilla", label: "Vanilla", icon: "🎮" },
  { id: "fabric", label: "Fabric", icon: "🧵" },
  { id: "forge", label: "Forge", icon: "⚡" },
  { id: "neoforge", label: "NeoForge", icon: "🔥" },
  { id: "quilt", label: "Quilt", icon: "🪡" },
]

const GROUP_META: { key: GroupLabel; label: string; color: string }[] = [
  { key: "release", label: "Релизы", color: "bg-emerald-500" },
  { key: "snapshot", label: "Снапшоты", color: "bg-amber-500" },
  { key: "old_beta", label: "Бета", color: "bg-sky-500" },
  { key: "old_alpha", label: "Альфа", color: "bg-purple-500" },
]

export function VersionsPage() {
  const { accounts, activeAccount } = useAccounts()
  const account = activeAccount ?? accounts[0]

  const [query, setQuery] = useState("")
  const [playing, setPlaying] = useState<string | null>(null)
  const [selectedModLoader, setSelectedModLoader] = useState<ModLoader>("vanilla")
  const [selectedLoaderVersion, setSelectedLoaderVersion] = useState("")

  const { allMinecraftVersions, visibleVersions, versionsLoaded } = useMinecraftVersionOptions()
  const { loaderVersions, loaderVersionsLoaded, recommendedLoaderVersion } = useLoaderVersionOptions(selectedModLoader, "1.21.1")

  const { isRunning, launchUi, handlePlayVersion } = useHomeLaunch({
    account,
    selectedVersion: "",
    selectedModLoader,
  })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allMinecraftVersions
    return allMinecraftVersions.filter((v) => v.version.toLowerCase().includes(q))
  }, [query, allMinecraftVersions])

  const grouped = useMemo(() => {
    const map: Record<GroupLabel, typeof filtered> = {
      release: [],
      snapshot: [],
      old_beta: [],
      old_alpha: [],
    }
    for (const v of filtered) {
      if (map[v.type as GroupLabel]) map[v.type as GroupLabel].push(v)
    }
    return map
  }, [filtered])

  const playVersion = useCallback(async (version: string) => {
    setPlaying(version)
    await handlePlayVersion(version)
    setPlaying(null)
  }, [handlePlayVersion])

  const runningVersion = visibleVersions.includes(playing ?? "") ? playing : null

  // Auto-select recommended loader version when loader changes
  useEffect(() => {
    if (!loaderVersionsLoaded) return
    if (loaderVersions.some(option => option.value === selectedLoaderVersion)) return
    setSelectedLoaderVersion(recommendedLoaderVersion ?? "")
  }, [loaderVersions, loaderVersionsLoaded, recommendedLoaderVersion, selectedLoaderVersion])

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0c0d10]">
      <div className="flex h-[46px] shrink-0 items-center gap-3 border-b border-white/[0.04] bg-[#0c0d10] px-4">
        <div className="flex items-center gap-2 min-w-0">
          <IconBox className="w-5 h-5 text-white/70" />
          <h1 className="text-[14px] font-semibold text-white/90">Версии Minecraft</h1>
        </div>
        <div className="flex-1" />
        
        {/* Mod Loader Selection */}
        <div className="flex items-center gap-2">
          {MOD_LOADERS.map((loader) => (
            <button
              key={loader.id}
              type="button"
              onClick={() => setSelectedModLoader(loader.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors",
                selectedModLoader === loader.id
                  ? "bg-[#5a6ff2] text-white"
                  : "bg-white/[0.03] text-white/60 hover:bg-white/[0.07] hover:text-white/80"
              )}
            >
              <span>{loader.icon}</span>
              {loader.label}
            </button>
          ))}
        </div>

        {/* Loader Version Selection */}
        {selectedModLoader !== "vanilla" && (
          <select
            value={selectedLoaderVersion}
            onChange={(e) => setSelectedLoaderVersion(e.target.value)}
            className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[11px] text-white outline-none [&>option]:bg-[#141519]"
          >
            {!loaderVersionsLoaded && <option>Загрузка...</option>}
            {loaderVersions.map((v) => (
              <option key={v.value} value={v.value}>{v.label}</option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 h-8 transition-colors focus-within:border-[#5a6ff2]/50">
          <IconSearch className="w-3.5 h-3.5 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск версии..."
            className="w-44 bg-transparent text-[12px] text-white placeholder:text-white/25 outline-none"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
        {!versionsLoaded ? (
          <div className="flex h-full items-center justify-center gap-2 text-white/40">
            <IconLoader2 className="w-5 h-5 animate-spin" />
            <span className="text-[12px]">Загрузка списка версий...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {GROUP_META.map((group) => {
              const items = grouped[group.key]
              if (items.length === 0) return null
              return (
                <section key={group.key}>
                  <div className="mb-2 flex items-center gap-2 px-0.5">
                    <span className={cn("h-2 w-2 rounded-full", group.color)} />
                    <h2 className="text-[13px] font-semibold text-white/90">{group.label}</h2>
                    <span className="text-[11px] text-white/35">{items.length}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 min-[1200px]:grid-cols-3">
                    {items.map((v) => {
                      const isCurrent = runningVersion === v.version
                      return (
                        <div
                          key={v.version}
                          className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 transition-colors hover:border-[#5a6ff2]/40"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-medium text-white">{v.version}</p>
                            <p className="text-[10px] text-white/35 capitalize">{v.type.replace("old_", "")}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => playVersion(v.version)}
                            disabled={launchUi.isLaunching}
                            className={cn(
                              "shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium text-white transition-colors disabled:opacity-50",
                              isCurrent
                                ? "bg-[#5a6ff2] hover:bg-[#6c7ff6]"
                                : "bg-white/[0.06] hover:bg-[#5a6ff2]/20"
                            )}
                          >
                            {isCurrent && launchUi.isLaunching ? "Запуск..." : isCurrent ? "Играть" : "Скачать"}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })}

            {filtered.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/[0.08] py-10 text-center text-[12px] text-white/30">
                Ничего не найдено по запросу «{query}».
              </div>
            )}

            <p className="px-0.5 text-[11px] text-white/35">
              Чтобы показывать снапшоты, беты и альфы, включите их в настройках автоматически.
              {isRunning ? " Игра запущена — нажмите «Играть», чтобы остановить." : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
