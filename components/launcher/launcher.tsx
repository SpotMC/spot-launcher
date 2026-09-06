import { useCallback, useEffect, useState } from "react"
import { AccountsPage } from "./accounts-page"
import { HomePage } from "./home-page"
import { LogsPage } from "./logs-page"
import { SettingsPage } from "./settings"
import { SkinsPage } from "./skins-page"
import { VersionsPage } from "./versions-page"
import { ModsPage } from "./mods-page"
import { InstancePage } from "./instance"
import { StatisticsPage } from "./statistics-page"
import { OnboardingModal } from "./onboarding-modal"
import { LoginGate } from "./login-gate"
import { JavaGate } from "./java-gate"
import { Sidebar, type TabId } from "./sidebar"
import { LaunchOverlay } from "./launch/launch-overlay"
import { applyTheme, presetThemes } from "./settings/data"
import { useAccounts } from "@/src/AccountsContext"

interface LauncherProps {
  onReady?: () => void
}

export function Launcher({ onReady }: LauncherProps) {
  const { accounts } = useAccounts()
  const [activeTab, setActiveTab] = useState<TabId>("home")
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [selectedTheme, setSelectedTheme] = useState(() => localStorage.getItem("theme") || "spot")

  useEffect(() => {
    const id = window.setTimeout(() => onReady?.(), 0)
    return () => window.clearTimeout(id)
  }, [onReady])

  useEffect(() => {
    const theme = presetThemes.find((item) => item.id === selectedTheme)
    if (theme) applyTheme(theme)
  }, [selectedTheme])

  useEffect(() => {
    let cancelled = false
    const loadOnboardingState = async () => {
      const completed = await window.electronAPI?.getSetting("onboardingCompleted")
      if (!cancelled) setShowOnboarding(completed !== "true")
    }
    void loadOnboardingState()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const handleResetOnboarding = () => {
      setShowOnboarding(true)
      setActiveTab("home")
    }
    window.addEventListener("launcher:onboarding-reset", handleResetOnboarding)
    return () => window.removeEventListener("launcher:onboarding-reset", handleResetOnboarding)
  }, [])

  const finishOnboarding = useCallback(() => {
    setShowOnboarding(false)
    void window.electronAPI?.setSetting("onboardingCompleted", "true")
  }, [])

  useEffect(() => { onReady?.() }, [onReady])

  const renderPage = () => {
    switch (activeTab) {
      case "home": return <HomePage onNavigate={setActiveTab} />
      case "builds": return <InstancePage />
      case "stats": return <StatisticsPage />
      case "logs": return <LogsPage />
      case "settings": return <SettingsPage />
      case "accounts": return <AccountsPage />
      case "skins": return <SkinsPage />
      case "versions": return <VersionsPage />
      case "mods": return <ModsPage />
      default: return null
    }
  }

  return (
    <JavaGate>
      {accounts.length === 0 ? (
        <LoginGate />
      ) : (
        <div className="relative flex h-full w-full overflow-hidden bg-[#0e0f12]">
          <div className="relative z-10 flex h-full w-full">
            <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

            <main className="flex-1 min-h-0 overflow-hidden bg-transparent flex flex-col">
              {renderPage()}
            </main>
          </div>

          {showOnboarding && (
            <OnboardingModal
              selectedTheme={selectedTheme}
              onSelectTheme={setSelectedTheme}
              onFinish={finishOnboarding}
              onSkip={finishOnboarding}
            />
          )}
        </div>
      )}
      <LaunchOverlay />
    </JavaGate>
  )
}
