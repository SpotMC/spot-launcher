import { useCallback, useEffect, useMemo, useState } from "react"
import { IconDownload, IconLoader2 } from "@tabler/icons-react"
import { useAccounts } from "@/src/AccountsContext"
import { getAvatarUrl } from "@/lib/home-page-shared"
import { useHomeLaunch } from "@/src/hooks/use-home-launch"
import { useHomeVersions } from "@/src/hooks/use-home-versions"
import { useLoaderVersionOptions } from "@/src/hooks/use-loader-version-options"
import { loadLaunchSettings } from "@/src/hooks/use-build-launch"
import { cn } from "@/lib/utils"
import type { Build, ModSearchResult } from "@/components/launcher/instance/types"
import { HomeControls } from "./controls"
import { Hero } from "./hero"

type TabId = "home" | "logs" | "accounts" | "settings" | "themes" | "skins" | "versions" | "mods"

interface HomePageProps {
  onNavigate?: (tab: TabId) => void
}

const LAST_LAUNCH_KEY = "spotmc-launcher:lastLaunchAt"

const SPOT_SERVER = { ip: "185.9.145.192", port: 30716 } as const

export function HomePage({ onNavigate }: HomePageProps) {
  const { accounts, activeAccount, setActiveAccount } = useAccounts()
  const [selectedModLoader] = useState("fabric")
  const [selectedLoaderVersion, setSelectedLoaderVersion] = useState("")
  const [accountComboOpen, setAccountComboOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [builds, setBuilds] = useState<Build[]>([])
  const [serverStats, setServerStats] = useState<{ online: boolean; players: number; max: number } | null>(null)
  const [lastLaunchAt, setLastLaunchAt] = useState<number | null>(() => {
    try { return Number(localStorage.getItem(LAST_LAUNCH_KEY)) || null } catch { return null }
  })
  const [selectedVersion, setSelectedVersion] = useState("1.21.11")

  const { buildIcons } = useHomeVersions("fabric", "1.21.11")
  const { loaderVersions, loaderVersionsLoaded, recommendedLoaderVersion } = useLoaderVersionOptions("fabric", "1.21.11")
  const account = activeAccount ?? accounts[0]
  const activeAvatarUrl = useMemo(() => account ? getAvatarUrl(account, account.username) : "", [account])
  const accountAvatarUrls = useMemo(() => Object.fromEntries(accounts.map(a => [a.id, getAvatarUrl(a, a.username)])), [accounts])

  const { isRunning, launchUi, launchDetails, handlePlay } = useHomeLaunch({ account, selectedModLoader: "fabric", selectedVersion, selectedLoaderVersion })

  const [installedModCount, setInstalledModCount] = useState(0)
  const [memoryMax, setMemoryMax] = useState("4G")
  const [featuredModpacks, setFeaturedModpacks] = useState<ModSearchResult[]>([])
  const [installingPack, setInstallingPack] = useState<string | null>(null)

  useEffect(() => {
    if (!loaderVersionsLoaded) return
    if (loaderVersions.some(option => option.value === selectedLoaderVersion)) return
    setSelectedLoaderVersion(recommendedLoaderVersion ?? "")
  }, [loaderVersions, loaderVersionsLoaded, recommendedLoaderVersion, selectedLoaderVersion])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await window.electronAPI?.loadBuilds() ?? []
        if (cancelled) return
        setBuilds(list as unknown as Build[])
        const count = (list as unknown as Build[]).reduce((acc, b) => acc + (b.mods?.length ?? 0), 0)
        setInstalledModCount(count)
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const settings = await loadLaunchSettings()
        if (cancelled) return
        setMemoryMax(settings.savedMemoryMax || "4G")
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cf = await window.electronAPI?.modsCurseforgeFeatured?.("1.21")
        const cfList = cf?.popular ?? []
        const mrRes = await window.electronAPI?.modsModrinthSearch?.("", "modpack")
        const mrList = mrRes?.results ?? []
        if (cancelled) return
        const merged: ModSearchResult[] = []
        const seen = new Set<string>()
        for (const p of [...cfList, ...mrList]) {
          if (!p) continue
          const key = p.slug || p.name
          if (seen.has(key)) continue
          seen.add(key)
          merged.push(p)
          if (merged.length >= 6) break
        }
        setFeaturedModpacks(merged)
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [])

  const handleQuickJoin = useCallback(() => {
    void handlePlay({ ip: SPOT_SERVER.ip, port: SPOT_SERVER.port })
  }, [handlePlay])

  const handlePlayAndStamp = useCallback(() => {
    void handlePlay()
    try { localStorage.setItem(LAST_LAUNCH_KEY, String(Date.now())); setLastLaunchAt(Date.now()) } catch {}
  }, [handlePlay])

  const installModpack = useCallback(async (pack: ModSearchResult) => {
    if (!window.electronAPI) return
    const key = pack.slug || pack.name
    if (installingPack) return
    setInstallingPack(key)
    try {
      let result
      let source: "modrinth" | "curseforge" | "local" = "local"
      if (pack.source === "modrinth") {
        result = await window.electronAPI.importModrinthModpack(pack.name, pack.slug)
        source = "modrinth"
      } else if (pack.source === "curseforge" && typeof pack.modId === "number") {
        const fileId = pack.primaryFileId
        if (!fileId) return
        result = await window.electronAPI.importCurseforgeModpack(pack.name, pack.modId, fileId)
        source = "curseforge"
      } else {
        return
      }

      if (result?.cancelled) return
      if (result && !result.success) return

      await persistImportedBuild({
        id: crypto.randomUUID(),
        name: pack.name,
        description: pack.summary,
        version: result?.version ?? "",
        modLoader: result?.modLoader ?? "vanilla",
        loaderVersion: result?.loaderVersion,
        icon: pack.iconUrl ?? "",
        coverImage: pack.iconUrl ?? undefined,
        mods: (result?.mods ?? []) as unknown as Build["mods"],
        resourcepacks: (result?.resourcepacks ?? []) as unknown as Build["resourcepacks"],
        shaders: (result?.shaders ?? []) as unknown as Build["shaders"],
        createdAt: new Date().toISOString(),
        source,
        projectSlug: pack.source === "modrinth" ? pack.slug : undefined,
        modpackVersion: result?.modpackVersion,
        installedMods: result?.installedMods ?? {},
        playtime: 0,
      })
    } catch { /* ignore */ } finally {
      setInstallingPack(null)
    }
  }, [installingPack])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await window.electronAPI?.loadBuilds() ?? []
        if (cancelled) return
        setBuilds(list as unknown as Build[])
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [installingPack])

  const filteredModpacks = useMemo(() => {
    const base = builds
    const q = query.trim().toLowerCase()
    if (!q) return base
    return base.filter(b => b.name.toLowerCase().includes(q) || b.description.toLowerCase().includes(q))
  }, [builds, query])

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-[46px] shrink-0 items-center gap-3 border-b border-white/[0.04] bg-[#0c0d10] px-4">
          <div className="min-w-0 flex-1 max-w-[420px]">
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 h-8 transition-colors focus-within:border-[#5a6ff2]/50">
              <svg className="w-3.5 h-3.5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск версий, модпаков..."
                className="flex-1 bg-transparent text-[12px] text-white placeholder:text-white/25 outline-none"
              />
            </div>
          </div>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => onNavigate?.("settings")}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 h-8 text-[12px] text-white/60 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
            </svg>
            Настройки
          </button>
          <div className="h-7 w-7 rounded-lg overflow-hidden bg-white/[0.06] border border-white/[0.06]">
            {account ? (
              <img src={activeAvatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-[10px] font-bold text-white/30">?</div>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
          <Hero onJoinServer={handleQuickJoin} serverStats={serverStats} />

          <section>
            <div className="mb-2 flex items-center justify-between px-0.5">
              <h2 className="text-[14px] font-semibold text-white/90">Ваши версии</h2>
              <button type="button" onClick={() => onNavigate?.("versions")} className="text-[11px] text-[#5a6ff2] hover:underline">Управлять</button>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
              {filteredModpacks.slice(0, 6).map((build) => (
                <div key={build.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 hover:border-[#5a6ff2]/40 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-lg bg-white/[0.05] overflow-hidden flex-shrink-0">
                      {buildIconFor(build, buildIcons)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-white">{build.name}</p>
                      <p className="text-[10px] text-white/35 capitalize">{build.modLoader} {build.version}</p>
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[11px] text-white/40">{build.description || "Без описания"}</p>
                </div>
              ))}
              {filteredModpacks.length === 0 && (
                <div className="col-span-3 rounded-xl border border-dashed border-white/[0.08] py-8 text-center text-[12px] text-white/30">
                  Нет сборок. Создайте версию во вкладке «Версии».
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between px-0.5">
              <h2 className="text-[14px] font-semibold text-white/90">Популярные модпаки</h2>
              <button type="button" onClick={() => onNavigate?.("mods")} className="text-[11px] text-[#5a6ff2] hover:underline">Все модпаки</button>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {featuredModpacks.map((p) => (
                <div key={p.slug || p.name} className="group relative flex flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] transition-all duration-200 hover:border-[#5a6ff2]/40 hover:bg-white/[0.03]">
                  <div className="relative flex h-28 w-full items-center justify-center overflow-hidden bg-white/[0.03] p-5">
                    {p.iconUrl ? (
                      <img src={p.iconUrl} alt="" className="max-h-full max-w-full object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-transform duration-300 group-hover:scale-110" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-white/30">{(p.name || "?").slice(0, 1).toUpperCase()}</div>
                    )}
                    <span className="absolute bottom-1.5 left-2 text-[9px] font-semibold uppercase tracking-wider text-white/50 capitalize">{p.source}</span>
                  </div>
                  <div className="flex flex-1 flex-col p-3">
                    <p className="truncate text-[13px] font-semibold text-white">{p.name}</p>
                    <p className="mt-1 line-clamp-2 text-[11px] text-white/40">{p.summary || "Без описания"}</p>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-white/35">
                      <IconDownload className="h-3.5 w-3.5" />
                      {typeof p.downloadCount === "number" ? `${p.downloadCount.toLocaleString("ru-RU")} скачиваний` : "—"}
                    </div>
                    <button
                      type="button"
                      onClick={() => installModpack(p)}
                      disabled={installingPack !== null || (p.source !== "modrinth" && p.source !== "curseforge")}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#5a6ff2] py-2 text-[11px] font-medium text-white transition-colors hover:bg-[#6c7ff6] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {installingPack === (p.slug || p.name) ? (
                        <>
                          <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                          Установка...
                        </>
                      ) : (
                        <>
                          <IconDownload className="h-3.5 w-3.5" />
                          Установить
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
              {featuredModpacks.length === 0 && (
                <div className="col-span-3 rounded-xl border border-dashed border-white/[0.08] py-8 text-center text-[12px] text-white/30">
                  Не удалось загрузить популярные модпаки.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <aside className="w-[300px] shrink-0 flex flex-col overflow-hidden bg-[#0c0d10] border-l border-white/[0.04]">
        {(launchUi.status || launchUi.progress !== null || launchUi.isLaunching) && (
          <div className="p-3 pb-0">
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-white/45">{launchUi.isLaunching ? "Запуск" : "Статус"}</span>
                {launchUi.progress !== null && <span className="text-[11px] font-bold text-[#5a6ff2] tabular-nums">{launchUi.progress}%</span>}
              </div>
              {launchUi.progress !== null && (
                <div className="mt-2 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#5a6ff2] to-[#8d9ff5] transition-[width] duration-200" style={{ width: `${Math.max(0, Math.min(100, launchUi.progress))}%` }} />
                </div>
              )}
              {launchUi.status && <p className="mt-2 text-[11px] text-white/50 leading-snug">{launchUi.status}</p>}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="mb-2.5 text-[11px] font-semibold text-white/60">Информация о сборке</p>
            <InfoRow label="Статус" value={isRunning ? "Запущено" : "Не запущено"} running={isRunning} />
            <InfoRow label="Последний запуск" value={formatLastLaunch(lastLaunchAt)} />
            <InfoRow label="Модификаций" value={String(installedModCount)} />
            <InfoRow label="Память" value={memoryMax} />
            <div className="mt-3 grid grid-cols-1 gap-1.5">
              <button type="button" onClick={() => onNavigate?.("settings")} className="rounded-lg border border-white/[0.08] bg-white/[0.03] py-2 text-[11px] text-white/60 transition-colors hover:bg-white/[0.07] hover:text-white">
                Настроить
              </button>
            </div>
          </div>

          <div className="mt-3">
            <HomeControls
              accounts={accounts}
              account={account}
              accountComboOpen={accountComboOpen}
              setAccountComboOpen={setAccountComboOpen}
              setActiveAccount={setActiveAccount}
              versions={["1.21.11"]}
              versionsLoaded={true}
              selectedVersion="1.21.11"
              setSelectedVersion={() => {}}
              buildIcons={buildIcons}
              selectedModLoader="fabric"
              setSelectedModLoader={() => {}}
              loaderVersions={loaderVersions}
              loaderVersionsLoaded={loaderVersionsLoaded}
              selectedLoaderVersion={selectedLoaderVersion}
              setSelectedLoaderVersion={setSelectedLoaderVersion}
              activeAvatarUrl={activeAvatarUrl}
              accountAvatarUrls={accountAvatarUrls}
              launchUi={launchUi}
              launchDetails={launchDetails}
              isRunning={isRunning}
              onPlay={handlePlayAndStamp}
            />
          </div>
        </div>
      </aside>
    </div>
  )
}

async function persistImportedBuild(build: Build) {
  const existing = await window.electronAPI?.loadBuilds() ?? []
  const next = [build, ...existing.filter(item => item.id !== build.id && item.name !== build.name)]
  await window.electronAPI?.saveBuilds(next as Parameters<NonNullable<Window["electronAPI"]>["saveBuilds"]>[0])
}

function buildIconFor(build: Build, icons: Record<string, string>) {
  if (build.icon) {
    return <img src={build.icon} alt="" className="h-full w-full object-cover" />
  }
  if (icons[build.name]) {
    return <img src={icons[build.name]} alt="" className="h-full w-full object-cover" />
  }
  return <div className="h-full w-full flex items-center justify-center text-[10px] font-bold text-white/30">{build.name.slice(0, 1).toUpperCase()}</div>
}

function InfoRow({ label, value, running }: { label: string; value: string; running?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[11px] text-white/35">{label}</span>
      <span className={cn("text-[11px] font-medium", running ? "text-emerald-400" : "text-white/70")}>
        {running !== undefined && (
          <span className={cn("mr-1.5 inline-block h-1.5 w-1.5 rounded-full", running ? "bg-emerald-400" : "bg-white/20")} />
        )}
        {value}
      </span>
    </div>
  )
}

function formatLastLaunch(ts: number | null): string {
  if (!ts) return "—"
  try {
    return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(ts))
  } catch {
    return "—"
  }
}
