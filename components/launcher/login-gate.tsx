import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useAccounts } from "@/src/AccountsContext"
import {
  IconLoader2,
  IconExternalLink,
  IconCopy,
  IconCheck,
  IconLogin,
  IconChevronLeft,
  IconRefresh,
} from "@tabler/icons-react"
import { MicrosoftIcon } from "./onboarding/icons"

type Step = "choose" | "oauth" | "device"

type DeviceInfo = {
  deviceCode: string
  userCode: string
  verificationUriComplete: string
  interval: number
}

export function LoginGate() {
  const { t } = useTranslation()
  const { addAccount, accounts } = useAccounts()
  const [step, setStep] = useState<Step>("choose")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null)
  const [devicePolling, setDevicePolling] = useState(false)
  const [deviceExpired, setDeviceExpired] = useState(false)
  const [copied, setCopied] = useState(false)
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false
    return () => { cancelledRef.current = true }
  }, [])

  const resetToChoose = useCallback(() => {
    setStep("choose")
    setError("")
    setDeviceInfo(null)
    setDevicePolling(false)
    setDeviceExpired(false)
  }, [])

  const handleOAuthLogin = useCallback(async () => {
    setLoading(true)
    setError("")
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
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("accounts.unknownError"))
    } finally {
      setLoading(false)
    }
  }, [addAccount, accounts.length, t])

  const startDevice = useCallback(async () => {
    setLoading(true)
    setError("")
    setDeviceInfo(null)
    setDeviceExpired(false)
    try {
      const info = await window.electronAPI?.startMicrosoftDeviceCode()
      if (!info) return
      if (cancelledRef.current) return
      setDeviceInfo({
        deviceCode: info.deviceCode,
        userCode: info.userCode,
        verificationUriComplete: info.verificationUriComplete,
        interval: info.interval,
      })
      setDevicePolling(true)

      const poll = async () => {
        if (cancelledRef.current) return
        const result = await window.electronAPI?.pollMicrosoftDeviceCode(info.deviceCode)
        if (cancelledRef.current) return
        if (!result) return
        if (result.status === "complete" && result.account) {
          setDeviceInfo(null)
          setDevicePolling(false)
          addAccount({
            id: result.account.id,
            type: "microsoft",
            username: result.account.username,
            uuid: result.account.uuid,
            accessToken: result.account.accessToken,
            refreshToken: result.account.refreshToken,
            isActive: accounts.length === 0,
          })
          return
        }
        if (result.status === "expired" || (result.status === "error" && !result.retryable)) {
          setDevicePolling(false)
          setDeviceExpired(true)
          setError(result.status === "expired" ? t("accounts.deviceExpired") : result.message)
          return
        }
        if (result.status === "error" && result.retryable) {
          setError(result.message)
        }
        const delay = (result.status === "pending" && result.slowDown ? info.interval + 5 : info.interval) * 1000
        window.setTimeout(poll, Math.max(delay, 5000))
      }
      window.setTimeout(poll, info.interval * 1000)
    } catch (e) {
      setError(e instanceof Error ? e.message : t("accounts.unknownError"))
    } finally {
      setLoading(false)
    }
  }, [addAccount, accounts.length, t])

  const copyCode = useCallback((code: string) => {
    navigator.clipboard?.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }, [])

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#0e0f12] p-6">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#8d9ff5]/10 blur-[100px] animate-aurora" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[360px] w-[360px] rounded-full bg-[#b9c4fa]/8 blur-[90px] animate-spot-glow" />

      <div className="w-full max-w-md animate-spot-fade-scale">
        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src="./spot-logo-mono-2.png"
            alt="Spot"
            className="mb-5 h-20 w-auto object-contain drop-shadow-[0_0_26px_rgba(141,159,245,0.5)]"
            draggable={false}
          />
          <h1 className="text-3xl font-bold text-white">
            <span className="animate-spot-shine bg-gradient-to-r from-white via-[#8d9ff5] to-white bg-clip-text text-transparent">
              Spot Launcher
            </span>
          </h1>
          <p className="mt-2 text-sm text-white/40">{t("accounts.gateSubtitle")}</p>
        </div>

        <div className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
          {step === "choose" && (
            <div className="space-y-3">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0078d4]/15 text-[#3aa0e8]">
                  <MicrosoftIcon className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-semibold text-white">{t("accounts.loginTitle.microsoft")}</div>
                  <div className="text-xs text-white/40">{t("accounts.microsoftDesc")}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => { setStep("oauth"); setError("") }}
                className="group flex w-full items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-left transition-all hover:border-[#8d9ff5]/50 hover:bg-white/[0.05]"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#8d9ff5]/10 text-[#8d9ff5]">
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                    <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="12" cy="15" r="1.4" fill="currentColor" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-white">{t("accounts.microsoftMethodOAuth")}</div>
                  <div className="mt-0.5 text-sm text-white/40">{t("accounts.microsoftMethodOAuthDesc")}</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => { setStep("device"); void startDevice() }}
                className="group flex w-full items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-left transition-all hover:border-[#8d9ff5]/50 hover:bg-white/[0.05]"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#8d9ff5]/10 text-[#8d9ff5]">
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                    <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M14 14h4v4h-4z" fill="currentColor" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-white">{t("accounts.microsoftMethodDevice")}</div>
                  <div className="mt-0.5 text-sm text-white/40">{t("accounts.microsoftMethodDeviceDesc")}</div>
                </div>
              </button>
            </div>
          )}

          {step === "oauth" && (
            <div className="text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center mx-auto rounded-2xl bg-[#0078d4]/15 text-[#3aa0e8]">
                {loading ? <IconLoader2 className="h-8 w-8 animate-spin" /> : <MicrosoftIcon className="h-9 w-9" />}
              </div>
              {loading ? (
                <p className="text-sm text-white/50">{t("accounts.connectMicrosoft")}</p>
              ) : error ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
              ) : (
                <p className="text-sm text-white/50">{t("accounts.oauthHint")}</p>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={resetToChoose}
                  disabled={loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
                >
                  <IconChevronLeft className="h-4 w-4" />
                  {t("accounts.back")}
                </button>
                {!loading && (
                  <button
                    type="button"
                    onClick={() => void handleOAuthLogin()}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#0078d4] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#026ec1]"
                  >
                    <IconLogin className="h-4 w-4" />
                    {t("accounts.login")}
                  </button>
                )}
              </div>
            </div>
          )}

          {step === "device" && (
            <div className="text-center">
              {!deviceInfo && !deviceExpired ? (
                <div className="py-6">
                  <IconLoader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-[#8d9ff5]" />
                  <p className="text-sm text-white/50">{t("accounts.generatingDeviceCode")}</p>
                </div>
              ) : deviceExpired ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error || t("accounts.deviceExpired")}
                </div>
              ) : deviceInfo ? (
                <div className="space-y-4">
                  <p className="text-sm text-white/50">{t("accounts.enterCodeAtLink")}</p>
                  <button
                    type="button"
                    onClick={() => void window.electronAPI?.openExternal(deviceInfo.verificationUriComplete)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#0078d4] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#026ec1]"
                  >
                    <IconExternalLink className="h-4 w-4" />
                    {t("accounts.openDeviceCodeLink")}
                  </button>
                  <div className="my-3 text-xs uppercase tracking-widest text-white/35">{t("accounts.enterCodeLabel")}</div>
                  <button
                    type="button"
                    onClick={() => copyCode(deviceInfo.userCode)}
                    title={t("accounts.clickToCopy")}
                    className="mx-auto flex items-center gap-3 rounded-2xl border-2 border-dashed border-[#8d9ff5]/50 bg-[#8d9ff5]/5 px-6 py-3 transition-all hover:border-[#8d9ff5]"
                  >
                    <span className="font-mono text-2xl font-bold tracking-[0.3em] text-[#8d9ff5]">{deviceInfo.userCode}</span>
                    {copied ? <IconCheck className="h-4 w-4 text-emerald-400" /> : <IconCopy className="h-4 w-4 text-white/40" />}
                  </button>
                  {devicePolling && (
                    <div className="flex items-center justify-center gap-2 text-sm text-white/50">
                      <IconLoader2 className="h-4 w-4 animate-spin text-[#8d9ff5]" />
                      {error || t("accounts.deviceWaiting")}
                    </div>
                  )}
                </div>
              ) : null}

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={resetToChoose}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
                >
                  <IconChevronLeft className="h-4 w-4" />
                  {t("accounts.back")}
                </button>
                {deviceExpired && (
                  <button
                    type="button"
                    onClick={() => { setDeviceExpired(false); setError(""); void startDevice() }}
                    className="flex items-center justify-center gap-2 flex-1 rounded-xl bg-[#0078d4] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#026ec1]"
                  >
                    <IconRefresh className="h-4 w-4" />
                    {t("accounts.restartDeviceCode")}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
