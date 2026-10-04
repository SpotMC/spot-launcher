import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { BuildMod, ModSearchResult } from "./instance/types"
import { useBuilds } from "./instance/use-builds"
import { IconPuzzle, IconSearch, IconLoader2, IconDownload, IconFolderOpen, IconCheck, IconRefresh, IconTrash } from "@tabler/icons-react"

const MODS_PER_PAGE = 24

export function ModsPage() {
  const { builds, setBuilds, reloadBuilds, removeContentFromBuild } = useBuilds()
  const [query, setQuery] = useState("")
  const [debounced, setDebounced] = useState("")
  const [results, setResults] = useState<ModSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [installing, setInstalling] = useState<string | null>(null)
  const [installError, setInstallError] = useState<string | null>(null)
  const [installSuccess, setInstallSuccess] = useState<string | null>(null)
  const [targetBuildId, setTargetBuildId] = useState<string>("")
  const searchRef = useRef(0)

  useEffect(() => {
    if (!installSuccess) return
    const timer = setTimeout(() => setInstallSuccess(null), 3500)
    return () => clearTimeout(timer)
  }, [installSuccess])

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 300)
    return () => clearTimeout(timer)
  }, [query])

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
  const findInstalledEntry = useCallback((mod: ModSearchResult): BuildMod | undefined => {
    const entries = targetBuild?.mods ?? []
    const slug = mod.slug.toLowerCase()
    const name = mod.name.toLowerCase()
    const exact = entries.find((m) => (
      m.slug.toLowerCase() === slug
      || m.name.toLowerCase() === name
      || m.slug.toLowerCase() === name
    ))
    if (exact) return exact
    return entries.find((m) => {
      const ms = m.slug.toLowerCase()
      const mn = m.name.toLowerCase()
      return ms.startsWith(slug) || slug.startsWith(ms) || mn.startsWith(name) || name.startsWith(mn)
    })
  }, [targetBuild])

  const installMod = useCallback(async (mod: ModSearchResult) => {
    const build = targetBuild ?? builds[0]
    if (!build?.name) {
      setInstallError("Нет сборки для установки мода. Создайте или импортируйте сборку.")
      return
    }
    setInstalling(mod.slug)
    setInstallError(null)
    let installed = 0
    try {
      const versions = await window.electronAPI?.modsModrinthVersions(mod.slug)
      const version = versions?.find((v) => v.files?.[0]?.url) ?? versions?.[0]
      const file = version?.files?.[0]
      if (!file?.url || !version) {
        throw new Error(`У мода "${mod.name}" нет доступных файлов для скачивания.`)
      }

      const fileName = file.filename || `${mod.slug}-${version.id}.jar`
      const saved = await window.electronAPI?.saveModToIntent?.(build.name, file.url, fileName)
      if (!saved) {
        throw new Error(`Не удалось скачать файл "${fileName}". Проверьте сеть и попробуйте снова.`)
      }
      installed = 1

      setBuilds((prev) => prev.map((b) => {
        if (b.id !== build.id) return b
        if (b.mods.some((m) => m.slug === fileName || m.slug === mod.slug || m.name.toLowerCase() === mod.name.toLowerCase())) return b
        return {
          ...b,
          installedMods: { ...(b.installedMods ?? {}), [fileName]: saved },
          mods: [...b.mods, {
            id: crypto.randomUUID(),
            slug: fileName,
            name: mod.name,
            description: mod.summary ?? "",
            icon_url: mod.iconUrl,
            version: version.name || version.id,
            source: "modrinth",
            projectId: mod.projectId ?? mod.id,
            modId: mod.modId,
            author: mod.author,
          }],
        }
      }))

      const deps = (await window.electronAPI?.modsResolveDependencies(version, "modrinth")) ?? []
      for (const dep of deps) {
        if (dep.dependencyType !== "required" || !dep.projectId) continue
        try {
          const dVersions = await window.electronAPI?.modsModrinthVersions(dep.projectId)
          const dVersion = dVersions?.find((v) => v.files?.[0]?.url) ?? dVersions?.[0]
          const dFile = dVersion?.files?.[0]
          if (dFile?.url) {
            const dSaved = await window.electronAPI?.saveModToIntent?.(build.name, dFile.url, dFile.filename || `${dep.projectId}.jar`)
            if (dSaved) installed += 1
          }
        } catch (error) {
          console.error("[mods-page] Failed to download dependency:", dep.projectId, error)
        }
      }

      await reloadBuilds()
      if (installed > 0) {
        const depsInstalled = installed - 1
        setInstallSuccess(
          depsInstalled > 0
            ? `Мод "${mod.name}" скачан (зависимостей: ${depsInstalled})`
            : `Мод "${mod.name}" скачан`,
        )
        window.dispatchEvent(new CustomEvent("cloud:imported", { detail: { type: "build" } }))
      }
    } catch (error) {
      console.error("[mods-page] Install failed:", error)
      setInstallError(error instanceof Error ? error.message : "Не удалось установить мод.")
    } finally {
      setInstalling(null)
    }
  }, [targetBuild, builds, reloadBuilds, setBuilds])

  const updateMod = useCallback(async (mod: ModSearchResult) => {
    const build = targetBuild ?? builds[0]
    if (!build?.name) return
    const installedItem = findInstalledEntry(mod)
    setInstalling(mod.slug)
    setInstallError(null)
    try {
      const versions = await window.electronAPI?.modsModrinthVersions(mod.slug)
      const version = versions?.find((v) => v.files?.[0]?.url) ?? versions?.[0]
      const file = version?.files?.[0]
      if (!file?.url || !version) {
        throw new Error(`У мода "${mod.name}" нет доступных версий для обновления.`)
      }
      const newFileName = file.filename || `${mod.slug}-${version.id}.jar`
      const saved = await window.electronAPI?.saveModToIntent?.(build.name, file.url, newFileName)
      if (!saved) {
        throw new Error(`Не удалось загрузить новую версию "${mod.name}".`)
      }
      if (installedItem && installedItem.slug !== newFileName) {
        try {
          await window.electronAPI?.deleteContentFromIntent?.(build.name, "mod", installedItem.slug)
        } catch (error) {
          console.error("[mods-page] Failed to remove old mod file:", installedItem.slug, error)
        }
      }
      setBuilds((prev) => prev.map((b) => {
        if (b.id !== build.id) return b
        return {
          ...b,
          installedMods: { ...(b.installedMods ?? {}), [newFileName]: saved },
          mods: b.mods.map((m) => (
            m.slug === installedItem?.slug
              || m.slug === mod.slug
              || m.name.toLowerCase() === mod.name.toLowerCase()
              ? {
                ...m,
                slug: newFileName,
                name: mod.name,
                description: mod.summary ?? m.description,
                icon_url: mod.iconUrl || m.icon_url,
                version: version.name || version.id,
                source: "modrinth",
                projectId: mod.projectId ?? mod.id,
                modId: mod.modId,
                author: mod.author ?? m.author,
              }
              : m
          )),
        }
      }))
      await reloadBuilds()
      setInstallSuccess(`Мод "${mod.name}" обновлён`)
      window.dispatchEvent(new CustomEvent("cloud:imported", { detail: { type: "build" } }))
    } catch (error) {
      console.error("[mods-page] Update failed:", error)
      setInstallError(error instanceof Error ? error.message : "Не удалось обновить мод.")
    } finally {
      setInstalling(null)
    }
  }, [targetBuild, builds, findInstalledEntry, reloadBuilds, setBuilds])

  const removeMod = useCallback(async (mod: ModSearchResult) => {
    const build = targetBuild ?? builds[0]
    if (!build?.name) return
    const installedItem = findInstalledEntry(mod)
    setInstalling(mod.slug)
    setInstallError(null)
    try {
      if (installedItem) {
        const ok = await removeContentFromBuild(build.id, "mods", installedItem)
        if (!ok) throw new Error(`Не удалось удалить "${mod.name}".`)
      } else {
        setBuilds((prev) => prev.map((b) => b.id !== build.id
          ? b
          : {
            ...b,
            mods: b.mods.filter((m) => m.slug !== mod.slug && m.name.toLowerCase() !== mod.name.toLowerCase()),
          }))
        await reloadBuilds()
      }
      setInstallSuccess(`Мод "${mod.name}" удалён`)
      window.dispatchEvent(new CustomEvent("cloud:imported", { detail: { type: "build" } }))
    } catch (error) {
      console.error("[mods-page] Remove failed:", error)
      setInstallError(error instanceof Error ? error.message : "Не удалось удалить мод.")
    } finally {
      setInstalling(null)
    }
  }, [targetBuild, builds, findInstalledEntry, removeContentFromBuild, reloadBuilds, setBuilds])

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

      {installError && (
        <div className="flex items-center gap-2 border-b border-red-500/20 bg-red-500/10 px-4 py-2">
          <IconPuzzle className="h-3.5 w-3.5 shrink-0 text-red-400" />
          <p className="text-[12px] text-red-300">{installError}</p>
        </div>
      )}

      {installSuccess && (
        <div className="flex items-center gap-2 border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-2">
          <IconCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <p className="text-[12px] text-emerald-300">{installSuccess}</p>
        </div>
      )}

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
              const installedItem = findInstalledEntry(mod)
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
                  <div className="flex shrink-0 flex-col gap-1.5">
                    {isBusy ? (
                      <div className="flex items-center justify-center rounded-lg bg-white/[0.04] px-3 py-1.5">
                        <IconLoader2 className="h-3.5 w-3.5 animate-spin text-white/60" />
                      </div>
                    ) : installedItem ? (
                      <>
                        <button
                          type="button"
                          onClick={() => updateMod(mod)}
                          title="Загрузить последнюю версию"
                          className="flex items-center justify-center gap-1.5 rounded-lg bg-[#5a6ff2]/15 px-2.5 py-1 text-[11px] font-medium text-[#8b9bff] transition-colors hover:bg-[#5a6ff2]/25"
                        >
                          <IconRefresh className="h-3 w-3" />
                          Обновить
                        </button>
                        <button
                          type="button"
                          onClick={() => removeMod(mod)}
                          title="Удалить файл мода из сборки"
                          className="flex items-center justify-center gap-1.5 rounded-lg bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/20"
                        >
                          <IconTrash className="h-3 w-3" />
                          Удалить
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => installMod(mod)}
                        disabled={builds.length === 0}
                        title={builds.length === 0 ? "Нет сборок — создайте или установите сборку" : `Установить в ${targetBuild?.name ?? "сборку"}`}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#5a6ff2] px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-[#6c7ff6] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <IconDownload className="h-3.5 w-3.5" />
                        Скачать
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
