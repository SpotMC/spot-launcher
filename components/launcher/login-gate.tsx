import { useCallback, useEffect, useState } from "react"
import { useAccounts } from "@/src/AccountsContext"
import { IconLoader2, IconExternalLink, IconCopy, IconCheck } from "@tabler/icons-react"
import { MicrosoftIcon } from "./onboarding/icons"

type ProviderId = "microsoft"

const PROVIDERS: { id: ProviderId; title: string; desc: string; color: string; Icon: typeof MicrosoftIcon }[] = [
  { id: "microsoft", title: "Microsoft", desc: "Официальный вход (Mojang)", color: "#0078d4", Icon: MicrosoftIcon },
]

type DeviceInfo = { deviceCode: string; userCode: string; verificationUriComplete: string; interval: number }

export function LoginGate() {
  const { addAccount, accounts } = useAccounts()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null)
  const [devicePolling, setDevicePolling] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleLogin = useCallback(async (provider: ProviderId) => {
    setLoading(true)
    setError("")
    setDeviceInfo(null)
    try {
      const fn = "loginMicrosoft"
      const result = await (window.electronAPI as any)?.[fn]()
      if (result) {
        addAccount({ id: result.id, type: provider, username: result.username, uuid: result.uuid, accessToken: result.accessToken, refreshToken: result.refreshToken, isActive: accounts.length === 0 })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка входа")
    } finally {
      setLoading(false)
    }
  }, [addAccount, accounts.length])

  const startDevice = useCallback(async (provider: ProviderId) => {
    setLoading(true)
    setError("")
    setDeviceInfo(null)
    try {
      const startFn = "startMicrosoftDeviceCode"
      const pollFn = "pollMicrosoftDeviceCode"
      const info = await (window.electronAPI as any)?.[startFn]()
      if (!info) return
      setDeviceInfo({
        deviceCode: info.deviceCode,
        userCode: info.userCode,
        verificationUriComplete: info.verificationUriComplete,
        interval: info.interval,
      })
      setDevicePolling(true)

      const poll = async () => {
        const result = await (window.electronAPI as any)?.[pollFn](info.deviceCode)
        if (!result) return
        if (result.status === "complete" && result.account) {
          setDeviceInfo(null)
          setDevicePolling(false)
          addAccount({ id: result.account.id, type: provider, username: result.account.username, uuid: result.account.uuid, accessToken: result.account.accessToken, refreshToken: result.account.refreshToken, isActive: accounts.length === 0 })
          return
        }
        if (result.status === "expired" || (result.status === "error" && !result.retryable)) {
          setDevicePolling(false)
          setError(result.message || "Срок действия кода истёк")
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
      setError(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setLoading(false)
    }
  }, [addAccount, accounts.length])

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#0e0f12] p-6">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#8d9ff5]/10 blur-[100px] animate-aurora" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[360px] w-[360px] rounded-full bg-[#b9c4fa]/8 blur-[90px] animate-spot-glow" />

      <div className="w-full max-w-lg animate-spot-fade-scale">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-5">
            <img src="./spot-logo-mono-2.png" alt="Spot" className="h-20 w-auto object-contain drop-shadow-[0_0_26px_rgba(141,159,245,0.5)]" draggable={false} />
          </div>
          <h1 className="text-3xl font-bold text-white">
            <span className="animate-spot-shine bg-gradient-to-r from-white via-[#8d9ff5] to-white bg-clip-text text-transparent">Spot Launcher</span>
          </h1>
          <p className="mt-2 text-sm text-white/40">Войдите в аккаунт, чтобы играть на нашем сервере</p>
        </div>

        {!deviceInfo && (
          <div className="space-y-3">
            <p className="text-center text-xs uppercase tracking-widest text-white/30">Выберите способ входа</p>
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={loading}
                onClick={() => void handleLogin(p.id)}
                className="flex w-full items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-left transition-all hover:border-[#8d9ff5]/60 hover:bg-white/[0.06] disabled:opacity-60"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${p.color}20`, color: p.color }}>
                  <p.Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-white">{p.title}</div>
                  <div className="mt-0.5 text-sm text-white/35">{p.desc}</div>
                </div>
                {loading && <IconLoader2 className="h-5 w-5 animate-spin text-[#8d9ff5]" />}
              </button>
            ))}

            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => void startDevice("microsoft")}
                disabled={loading}
                className="text-xs text-[#8d9ff5] hover:underline disabled:opacity-50"
              >
                Не открывается браузер? Войти по коду на другом устройстве →
              </button>
            </div>
          </div>
        )}

        {deviceInfo && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 text-center">
            <p className="mb-4 text-sm text-white/50">Откройте страницу и введите код:</p>
            <button
              type="button"
              onClick={() => void window.electronAPI?.openExternal(deviceInfo.verificationUriComplete)}
              className="mx-auto mb-4 inline-flex items-center gap-2 rounded-xl bg-[#0078d4] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#026ec1]"
            >
              <IconExternalLink className="h-4 w-4" /> Открыть страницу входа
            </button>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(deviceInfo.userCode)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              className="mx-auto flex items-center gap-3 rounded-xl border-2 border-dashed border-[#8d9ff5]/50 bg-[#8d9ff5]/5 px-6 py-3 transition-all hover:border-[#8d9ff5]"
            >
              <span className="font-mono text-2xl font-bold tracking-[0.3em] text-[#8d9ff5]">{deviceInfo.userCode}</span>
              {copied ? <IconCheck className="h-4 w-4 text-emerald-400" /> : <IconCopy className="h-4 w-4 text-white/40" />}
            </button>
            {devicePolling && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-white/50">
                <IconLoader2 className="h-4 w-4 animate-spin text-[#8d9ff5]" /> Ожидание подтверждения...
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
        )}

        {accounts.length > 0 && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-300">
            Вход выполнен, открываем лаунчер...
          </div>
        )}
      </div>
    </div>
  )
}
