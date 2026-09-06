import { useEffect, useState } from "react"
import { ActivityCenterProvider } from "./ActivityCenterContext"
import { Launcher } from '@/components/launcher/launcher'
import { LaunchLogsProvider } from "./LaunchLogsContext"
import { AccountsProvider } from './AccountsContext'
import { TitleBar } from './TitleBar'
import { initI18n } from './i18n'
import { updateSplash, hideSplash } from './splash'

export function App() {
  const [modulesReady, setModulesReady] = useState(false)
  const [launcherReady, setLauncherReady] = useState(false)

  useEffect(() => {
    updateSplash({ step: "i18n", status: "Загрузка языковых модулей...", progress: 15 })
  }, [])

  useEffect(() => {
    let cancelled = false
    void initI18n().then(() => {
      if (cancelled) return
      setModulesReady(true)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!modulesReady) return
    updateSplash({ step: "core", status: "Загрузка ядра...", progress: 45 })
  }, [modulesReady])

  useEffect(() => {
    if (!launcherReady) return
    updateSplash({ step: "builds", status: "Подготовка интерфейса...", progress: 80 })
    const id = window.setTimeout(() => {
      updateSplash({ step: "ready", status: "Готово", progress: 100 })
      window.setTimeout(hideSplash, 220)
    }, 350)
    return () => window.clearTimeout(id)
  }, [launcherReady])

  useEffect(() => {
    const onHydrated = () => {
      updateSplash({ step: "ready", status: "Готово", progress: 100 })
      window.setTimeout(hideSplash, 220)
    }
    window.addEventListener("app:hydrated", onHydrated)
    return () => window.removeEventListener("app:hydrated", onHydrated)
  }, [])

  return (
    <ActivityCenterProvider>
      <AccountsProvider>
        <LaunchLogsProvider>
          <div className="flex h-screen flex-col overflow-hidden bg-[#0e0f12]">
            <TitleBar />
            <div className="flex-1 overflow-hidden">
              {modulesReady && <Launcher onReady={() => setLauncherReady(true)} />}
            </div>
          </div>
        </LaunchLogsProvider>
      </AccountsProvider>
    </ActivityCenterProvider>
  )
}
