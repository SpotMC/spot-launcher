import { useState, useEffect, useRef, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { IconUser, IconUserMinus, IconLoader2, IconCirclePlus, IconTrash, IconX, IconCheck, IconLogin, IconPlus, IconChevronUp, IconChevronDown, IconExternalLink, IconRefresh, IconCopy } from "@tabler/icons-react"
import { CachedAvatar } from "@/components/ui/cached-avatar"
import { useAccounts } from "@/src/AccountsContext"
import { cn } from "@/lib/utils"
import { PageHeader } from "./page-header"

type AccountWithAvatar = { uuid?: string; type?: string }

export const getAvatarUrl = (account: AccountWithAvatar, username: string) => {
  const value = account.uuid || username
  return `https://mcskinapi-three.vercel.app/avatar/${encodeURIComponent(value)}?skin_type=microsoft`
}

type AccountType = "microsoft"

export type { AccountType }

export const getAccountTypeInfo = (t: (k: string) => string): Record<AccountType, { name: string; description: string; color: string }> => ({
  microsoft: { name: t("accounts.microsoft"), description: t("accounts.microsoftDesc"), color: "#2563EB" },
})

export function AccountsPage() {
  const { t } = useTranslation()
  const accountTypeInfo = getAccountTypeInfo(t)
  const { accounts, addAccount, removeAccount, setActiveAccount, moveAccount } = useAccounts()
  const [showAddModal, setShowAddModal] = useState(false)
  const [microsoftAuthLoading, setMicrosoftAuthLoading] = useState(false)
  const [authProgressMessage, setAuthProgressMessage] = useState("")
  const [authError, setAuthError] = useState("")
  const [microsoftMethod, setMicrosoftMethod] = useState<"choose" | "oauth" | "device">("choose")
  const [deviceCodeInfo, setDeviceCodeInfo] = useState<{
    deviceCode: string
    userCode: string
    verificationUriComplete: string
    interval: number
  } | null>(null)
  const [devicePolling, setDevicePolling] = useState(false)
  const [deviceStatus, setDeviceStatus] = useState<"waiting" | "expired" | "done">("waiting")
  const [copied, setCopied] = useState(false)
  const cleanupRef = useRef<(() => void) | null>(null)

  const handleCopyCode = useCallback((code: string) => {
    navigator.clipboard?.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onAuthProgress?.((msg) => {
      setAuthProgressMessage(msg)
    })
    cleanupRef.current = () => unsubscribe?.()
    return () => { cleanupRef.current?.() }
  }, [])

  const handleMicrosoftLogin = useCallback(async () => {
    setMicrosoftAuthLoading(true)
    setAuthError("")
    try {
      const result = await window.electronAPI?.loginMicrosoft()
      if (result) {
        addAccount({
          id: result.id,
          type: "microsoft",
          username: result.username,
          uuid: result.uuid,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          isActive: accounts.length === 0,
        })
        setMicrosoftMethod("choose")
        setShowAddModal(false)
      }
    } catch (err: unknown) {
      let message = err instanceof Error ? err.message : t("accounts.unknownError")
      if (message === "Авторизация отменена" || message.includes("отменена")) {
        message = "Авторизация отменена"
      }
      setAuthError(message)
    } finally {
      setMicrosoftAuthLoading(false)
    }
  }, [addAccount, accounts.length])

  const handleEnableDeviceCode = useCallback(async () => {
    setMicrosoftAuthLoading(true)
    setAuthError("")
    setDeviceStatus("waiting")
    setDeviceCodeInfo(null)
    setMicrosoftMethod("device")
    try {
      const info = await window.electronAPI?.startMicrosoftDeviceCode()
      if (info) {
        setDeviceCodeInfo({
          deviceCode: info.deviceCode,
          userCode: info.userCode,
          verificationUriComplete: info.verificationUriComplete,
          interval: info.interval,
        })
        setDevicePolling(true)
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : t("accounts.unknownError"))
      setMicrosoftMethod("device")
    } finally {
      setMicrosoftAuthLoading(false)
    }
  }, [t])

  const finishDeviceLogin = useCallback((result: { id: string; username: string; uuid?: string; accessToken: string; refreshToken?: string }) => {
    addAccount({
      id: result.id,
      type: "microsoft",
      username: result.username,
      uuid: result.uuid,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      isActive: accounts.length === 0,
    })
    setDeviceStatus("done")
    setDevicePolling(false)
    setDeviceCodeInfo(null)
    setMicrosoftMethod("choose")
    setShowAddModal(false)
  }, [addAccount, accounts.length])

  useEffect(() => {
    if (!deviceCodeInfo || !devicePolling || deviceStatus !== "waiting") return

    let cancelled = false
    let pollTimer: ReturnType<typeof setTimeout> | null = null

    const poll = async () => {
      if (cancelled) return
      try {
        const result = await window.electronAPI?.pollMicrosoftDeviceCode(deviceCodeInfo.deviceCode)
        if (cancelled) return
        if (!result) return
        if (result.status === "complete" && result.account) {
          finishDeviceLogin(result.account)
          return
        }
        if (result.status === "expired") {
          setDevicePolling(false)
          setDeviceStatus("expired")
          setAuthError(t("accounts.deviceExpired"))
          return
        }
        if (result.status === "error" && !result.retryable) {
          setDevicePolling(false)
          setDeviceStatus("expired")
          setAuthError(result.message)
          return
        }
        if (result.status === "error" && result.retryable) {
          setAuthError(result.message)
        }
        const delayMs = (result.status === "pending" && result.slowDown ? deviceCodeInfo.interval + 5 : deviceCodeInfo.interval) * 1000
        pollTimer = setTimeout(poll, Math.max(delayMs, 5000))
      } catch (err: unknown) {
        if (cancelled) return
        setAuthError(err instanceof Error ? err.message : t("accounts.unknownError"))
        pollTimer = setTimeout(poll, deviceCodeInfo.interval * 1000)
      }
    }

    pollTimer = setTimeout(poll, deviceCodeInfo.interval * 1000)
    return () => {
      cancelled = true
      if (pollTimer) clearTimeout(pollTimer)
    }
  }, [deviceCodeInfo, devicePolling, deviceStatus, finishDeviceLogin, t])

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl bg-[#0c0d10] border border-white/[0.06]">
        <div className="relative z-10 h-full flex flex-col">
          <div className="flex h-[46px] shrink-0 items-center gap-3 border-b border-white/[0.04] bg-[#0c0d10] px-4">
            <div className="flex items-center gap-2 min-w-0">
              <IconUser className="w-5 h-5 text-white/70" />
              <h1 className="text-[14px] font-semibold text-white/90">{t("accounts.title")}</h1>
            </div>
            <div className="flex-1" />
            <button
              onClick={() => { setShowAddModal(true); setAuthError(""); setMicrosoftMethod("choose") }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#5a6ff2] hover:bg-[#6c7ff6] text-white font-medium transition-all duration-200"
            >
              <IconCirclePlus className="w-5 h-5" />
              {t("accounts.addAccount")}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">

          {accounts.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-2xl bg-white/[0.05] flex items-center justify-center mx-auto mb-4">
                <IconUser className="w-10 h-10 text-white/30" />
              </div>
              <p className="text-lg text-white/50">{t("accounts.noAccounts")}</p>
              <p className="text-sm text-white/35 mt-1">{t("accounts.noAccountsDesc")}</p>
            </div>
          ) : (
            <div className="space-y-3 pb-4">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl border transition-all duration-200",
                    account.isActive
                      ? "border-[#5a6ff2] bg-[#5a6ff2]/10"
                      : "border-white/[0.06] bg-white/[0.02] hover:border-[#5a6ff2]/40"
                  )}
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-[#2563EB]/20">
                    <CachedAvatar src={getAvatarUrl(account, account.username)} alt="" className="w-full h-full object-cover" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white truncate">{account.username}</span>
                      {account.isActive && (
                        <span className="px-2 py-0.5 rounded-full bg-[#5a6ff2]/20 text-[#8d9ff5] text-xs font-medium flex-shrink-0">
                          {t("accounts.active")}
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-white/40">{accountTypeInfo.microsoft.name}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveAccount(account.id, -1)}
                        disabled={accounts.findIndex(a => a.id === account.id) === 0}
                        title={t("accounts.moveUp")}
                        className="w-7 h-6 rounded-md bg-white/[0.05] hover:bg-white/[0.10] text-white/40 hover:text-white/70 transition-colors flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <IconChevronUp className="w-4 h-4" strokeWidth={1.75} />
                      </button>
                      <button
                        onClick={() => moveAccount(account.id, 1)}
                        disabled={accounts.findIndex(a => a.id === account.id) === accounts.length - 1}
                        title={t("accounts.moveDown")}
                        className="w-7 h-6 rounded-md bg-white/[0.05] hover:bg-white/[0.10] text-white/40 hover:text-white/70 transition-colors flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <IconChevronDown className="w-4 h-4" strokeWidth={1.75} />
                      </button>
                    </div>
                    {!account.isActive && (
                      <button
                        onClick={() => setActiveAccount(account.id)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.05] hover:bg-[#5a6ff2]/20 text-white/40 hover:text-[#8d9ff5] transition-colors text-sm"
                      >
                        <IconCheck className="w-4 h-4" strokeWidth={1.75} />
                        {t("accounts.select")}
                      </button>
                    )}
                    <button
                      onClick={() => removeAccount(account.id)}
                      className="w-9 h-9 rounded-lg bg-white/[0.05] hover:bg-destructive/20 text-white/40 hover:text-destructive transition-colors flex items-center justify-center"
                    >
                      <IconTrash className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>

      {showAddModal && microsoftMethod === "choose" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in-0">
          <div className="w-full max-w-md mx-4 p-6 rounded-2xl bg-card border border-border shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-foreground">{t("accounts.loginTitle.microsoft")}</h3>
              <button
                onClick={() => { setShowAddModal(false); setAuthError("") }}
                className="w-8 h-8 rounded-lg border border-border bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center py-4 mb-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-[#2563EB]/20">
                <svg className="w-8 h-8" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#0078d4" d="M67.328 67.331h60.669V128H67.328zm-67.325 0h60.669V128H.003zM67.328 0h60.669v60.669H67.328zM.003 0h60.669v60.669H.003z"/>
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">Войдите через Microsoft аккаунт</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => setMicrosoftMethod("oauth")}
                className="flex items-center gap-4 p-4 rounded-xl border border-border bg-muted/30 hover:border-[#8d9ff5]/60 hover:bg-muted/50 transition-all text-left"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#2563EB]/20 text-[#2563EB]">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="12" cy="15" r="1.4" fill="currentColor" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-foreground">{t("accounts.microsoftMethodOAuth")}</div>
                  <div className="text-sm text-muted-foreground mt-1">Откроется браузер для входа</div>
                </div>
              </button>
              <button
                onClick={() => void handleEnableDeviceCode()}
                disabled={microsoftAuthLoading}
                className="flex items-center gap-4 p-4 rounded-xl border border-border bg-muted/30 hover:border-[#8d9ff5]/60 hover:bg-muted/50 transition-all text-left disabled:opacity-60"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#2563EB]/20 text-[#2563EB]">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M14 14h4v4h-4z" fill="currentColor" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-foreground">{t("accounts.microsoftMethodDevice")}</div>
                  <div className="text-sm text-muted-foreground mt-1">Войти по коду на другом устройстве</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && microsoftMethod === "oauth" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in-0">
          <div className="w-full max-w-md mx-4 p-6 rounded-2xl bg-card border border-border shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-foreground">{t("accounts.loginTitle.microsoft")}</h3>
              <button
                onClick={() => { setMicrosoftAuthLoading(false); setMicrosoftMethod("choose"); setAuthError("") }}
                disabled={microsoftAuthLoading}
                className="w-8 h-8 rounded-lg border border-border bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center mb-4">
              {microsoftAuthLoading ? (
                <div>
                  <IconLoader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
                  <p className="text-sm text-muted-foreground">{t("accounts.connectMicrosoft")}</p>
                </div>
              ) : authError ? (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive-foreground">{authError}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-4">
                  Откроется браузер для входа в Microsoft аккаунт.
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setMicrosoftAuthLoading(false); setMicrosoftMethod("choose"); setAuthError("") }}
                className="flex items-center justify-center gap-2 flex-1 px-4 py-3 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 text-foreground transition-colors"
              >
                Назад
              </button>
              {!microsoftAuthLoading && (
                <button
                  onClick={handleMicrosoftLogin}
                  className="flex items-center justify-center gap-2 flex-1 px-4 py-3 rounded-xl bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-medium transition-colors"
                >
                  <IconLogin className="w-4 h-4" strokeWidth={1.75} />
                  {t("accounts.login")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showAddModal && microsoftMethod === "device" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in-0">
          <div className="w-full max-w-md mx-4 p-6 rounded-2xl bg-card border border-border shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-foreground">{t("accounts.loginTitle.microsoft")}</h3>
              <button
                onClick={() => {
                  setDevicePolling(false)
                  setDeviceStatus("waiting")
                  setDeviceCodeInfo(null)
                  setAuthError("")
                  setMicrosoftMethod("choose")
                }}
                disabled={microsoftAuthLoading || devicePolling}
                className="w-8 h-8 rounded-lg border border-border bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>

            {!deviceCodeInfo ? (
              <div>
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <IconLoader2 className="w-8 h-8 animate-spin mb-3 text-primary" />
                  <p className="text-sm text-muted-foreground">{t("accounts.generatingDeviceCode")}</p>
                </div>
                {authError && !devicePolling && (
                  <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 mb-4">
                    <p className="text-sm text-destructive-foreground">{authError}</p>
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => { setMicrosoftMethod("choose"); setMicrosoftAuthLoading(false) }}
                    className="flex items-center justify-center gap-2 flex-1 px-4 py-3 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 text-foreground transition-colors"
                  >
                    Назад
                  </button>
                  {!microsoftAuthLoading && !deviceCodeInfo && authError && (
                    <button
                      onClick={handleEnableDeviceCode}
                      className="flex items-center justify-center gap-2 flex-1 px-4 py-3 rounded-xl bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-medium transition-colors"
                    >
                      <IconRefresh className="w-4 h-4" strokeWidth={1.75} />
                      {t("accounts.restartDeviceCode")}
                    </button>
                  )}
                </div>
              </div>
            ) : deviceStatus === "expired" ? (
              <div>
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 mb-4">
                  <p className="text-sm text-destructive-foreground">{t("accounts.deviceExpired")}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setMicrosoftMethod("choose")}
                    className="flex items-center justify-center gap-2 flex-1 px-4 py-3 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 text-foreground transition-colors"
                  >
                    Назад
                  </button>
                  <button
                    onClick={handleEnableDeviceCode}
                    className="flex items-center justify-center gap-2 flex-1 px-4 py-3 rounded-xl bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-medium transition-colors"
                  >
                    <IconRefresh className="w-4 h-4" strokeWidth={1.75} />
                    {t("accounts.restartDeviceCode")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-muted/40 border border-border">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">{t("accounts.enterCodeAtLink")}</p>
                    <button
                      onClick={() => window.electronAPI?.openExternal(deviceCodeInfo.verificationUriComplete)}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-sm font-medium transition-colors"
                    >
                      <IconExternalLink className="w-4 h-4" strokeWidth={1.75} />
                      {t("accounts.openDeviceCodeLink")}
                    </button>
                    <div className="my-4 text-xs uppercase tracking-widest text-muted-foreground/70">{t("accounts.enterCodeLabel")}</div>
                    <div className="flex items-center gap-2">
                      <div className="text-3xl font-bold tracking-[0.35em] text-foreground select-all flex-1 px-3 py-2 rounded-xl border border-border bg-background text-[#8d9ff5]">
                        {deviceCodeInfo.userCode}
                      </div>
                      <button
                        onClick={() => handleCopyCode(deviceCodeInfo.userCode)}
                        className="flex items-center justify-center w-10 h-10 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                        title={t("accounts.clickToCopy")}
                      >
                        {copied
                          ? <IconCheck className="w-4 h-4 text-emerald-500" strokeWidth={2} />
                          : <IconCopy className="w-4 h-4" strokeWidth={1.75} />}
                      </button>
                    </div>
                    {devicePolling && (
                      <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
                        <IconLoader2 className="w-4 h-4 animate-spin text-primary" />
                        {authError || t("accounts.deviceWaiting")}
                      </div>
                    )}
                    {!devicePolling && authError && (
                      <div className="mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                        <p className="text-sm text-destructive-foreground">{authError}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setDevicePolling(false)
                      setDeviceStatus("waiting")
                      setDeviceCodeInfo(null)
                      setAuthError("")
                      setMicrosoftMethod("choose")
                    }}
                    className="flex items-center justify-center gap-2 flex-1 px-4 py-3 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 text-foreground transition-colors"
                  >
                    Назад
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
