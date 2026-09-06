import { useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import type { Account } from "@/src/AccountsContext"
import { useLaunchControls } from "@/src/LaunchLogsContext"
import { useBuildLaunch, saveLastLaunchedPrefs, formatLoaderLabel, normalizeJavaPath, loadLaunchSettings, resolveLaunchDimensions } from "@/src/hooks/use-build-launch"

type UseHomeLaunchParams = {
  account?: Account
  selectedVersion: string
  selectedModLoader: string
  selectedLoaderVersion?: string
}

export function useHomeLaunch({ account, selectedVersion, selectedModLoader, selectedLoaderVersion }: UseHomeLaunchParams) {
  const { t } = useTranslation()
  const { isRunning, setIsRunning, clearLogs, addLog, launchUi, patchLaunchUi } = useLaunchControls()
  const { launchInstance } = useBuildLaunch({ account })

  const launchVanilla = useCallback(async (forceServer?: { ip: string; port?: number }, versionOverride?: string, loaderOverride?: string) => {
    if (!account || !window.electronAPI) return

    const activeVersion = versionOverride || selectedVersion
    const activeLoader = loaderOverride || selectedModLoader
    const usesSkinInjector = account.type === "xnskins" || account.type === "elyby"
    const normalizedJavaPath = normalizeJavaPath(await window.electronAPI.getSetting("javaPath"))
    const settings = await loadLaunchSettings()
    const { width, height } = resolveLaunchDimensions(settings)
    const server = forceServer ? forceServer.ip : ""
    const serverPort = forceServer ? String(forceServer.port ?? "") : ""

    patchLaunchUi({
      isLaunching: true,
      progress: 0,
      status: t("launcherStatus.preparing"),
      phase: "launching",
      downloadedBytes: 0,
      totalBytes: null,
      currentFile: null,
      totalFiles: null,
      currentFileName: null,
    })
    clearLogs()
    addLog(`[Запуск] Minecraft ${activeVersion} · ${formatLoaderLabel(activeLoader, selectedLoaderVersion)} · ${account.username}`)

    const result = await window.electronAPI.launchMinecraft({
      version: activeVersion,
      modLoader: activeLoader as "vanilla" | "forge" | "fabric" | "quilt" | "liteloader" | "optifine" | "neoforge",
      ...(selectedLoaderVersion ? { loaderVersion: selectedLoaderVersion } : {}),
      account: { type: account.type, username: account.username, uuid: account.uuid, accessToken: account.accessToken },
      memory: { min: settings.savedMemoryMin || "512M", max: settings.savedMemoryMax || "4G" },
      width,
      height,
      authlibInjectorEnabled: usesSkinInjector && settings.authlibEnabled !== "false",
      retroauthInjectorEnabled: usesSkinInjector,
      ...(normalizedJavaPath ? { javaPath: normalizedJavaPath } : {}),
      ...(settings.savedJavaArgs ? { javaArgs: settings.savedJavaArgs } : {}),
      ...(server.trim() ? { quickPlayMultiplayer: `${server.trim()}:${serverPort.trim() || "25565"}` } : {}),
    })

    patchLaunchUi(result.success
      ? { isLaunching: false, phase: "idle", progress: 100, status: t("launcherStatus.running") }
      : { isLaunching: false, status: result.error ?? "Ошибка запуска" })
    if (!result.success) addLog(`[Лаунчер] ${result.error ?? "Ошибка запуска"}`, "error")
    if (result.success) {
      setIsRunning(true)
      saveLastLaunchedPrefs(activeVersion, selectedModLoader, selectedLoaderVersion)
    }
  }, [account, addLog, clearLogs, patchLaunchUi, selectedLoaderVersion, selectedModLoader, selectedVersion, setIsRunning, t])

  const handlePlay = useCallback(async (forceServer?: { ip: string; port?: number }) => {
    if (isRunning) {
      return await window.electronAPI?.stopMinecraft()
    }
    if (!account || !window.electronAPI) return

    if (selectedModLoader === "instance") {
      if (!selectedVersion) {
        patchLaunchUi({ isLaunching: false, phase: "idle", progress: null, status: "Не выбрана сборка" })
        addLog("[Лаунчер] Не выбрана сборка", "error")
        return
      }

      const builds = await window.electronAPI.loadBuilds() ?? []
      const build = builds.find((item) => item.name === selectedVersion)
      if (!build) {
        patchLaunchUi({ isLaunching: false, phase: "idle", progress: null, status: "Сборка не найдена" })
        addLog(`[Лаунчер] Сборка "${selectedVersion}" не найдена`, "error")
        return
      }

      await launchInstance(build)
      return
    }

    if (!selectedVersion) {
      patchLaunchUi({ isLaunching: false, phase: "idle", progress: null, status: "Не выбрана версия" })
      addLog("[Лаунчер] Не выбрана версия Minecraft", "error")
      return
    }

    await launchVanilla(forceServer)
  }, [isRunning, account, selectedModLoader, selectedVersion, patchLaunchUi, addLog, launchInstance, launchVanilla])

  const handlePlayVersion = useCallback(async (version: string) => {
    if (isRunning) {
      return await window.electronAPI?.stopMinecraft()
    }
    if (!account) return
    await launchVanilla(undefined, version, "vanilla")
  }, [account, isRunning, launchVanilla])

  const launchDetails = useMemo(() => {
    const parts: string[] = []
    if (launchUi.currentFile !== null && launchUi.totalFiles !== null && launchUi.totalFiles > 0) {
      parts.push(`${Math.min(launchUi.currentFile, launchUi.totalFiles)} / ${launchUi.totalFiles} файлов`)
    }
    if (launchUi.currentFileName) {
      parts.push(launchUi.currentFileName)
    }
    return parts.join(" · ")
  }, [launchUi.currentFile, launchUi.currentFileName, launchUi.totalFiles])

  return { isRunning, launchUi, launchDetails, handlePlay, handlePlayVersion }
}
