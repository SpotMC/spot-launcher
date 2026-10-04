import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { useTranslation } from "react-i18next"
import { IconAlertTriangle, IconCircleX, IconPower } from "@tabler/icons-react"

interface SettingsAuthlibProps {
  enabled: boolean
  setEnabled: (v: boolean) => void
  injectorType: "authlib" | "retroauth"
  setInjectorType: (type: "authlib" | "retroauth") => void
  showWarningModal: boolean
  setShowWarningModal: (v: boolean) => void
}

export function SettingsAuthlib({
  enabled,
  setEnabled,
  injectorType,
  setInjectorType,
  showWarningModal,
  setShowWarningModal,
}: SettingsAuthlibProps) {
  const { t } = useTranslation()

  const handleToggle = () => {
    if (enabled) {
      setShowWarningModal(true)
    } else {
      setEnabled(true)
      if (injectorType === "authlib") {
        window.electronAPI?.setSetting("authlibInjectorEnabled", "true")
        window.electronAPI?.setSetting("retroauthInjectorEnabled", "false")
      } else {
        window.electronAPI?.setSetting("authlibInjectorEnabled", "false")
        window.electronAPI?.setSetting("retroauthInjectorEnabled", "true")
      }
    }
  }

  const handleTypeChange = (type: "authlib" | "retroauth") => {
    setInjectorType(type)
    if (type === "retroauth") {
      window.electronAPI?.setSetting("retroauthInjectorEnabled", "true")
      window.electronAPI?.setSetting("authlibInjectorEnabled", "false")
      setEnabled(true)
    } else {
      window.electronAPI?.setSetting("retroauthInjectorEnabled", "false")
      window.electronAPI?.setSetting("authlibInjectorEnabled", "true")
      setEnabled(true)
    }
  }

  return (
    <>
      <div className="p-4 rounded-xl border border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="font-medium text-foreground">Authlib Injector</div>
            <p className="text-sm text-muted-foreground mt-1">{t("settings.authlibDesc")}</p>
          </div>
          <button
            onClick={handleToggle}
            className={cn(
              "relative w-14 h-8 rounded-full transition-all duration-300",
              enabled ? "bg-primary" : "bg-muted"
            )}
          >
            <span className={cn("absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300", enabled ? "left-7" : "left-1")} />
          </button>
        </div>

        {enabled && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => handleTypeChange("authlib")}
                className={cn(
                  "flex-1 px-3 py-2 rounded-lg text-sm transition-colors",
                  injectorType === "authlib" 
                    ? "bg-primary/20 text-primary border border-primary/50" 
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                Authlib Injector
              </button>
              <button
                onClick={() => handleTypeChange("retroauth")}
                className={cn(
                  "flex-1 px-3 py-2 rounded-lg text-sm transition-colors",
                  injectorType === "retroauth" 
                    ? "bg-primary/20 text-primary border border-primary/50" 
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                RetroAuth
              </button>
            </div>
            <div className="flex gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10">
                <svg className="w-4 h-4" viewBox="0 0 480 480" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#217e5c" d="M262 207.5V351h-37V64h37zM193.5 98v14.5H86V197h93v30H86v94l54.3.2 54.2.3v29l-72.7.3-72.8.2V83l72.3.2 72.2.3zm135.9 55.7c.3 1 7.3 31.7 15.6 68.3 8.4 36.6 15.5 67.3 15.8 68.3.4 1 7.8-26.8 18.2-68.3l17.5-70h20.2c12.5 0 20.3.4 20.3 1 0 .5-6.3 22.9-14 49.7-7.8 26.9-22.4 77.8-32.6 113.3s-19.5 67.2-20.6 70.5c-4.4 12.9-13.6 28.5-20.1 34.2-8.6 7.6-23 11.4-35.5 9.4-8.9-1.5-13.3-2.5-13.4-3.1-.1-.3.7-6.7 1.7-14.3l1.9-13.7 6.2.6c16.6 1.7 21-3.3 30.9-35.2l4.7-15.2-5.1-16.8c-2.7-9.3-10.4-35.6-17.1-58.4-19.1-65.1-35-119.4-35.5-120.8-.3-.9 4.1-1.2 20-1.2 18.5 0 20.4.2 20.9 1.7"/>
                </svg>
                <span className="text-green-400 text-sm">Ely.By</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#8d9ff5]/10">
                <svg className="w-4 h-4" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#0078d4" d="M67.328 67.331h60.669V128H67.328zm-67.325 0h60.669V128H.003zM67.328 0h60.669v60.669H67.328zM.003 0h60.669v60.669H.003z"/>
                </svg>
                <span className="text-[#8d9ff5] text-sm">Microsoft</span>
              </div>
            </div>
          </div>
        )}
        
        {injectorType === "retroauth" && enabled && (
          <div className="mt-3 text-xs text-muted-foreground">
            Для всех версий + HD скины и плащи
          </div>
        )}
      </div>

      {showWarningModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in-0">
          <div className="w-full max-w-md p-6 rounded-2xl bg-card border border-destructive/50 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-destructive/20 flex items-center justify-center">
                <IconAlertTriangle className="w-6 h-6 text-destructive" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">{t("settings.warning.enableAuthlib.title")}</h3>
                <p className="text-sm text-muted-foreground">{t("settings.areYouSure")}</p>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 mb-6">
              <p className="text-foreground">{t("settings.warning.enableAuthlib.message")}</p>
              <p className="text-sm text-muted-foreground mt-2">{t("settings.warning.enableAuthlib.detail")}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowWarningModal(false)}
                className="flex items-center justify-center gap-2 flex-1 px-4 py-3 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 text-foreground transition-colors"
              >
                <IconCircleX className="w-4 h-4" strokeWidth={1.75} />
                {t("settings.cancel")}
              </button>
              <button
                onClick={() => {
                  setEnabled(false)
                  window.electronAPI?.setSetting("authlibInjectorEnabled", "false")
                  window.electronAPI?.setSetting("retroauthInjectorEnabled", "false")
                  setShowWarningModal(false)
                }}
                className="flex items-center justify-center gap-2 flex-1 px-4 py-3 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground font-medium transition-colors"
              >
                <IconPower className="w-4 h-4" strokeWidth={1.75} />
                {t("settings.disable")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
