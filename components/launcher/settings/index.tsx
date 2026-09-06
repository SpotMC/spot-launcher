import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { changeLanguage } from "@/src/i18n"
import { cn } from "@/lib/utils"
import { IconCpu, IconDeviceDesktop, IconShield, IconFolder, IconSettings } from "@tabler/icons-react"
import { MemorySlider } from "@/components/ui/memory-slider"
import { useMemoryOptions } from "@/src/hooks/use-memory-options"
import { memoryToMb, mbToMemory } from "@/lib/memory"
import { settingsTabs, presetThemes, applyTheme } from "./data"
import { SettingsTabs } from "./settings-tabs"
import { SettingsResolution } from "./settings-resolution"
import { SettingsJava } from "./settings-java"
import { SettingsAuthlib } from "./settings-authlib"
import { SettingsThemes } from "./settings-themes"
import { SettingsLanguage } from "./settings-language-about"
import { SettingsAbout } from "./settings-language-about"
import { SettingsLegal } from "./settings-legal"
import { SettingsUpdate } from "./settings-update"
import type { SettingsTab, JavaInstallation } from "./types"
import { PageHeader } from "../page-header"

export function SettingsPage() {
  const { t } = useTranslation()
  const { maxMb, snapPoints } = useMemoryOptions()
  const settingsHydratedRef = useRef(false)
  const pendingSettingsRef = useRef<Record<string, number>>({})
  const lastPersistedSettingsRef = useRef<Record<string, string>>({})
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>("game")
  const [selectedTheme, setSelectedTheme] = useState<string>("orange")
  const [selectedResolution, setSelectedResolution] = useState("1920x1080 (Full HD)")
  const [customWidth, setCustomWidth] = useState("1920")
  const [customHeight, setCustomHeight] = useState("1080")
  const [useCustomResolution, setUseCustomResolution] = useState(false)
  const [selectedJavaPath, setSelectedJavaPath] = useState("")
  const [javaArgs, setJavaArgs] = useState("")
  const [memoryMin, setMemoryMin] = useState("512M")
  const [memoryMax, setMemoryMax] = useState("4G")
  const [showJavaModal, setShowJavaModal] = useState(false)
  const [editingJavaVersion, setEditingJavaVersion] = useState("")
  const [detectedJavaInstallations, setDetectedJavaInstallations] = useState<JavaInstallation[]>([])
  const [loadingJavaInstallations, setLoadingJavaInstallations] = useState(false)
  const [authlibInjectorEnabled, setAuthlibInjectorEnabled] = useState(false)
  const [injectorType, setInjectorType] = useState<"authlib" | "retroauth">("retroauth")
  const [showAuthlibWarningModal, setShowAuthlibWarningModal] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("language") : null
    return stored || "ru"
  })
  const [instancesRoot, setInstancesRoot] = useState("")

  useEffect(() => {
    const stored = localStorage.getItem("theme")
    const id = stored || "orange"
    const theme = presetThemes.find(t => t.id === id)
    if (theme) { setSelectedTheme(id); applyTheme(theme) }
  }, [])

  useEffect(() => {
    const theme = presetThemes.find(t => t.id === selectedTheme)
    if (theme) applyTheme(theme)
  }, [selectedTheme])

  useEffect(() => {
    changeLanguage(selectedLanguage)
    localStorage.setItem("language", selectedLanguage)
  }, [selectedLanguage])

  useEffect(() => {
    let cancelled = false

    const loadSettings = async () => {
      const api = window.electronAPI
      if (!api) {
        settingsHydratedRef.current = true
        return
      }

      const [
        authlibSetting,
        retroauthSetting,
        javaPathSetting,
        javaArgsSetting,
        memoryMinSetting,
        memoryMaxSetting,
        selectedResolutionSetting,
        customWidthSetting,
        customHeightSetting,
        useCustomResolutionSetting,
      ] = await Promise.all([
        api.getSetting("authlibInjectorEnabled"),
        api.getSetting("retroauthInjectorEnabled"),
        api.getSetting("javaPath"),
        api.getSetting("javaArgs"),
        api.getSetting("memoryMin"),
        api.getSetting("memoryMax"),
        api.getSetting("selectedResolution"),
        api.getSetting("customWidth"),
        api.getSetting("customHeight"),
        api.getSetting("useCustomResolution"),
      ])

      if (cancelled) return

      const authlibEnabled = authlibSetting === "true"
      const retroauthEnabled = retroauthSetting === "true"
      setAuthlibInjectorEnabled(authlibEnabled || retroauthEnabled)
      setInjectorType(authlibEnabled ? "authlib" : "retroauth")
      if (javaPathSetting) {
        const base = javaPathSetting.split(/[\\/]/).pop()?.toLowerCase() ?? ""
        const valid = base === "java" || base === "java.exe" || base === "javaw.exe"
        if (!valid) {
          void api.setSetting("javaPath", "")
        } else {
          setSelectedJavaPath(javaPathSetting)
        }
      }
      setJavaArgs(javaArgsSetting ?? "")
      if (memoryMinSetting) setMemoryMin(memoryMinSetting)
      if (memoryMaxSetting) setMemoryMax(memoryMaxSetting)
      if (selectedResolutionSetting) setSelectedResolution(selectedResolutionSetting)
      if (customWidthSetting) setCustomWidth(customWidthSetting)
      if (customHeightSetting) setCustomHeight(customHeightSetting)
      setUseCustomResolution(useCustomResolutionSetting === "true")
      lastPersistedSettingsRef.current = {
        javaArgs: javaArgsSetting ?? "",
        memoryMin: memoryMinSetting ?? "512M",
        memoryMax: memoryMaxSetting ?? "4G",
        selectedResolution: selectedResolutionSetting ?? "1920x1080 (Full HD)",
        customWidth: customWidthSetting ?? "1920",
        customHeight: customHeightSetting ?? "1080",
        useCustomResolution: String(useCustomResolutionSetting === "true"),
      }
      try {
        const root = await api.getInstancesRoot()
        if (!cancelled) setInstancesRoot(root ?? "")
      } catch {}
      settingsHydratedRef.current = true
    }

    void loadSettings()
    return () => { cancelled = true }
  }, [])

  const persistSetting = useCallback((key: string, value: string) => {
    if (!settingsHydratedRef.current) return
    if (lastPersistedSettingsRef.current[key] === value) return
    if (pendingSettingsRef.current[key]) {
      window.clearTimeout(pendingSettingsRef.current[key])
    }
    pendingSettingsRef.current[key] = window.setTimeout(() => {
      delete pendingSettingsRef.current[key]
      if (lastPersistedSettingsRef.current[key] === value) return
      lastPersistedSettingsRef.current[key] = value
      void window.electronAPI?.setSetting(key, value)
      window.dispatchEvent(new CustomEvent("launcher-setting-changed", { detail: { key, value } }))
    }, 250)
  }, [])

  useEffect(() => () => {
    Object.values(pendingSettingsRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId))
    pendingSettingsRef.current = {}
  }, [])

  useEffect(() => {
    persistSetting("javaArgs", javaArgs)
  }, [javaArgs, persistSetting])
  useEffect(() => { persistSetting("memoryMin", memoryMin.trim() || "512M") }, [memoryMin, persistSetting])
  useEffect(() => { persistSetting("memoryMax", memoryMax.trim() || "4G") }, [memoryMax, persistSetting])

  useEffect(() => { persistSetting("selectedResolution", selectedResolution) }, [persistSetting, selectedResolution])
  useEffect(() => { persistSetting("customWidth", customWidth) }, [customWidth, persistSetting])
  useEffect(() => { persistSetting("customHeight", customHeight) }, [customHeight, persistSetting])
  useEffect(() => { persistSetting("useCustomResolution", String(useCustomResolution)) }, [persistSetting, useCustomResolution])

  useEffect(() => {
    if (!showJavaModal) return
    setLoadingJavaInstallations(true)
    void window.electronAPI?.detectJavaInstallations().then(installs => {
      setDetectedJavaInstallations(installs ?? [])
      setLoadingJavaInstallations(false)
    }).catch(() => {
      setDetectedJavaInstallations([])
      setLoadingJavaInstallations(false)
    })
  }, [showJavaModal])

  const handlePickJavaFile = async () => {
    const picked = await window.electronAPI?.pickJavaFile()
    if (picked) {
      setSelectedJavaPath(picked)
      void window.electronAPI?.setSetting("javaPath", picked)
      setShowJavaModal(false)
    }
  }

  const handleChangeInstancesDir = async () => {
    if (!window.electronAPI) return
    const picked = await window.electronAPI.pickFolder("Выбрать папку для сборок")
    if (!picked) return
    const result = await window.electronAPI.setInstancesRoot(picked)
    if (result.success && result.root) {
      setInstancesRoot(result.root)
    } else if (result.error) {
      console.warn("[Настройки] Не удалось сменить папку сборок:", result.error)
    }
  }

  return (
    <div className="relative h-[calc(100vh-5rem)] overflow-hidden rounded-2xl bg-[#0c0d10] border border-white/[0.06] transition-all duration-300 animate-in fade-in-0 slide-in-from-bottom-4">
      <div className="relative z-10 h-full flex flex-col">
        <div className="flex h-[46px] shrink-0 items-center gap-3 border-b border-white/[0.04] bg-[#0c0d10] px-4">
          <div className="flex items-center gap-2 min-w-0">
            <IconSettings className="w-5 h-5 text-white/70" />
            <h1 className="text-[14px] font-semibold text-white/90">{t("settings.title")}</h1>
          </div>
          <div className="flex-1" />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <SettingsTabs tabs={settingsTabs} activeTab={activeSettingsTab} setActiveTab={setActiveSettingsTab} t={t} />

        {activeSettingsTab === "game" && (
          <div className="min-h-0 flex-1 space-y-8 overflow-y-auto pr-6 animate-in fade-in-0 slide-in-from-left-4 duration-300">
            <section className="space-y-4">
              <h3 className="text-lg font-medium text-white/90 flex items-center gap-2">
                <IconDeviceDesktop className="w-5 h-5 text-[#8d9ff5]" strokeWidth={1.5} />
                {t("settings.resolution")}
              </h3>
              <SettingsResolution
                selectedResolution={selectedResolution}
                setSelectedResolution={setSelectedResolution}
                useCustomResolution={useCustomResolution}
                setUseCustomResolution={setUseCustomResolution}
                customWidth={customWidth}
                setCustomWidth={setCustomWidth}
                customHeight={customHeight}
                setCustomHeight={setCustomHeight}
              />
            </section>

            <section className="space-y-4">
              <h3 className="text-lg font-medium text-white/90 flex items-center gap-2">
                <IconCpu className="w-5 h-5 text-[#8d9ff5]" strokeWidth={1.5} />
                {t("settings.ram")}
              </h3>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-2.5">
                <label className="block text-sm font-medium text-white/80">{t("settings.ram.allocated")}</label>
                <MemorySlider
                  value={memoryToMb(memoryMax)}
                  min={512}
                  max={maxMb}
                  step={64}
                  snapPoints={snapPoints}
                  snapRange={512}
                  unit="MB"
                  onChange={(v) => setMemoryMax(mbToMemory(v))}
                />
                <p className="text-xs text-white/40">{t("settings.ram.desc")}</p>
              </div>
</section>

            <section className="space-y-4">
              <h3 className="text-lg font-medium text-white/90 flex items-center gap-2">
                <IconFolder className="w-5 h-5 text-[#8d9ff5]" strokeWidth={1.5} />
                Папка сборок
              </h3>
              <div className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <p className="text-sm text-white/40 mb-3">Сюда сохраняются файлы сборок (mods, resourcepacks, shaderpacks). При смене папки существующие сборки переносятся автоматически.</p>
                <div className="flex items-center gap-3">
                  <code className="flex-1 truncate rounded-lg bg-white/[0.05] border border-white/[0.08] px-3 py-2 text-xs text-white/40">{instancesRoot || "Загрузка…"}</code>
                  <button type="button" onClick={() => void handleChangeInstancesDir()} className="px-3 py-2 rounded-lg text-xs font-medium bg-[#5a6ff2] hover:bg-[#6c7ff6] text-white shrink-0">
                    Изменить
                  </button>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-lg font-medium text-white/90 flex items-center gap-2">
                <IconShield className="w-5 h-5 text-[#8d9ff5]" strokeWidth={1.5} />
                {t("settings.authlib")}
              </h3>
              <SettingsAuthlib
                enabled={authlibInjectorEnabled}
                setEnabled={setAuthlibInjectorEnabled}
                injectorType={injectorType}
                setInjectorType={setInjectorType}
                showWarningModal={showAuthlibWarningModal}
                setShowWarningModal={setShowAuthlibWarningModal}
              />
            </section>
          </div>
        )}

        {activeSettingsTab === "java" && (
          <div className="min-h-0 flex-1 overflow-y-auto pr-6 pb-2 animate-in fade-in-0 slide-in-from-left-4 duration-300">
            <SettingsJava
              selectedJavaPath={selectedJavaPath}
              setSelectedJavaPath={setSelectedJavaPath}
              javaArgs={javaArgs}
              setJavaArgs={setJavaArgs}
              showJavaModal={showJavaModal}
              setShowJavaModal={setShowJavaModal}
              editingJavaVersion={editingJavaVersion}
              setEditingJavaVersion={setEditingJavaVersion}
              detectedJavaInstallations={detectedJavaInstallations}
              loadingJavaInstallations={loadingJavaInstallations}
              onPickJavaFile={handlePickJavaFile}
            />
          </div>
        )}

        {activeSettingsTab === "themes" && (
          <div className="min-h-0 flex-1 overflow-y-auto pr-6">
            <SettingsThemes
              selectedTheme={selectedTheme}
              setSelectedTheme={setSelectedTheme}
            />
          </div>
        )}

        {activeSettingsTab === "language" && (
          <div className="min-h-0 flex-1 overflow-y-auto pr-6">
            <SettingsLanguage selectedLanguage={selectedLanguage} setSelectedLanguage={setSelectedLanguage} t={t} />
          </div>
        )}

        {activeSettingsTab === "about" && (
          <div className="min-h-0 flex-1 overflow-y-auto pr-6 space-y-8">
            <SettingsAbout t={t} />
            <SettingsLegal />
            <SettingsUpdate />
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
