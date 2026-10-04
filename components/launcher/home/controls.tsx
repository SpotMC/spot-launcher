import { memo, useCallback } from "react"
import type { Dispatch, SetStateAction } from "react"
import { useTranslation } from "react-i18next"
import type { Account } from "@/src/AccountsContext"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ACCOUNT_TYPE_LABELS, MOD_LOADERS, type LaunchUiState } from "@/lib/home-page-shared"
import { IconCheck, IconChevronDown, IconFolder, IconLoader2, IconPlayerPlay, IconPlayerStop } from "@tabler/icons-react"
import { CachedAvatar } from "@/components/ui/cached-avatar"
import type { LoaderVersionOption } from "@/src/hooks/use-loader-version-options"

type HomeControlsProps = {
  accounts: Account[]
  account?: Account
  accountComboOpen: boolean
  setAccountComboOpen: Dispatch<SetStateAction<boolean>>
  setActiveAccount: (id: string) => void
  versions: string[]
  versionsLoaded: boolean
  selectedVersion: string
  setSelectedVersion: (value: string) => void
  buildIcons: Record<string, string>
  selectedModLoader: string
  setSelectedModLoader: (value: string) => void
  loaderVersions: LoaderVersionOption[]
  loaderVersionsLoaded: boolean
  selectedLoaderVersion: string
  setSelectedLoaderVersion: (value: string) => void
  activeAvatarUrl: string
  accountAvatarUrls: Record<string, string>
  launchUi: LaunchUiState
  launchDetails: string
  isRunning: boolean
  onPlay: () => void
  onQuickPlayLaunch?: (type: "singleplayer" | "multiplayer", address: string) => void
}

export const HomeControls = memo(function HomeControls(props: HomeControlsProps) {
  const { t } = useTranslation()
  const handleOpenLauncherFolder = useCallback(() => { void window.electronAPI?.openLauncherFolder() }, [])
  const {
    accounts, account, accountComboOpen, setAccountComboOpen, setActiveAccount,
    activeAvatarUrl, accountAvatarUrls,
    launchUi, launchDetails, isRunning, onPlay,
    loaderVersionsLoaded, loaderVersions,
    versions, versionsLoaded, selectedVersion, setSelectedVersion,
    selectedModLoader, setSelectedModLoader,
    selectedLoaderVersion, setSelectedLoaderVersion,
  } = props

  const loaderVersionSelectionPending = !loaderVersionsLoaded || !selectedLoaderVersion
  const playDisabled = (launchUi.isLaunching && !isRunning) || loaderVersionSelectionPending

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.04] p-3">
        <button type="button" onClick={() => setAccountComboOpen(true)} className="flex items-center gap-2.5 text-left w-full">
          <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-xl bg-white/[0.06] border border-white/[0.08]">
            {account ? (
              <CachedAvatar src={activeAvatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-white/[0.06]">
                <span className="text-[11px] font-bold text-white/30">?</span>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-white">{account?.username ?? "Player"}</p>
            <p className="text-[10px] text-white/30">{ACCOUNT_TYPE_LABELS[account?.type ?? "microsoft"]}</p>
          </div>
          <IconChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-white/25" size={14} strokeWidth={2} />
        </button>
      </div>

      <Dialog open={accountComboOpen} onOpenChange={setAccountComboOpen}>
        <DialogContent className="max-w-sm p-0 gap-0 bg-[#1a1b20] border-white/[0.08]">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="text-[14px]">{t("home.account")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-0.5 px-2 pb-2 max-h-[320px] overflow-y-auto">
            {accounts.map(acc => {
              const isActive = acc.id === account?.id
              return (
                <button key={acc.id} type="button" onClick={() => { setActiveAccount(acc.id); setAccountComboOpen(false) }} className={cn("flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-colors duration-150 text-left", isActive ? "bg-[#8d9ff5]/10 border border-[#8d9ff5]/20" : "hover:bg-white/[0.05] border border-transparent")}>
                  <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0"><CachedAvatar src={accountAvatarUrls[acc.id]} alt="" className="w-full h-full object-cover" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[13px] text-white truncate">{acc.username}</p>
                    <p className="text-[10px] text-white/40">{ACCOUNT_TYPE_LABELS[acc.type] ?? acc.type}</p>
                  </div>
                  {isActive && <IconCheck className="w-4 h-4 text-[#8d9ff5] flex-shrink-0" strokeWidth={2} />}
                </button>
              )
            })}
            {accounts.length === 0 && (
              <p className="text-[12px] text-white/30 text-center py-4">Нет аккаунтов</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-2 rounded-xl bg-white/[0.03] border border-white/[0.04] p-3">
        <div>
          <label htmlFor="home-version-select" className="mb-1 block text-[11px] font-medium text-white/35">Версия</label>
          <select
            id="home-version-select"
            value={selectedVersion}
            onChange={(e) => setSelectedVersion(e.target.value)}
            disabled={versionsLoaded ? versions.length === 0 : true}
            className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#1d1e25] px-3 text-[12px] text-white outline-none transition-colors focus:border-white/20 disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-[#1d1e25]"
          >
            {versionsLoaded ? (
              versions.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))
            ) : (
              <option value={selectedVersion}>{selectedVersion || "—"}</option>
            )}
          </select>
        </div>

        <div>
          <label htmlFor="home-loader-select" className="mb-1 block text-[11px] font-medium text-white/35">Загрузчик</label>
          <select
            id="home-loader-select"
            value={selectedModLoader}
            onChange={(e) => setSelectedModLoader(e.target.value)}
            className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#1d1e25] px-3 text-[12px] text-white outline-none transition-colors focus:border-white/20 [&>option]:bg-[#1d1e25]"
          >
            {MOD_LOADERS.map((loader) => (
              <option key={loader.id} value={loader.id} className="capitalize">{loader.name}</option>
            ))}
          </select>
        </div>

        {selectedModLoader !== "vanilla" && (
          <div>
            <label htmlFor="home-loader-version-select" className="mb-1 block text-[11px] font-medium text-white/35">Версия загрузчика</label>
            <select
              id="home-loader-version-select"
              value={selectedLoaderVersion}
              onChange={(e) => setSelectedLoaderVersion(e.target.value)}
              disabled={loaderVersionsLoaded ? loaderVersions.length === 0 : true}
              className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#1d1e25] px-3 text-[12px] text-white outline-none transition-colors focus:border-white/20 disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-[#1d1e25]"
            >
              {loaderVersionsLoaded ? (
                loaderVersions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label ?? option.value}</option>
                ))
              ) : (
                <option value={selectedLoaderVersion}>{selectedLoaderVersion || "—"}</option>
              )}
            </select>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 px-1">
        <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-white/50">{selectedVersion || "—"}</span>
        <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium capitalize text-white/50">{selectedModLoader}</span>
        <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400/80">Online</span>
      </div>

      <div className="flex-1" />

      <button
        type="button"
        onClick={onPlay}
        disabled={playDisabled}
        className={cn(
          "relative h-12 w-full rounded-xl text-[14px] font-bold text-white overflow-hidden transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5",
          !launchUi.isLaunching && isRunning
            ? "bg-[#5a6ff2] hover:bg-[#6c7ff6] shadow-[0_0_24px_rgba(90,111,242,0.45)]"
            : "bg-[#5a6ff2] hover:bg-[#6c7ff6] shadow-[0_0_20px_rgba(90,111,242,0.3)] transition-colors",
        )}
      >
        <span className="relative z-10 flex items-center justify-center gap-2">
          {launchUi.isLaunching ? (
            <>
              <IconLoader2 className="w-5 h-5 animate-spin" />
              {launchUi.phase === "installing" && launchUi.progress !== null
                ? `Установка ${launchUi.progress}%`
                : "Запуск..."}
            </>
          ) : isRunning ? (
            <>
              <IconPlayerStop className="w-5 h-5" strokeWidth={1.75} />
              Остановить
            </>
          ) : (
            <>
              <IconPlayerPlay className="w-5 h-5" strokeWidth={1.75} fill="currentColor" />
              Играть на нашем сервере
            </>
          )}
        </span>
      </button>

      {(launchUi.status || launchUi.progress !== null || launchUi.isLaunching) && (
        <div className="flex flex-col gap-2 rounded-xl bg-white/[0.02] border border-white/[0.04] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-white/45">
              {launchUi.phase === "installing" ? "Установка" : "Запуск"}
            </span>
            {launchUi.progress !== null && (
              <span className="text-[11px] font-bold text-[#8d9ff5] tabular-nums">{launchUi.progress}%</span>
            )}
          </div>

          {launchUi.progress !== null && (
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-200",
                  isRunning ? "bg-emerald-500" : "bg-gradient-to-r from-[#7d9bfa] to-[#8d9ff5]",
                )}
                style={{ width: `${Math.max(0, Math.min(100, isRunning ? 100 : launchUi.progress))}%` }}
              />
            </div>
          )}

          {launchUi.phase === "installing" && launchUi.currentFile !== null && launchUi.totalFiles !== null && (
            <p className="text-[10px] text-white/35">
              Файл {launchUi.currentFile} / {launchUi.totalFiles}
              {launchUi.currentFileName ? (
                <>
                  {" · "}
                  <span className="text-white/50">{launchUi.currentFileName}</span>
                </>
              ) : null}
            </p>
          )}

          {launchUi.status && <p className="text-[11px] text-white/50 leading-snug">{launchUi.status}</p>}
          {launchDetails && <p className="text-[10px] text-white/25 line-clamp-2">{launchDetails}</p>}
        </div>
      )}

      <button
        type="button"
        onClick={handleOpenLauncherFolder}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] text-white/30 transition-all hover:border-white/[0.1] hover:bg-white/[0.04] hover:text-white/50"
      >
        <IconFolder className="h-3 h-3" />
        {t("home.openFolder")}
      </button>
    </div>
  )
})
