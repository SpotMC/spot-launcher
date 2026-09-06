import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import type { Build, ModSearchResult } from "./instance/types"
import { IconPuzzle, IconSearch, IconLoader2, IconDownload, IconFolderOpen } from "@tabler/icons-react"
import { PageHeader } from "./page-header"

const MODS_PER_PAGE = 24

export function ModsPage() {
  const [query, setQuery] = useState("")
  const [debounced, setDebounced] = useState("")
  const [results, setResults] = useState<ModSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [installing, setInstalling] = useState<string | null>(null)
  const [builds, setBuilds] = useState<Build[]>([])
  const [targetBuildId, setTargetBuildId] = useState<string>("")
  const searchRef = useRef(0)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = (await window.electronAPI?.loadBuilds()) ?? []
        if (cancelled) return
        setBuilds(list as unknown as Build[])
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [])

  const doSearch = useCallback(async (q: string) => {
    const id = ++searchRef.current
    setLoading(true)
    try {
      const resp = await window.electronAPI?.modsModrinthSearch(q, "mod", undefined, undefined, "downloads", 0)
      if (id !== searchRef.current) return
      setResults(resp?.results ?? [])
    } catch {
      if (id === searchRef.current) setResults([])
    } finally {
      if (id === searchRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const q = debounced.trim()
    if (!q) {
      setResults([])
      setLoading(false)
      return
    }
    void doSearch(q)
  }, [debounced, doSearch])

  const targetBuild = useMemo(
    () => builds.find((b) => b.id === targetBuildId) ?? builds[0] ?? null,
    [builds, targetBuildId],
  )
  const installedSlugs = useMemo(() => new Set(targetBuild?.mods.map((m) => m.slug) ?? []), [targetBuild])

  const installMod = useCallback(async (mod: ModSearchResult) => {
    const build = targetBuild ?? builds[0]
    if (!build?.name) return
    setInstalling(mod.slug)
    try {
      const versions = await window.electronAPI?.modsModrinthVersions(mod.slug)
      const version = versions?.find((v) => v.files?.[0]?.url) ?? versions?.[0]
      const file = version?.files?.[0]
      if (!file?.url || !version) return

      const fileName = file.filename || `${mod.slug}-${version.id}.jar`
      await window.electronAPI?.saveModToIntent?.(build.name, file.url, fileName)

      const deps = (await window.electronAPI?.modsResolveDependencies(version, "modrinth")) ?? []
      for (const dep of deps) {
        if (dep.dependencyType !== "required" || !dep.projectId) continue
        try {
          const dVersions = await window.electronAPI?.modsModrinthVersions(dep.projectId)
          const dVersion = dVersions?.find((v) => v.files?.[0]?.url) ?? dVersions?.[0]
          const dFile = dVersion?.files?.[0]
          if (dFile?.url) {
            await window.electronAPI?.saveModToIntent?.(build.name, dFile.url, dFile.filename || `${dep.projectId}.jar`)
          }
        } catch { /* ignore */ }
      }

      const list = (await window.electronAPI?.loadBuilds()) ?? []
      setBuilds(list as unknown as Build[])
    } catch { /* ignore */ } finally {
      setInstalling(null)
    }
  }, [targetBuild, builds])

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0c0d10]">
      <div className="flex h-[46px] shrink-0 items-center gap-3 border-b border-white/[0.04] bg-[#0c0d10] px-4">
        <div className="flex items-center gap-2 min-w-0">
          <IconPuzzle className="w-5 h-5 text-white/70" />
          <h1 className="text-[14px] font-semibold text-white/90">Моды</h1>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 h-9 transition-colors focus-within:border-[#5a6ff2]/50 min-[900px]:w-72">
          <IconSearch className="w-3.5 h-3.5 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск модов..."
            className="w-full bg-transparent text-[12px] text-white placeholder:text-white/25 outline-none"
          />
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 h-9">
          <IconFolderOpen className="w-3.5 h-3.5 text-white/30" />
          <select
            value={targetBuildId}
            onChange={(e) => setTargetBuildId(e.target.value)}
            className="bg-transparent text-[12px] text-white outline-none [&>option]:bg-[#141519]"
          >
            <option value="">{builds.length === 0 ? "Нет сборок" : targetBuild?.name ?? "Выберите сборку..."}</option>
            {builds.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        {builds.length === 0 && (
          <p className="text-[11px] text-amber-400/80 min-[900px]:w-full">
            У вас нет сборок. Создайте или установите сборку, чтобы устанавливать в неё моды.
          </p>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
        <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 h-9 transition-colors focus-within:border-[#5a6ff2]/50 min-[900px]:w-72">
          <IconSearch className="w-3.5 h-3.5 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск модов..."
            className="w-full bg-transparent text-[12px] text-white placeholder:text-white/25 outline-none"
          />
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 h-9">
          <IconFolderOpen className="w-3.5 h-3.5 text-white/30" />
          <select
            value={targetBuildId}
            onChange={(e) => setTargetBuildId(e.target.value)}
            className="bg-transparent text-[12px] text-white outline-none [&>option]:bg-[#141519]"
          >
            <option value="">{builds.length === 0 ? "Нет сборок" : targetBuild?.name ?? "Выберите сборку..."}</option>
            {builds.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        {builds.length === 0 && (
          <p className="text-[11px] text-amber-400/80 min-[900px]:w-full">
            У вас нет сборок. Создайте или установите сборку, чтобы устанавливать в неё моды.
          </p>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
        {loading ? (
          <div className="flex h-full items-center justify-center gap-2 text-white/40">
            <IconLoader2 className="w-5 h-5 animate-spin" />
            <span className="text-[12px]">Поиск модов...</span>
          </div>
        ) : results.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <IconPuzzle className="mx-auto h-8 w-8 text-white/15" />
              <p className="mt-3 text-[13px] text-white/40">
                {debounced.trim() ? "Ничего не найдено." : "Введите запрос, чтобы найти моды."}
              </p>
              {!debounced.trim() && (
                <p className="mt-1 text-[11px] text-white/25">Например: sodium, jei, lithium, create</p>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 min-[1200px]:grid-cols-3">
            {results.slice(0, MODS_PER_PAGE).map((mod) => {
              const isInstalled = installedSlugs.has(mod.slug) || installedSlugs.has(mod.name)
              const isBusy = installing === mod.slug
              return (
                <div key={mod.slug || mod.id} className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 transition-colors hover:border-[#5a6ff2]/40">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white/[0.05]">
                    {mod.iconUrl ? (
                      <img src={mod.iconUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[11px] font-bold text-white/30">
                        {(mod.name || "?").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-white">{mod.name}</p>
                    <p className="truncate text-[10px] text-white/35">{mod.summary || mod.source}</p>
                    {typeof mod.downloadCount === "number" && mod.downloadCount > 0 && (
                      <p className="text-[10px] text-white/35">{mod.downloadCount.toLocaleString("ru-RU")} скачиваний</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => installMod(mod)}
                    disabled={builds.length === 0 || isInstalled || isBusy}
                    title={builds.length === 0 ? "Нет сборок — создайте или установите сборку" : isInstalled ? "Уже установлен" : `Установить в ${targetBuild?.name ?? "сборку"}`}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                      isInstalled ? "bg-emerald-500/20 text-emerald-300" : "bg-[#5a6ff2] hover:bg-[#6c7ff6]",
                    )}
                  >
                    {isBusy ? (
                      <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isInstalled ? (
                      "Установлен"
                    ) : (
                      <>
                        <IconDownload className="h-3.5 w-3.5" />
                        Скачать
                      </>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
