import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { IconSearch, IconRefresh, IconExternalLink, IconLoader2, IconChartBar } from "@tabler/icons-react"
import { useAccounts } from "@/src/AccountsContext"
import { PageHeader } from "./page-header"

const STATS_URL = "https://spotmc.ru/statistics"

interface StatsWebview extends HTMLElement {
  executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>
  reload(): void
  getURL(): string
  addEventListener(type: string, listener: (event: any) => void): void
  removeEventListener(type: string, listener: (event: any) => void): void
}

function buildSearchScript(nick: string): string {
  const safe = JSON.stringify(nick)
  const lower = JSON.stringify(nick.toLowerCase())
  return `
    (function () {
      var nick = ${safe};
      var input = null;
      var candidates = document.querySelectorAll('input');

      for (var i = 0; i < candidates.length && !input; i++) {
        var t = (candidates[i].type || '').toLowerCase();
        if (t === 'search' || t === 'text' || t === '') input = candidates[i];
      }

      if (!input) {
        var ce = document.querySelector('[contenteditable="true"]');
        input = ce;
      }

      if (input) {
        var proto = window.HTMLInputElement ? HTMLInputElement.prototype : null;
        var setter = (proto && Object.getOwnPropertyDescriptor(proto, 'value')) ? Object.getOwnPropertyDescriptor(proto, 'value').set : null;
        if (setter) { setter.call(input, nick); } else { input.value = nick; }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13 }));
        input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13 }));
      }

      return { foundInput: !!input };
    })();
  `
}

function buildHighlightScript(nick: string): string {
  const lower = JSON.stringify(nick.toLowerCase())
  return `
    (function () {
      var nick = ${lower};
      var matched = 0;
      var nodes = document.querySelectorAll('tr, [data-nick], [class*="player"], [class*="row"]');
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (el.querySelectorAll('tr').length > 0) continue;
        var txt = (el.textContent || '').toLowerCase();
        if (txt.indexOf(nick) !== -1) {
          el.style.outline = '2px solid #5a6ff2';
          el.style.backgroundColor = 'rgba(141,159,245,0.18)';
          if (matched === 0) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
          matched++;
        }
      }
      return matched;
    })();
  `
}

interface SearchState {
  status: "idle" | "searching" | "found" | "notfound"
  count: number
}

export function StatisticsPage() {
  const { t } = useTranslation()
  const { activeAccount } = useAccounts()
  const webviewRef = useRef<StatsWebview | null>(null)
  const [nick, setNick] = useState("")
  const [customNick, setCustomNick] = useState("")
  const [loadingTick, setLoadingTick] = useState(false)
  const [search, setSearch] = useState<SearchState>({ status: "idle", count: 0 })

  useEffect(() => {
    setNick(activeAccount?.username ?? "")
  }, [activeAccount])

  const runSearch = useCallback(async (value: string) => {
    const wv = webviewRef.current
    if (!wv || !value.trim()) return
    setSearch({ status: "searching", count: 0 })
    try {
      await wv.executeJavaScript(buildSearchScript(value.trim()), true)
      await new Promise((r) => setTimeout(r, 450))
      const count = (await wv.executeJavaScript(buildHighlightScript(value.trim()), true)) as number
      setSearch({ status: count > 0 ? "found" : "notfound", count })
    } catch {
      setSearch({ status: "notfound", count: 0 })
    }
  }, [])

  const handleDomReady = useCallback(() => {
    setNick(activeAccount?.username ?? "")
    const current = nick || activeAccount?.username || ""
    if (current) void runSearch(current)
  }, [activeAccount, nick, runSearch])

  useEffect(() => {
    const wv = webviewRef.current
    if (!wv) return
    const onReady = () => handleDomReady()
    wv.addEventListener("dom-ready", onReady)
    return () => wv.removeEventListener("dom-ready", onReady)
  }, [handleDomReady])

  const setWebviewRef = useCallback((el: StatsWebview | HTMLWebViewElement | null) => {
    webviewRef.current = el as StatsWebview | null
  }, [])

  const handleFindMe = useCallback(() => {
    setLoadingTick(true)
    void runSearch(nick).finally(() => setLoadingTick(false))
  }, [nick, runSearch])

  const handleCustomSearch = useCallback(() => {
    if (!customNick.trim()) return
    setLoadingTick(true)
    setNick(customNick)
    void runSearch(customNick.trim()).finally(() => setLoadingTick(false))
  }, [customNick, runSearch])

  const handleReload = useCallback(() => {
    setSearch({ status: "idle", count: 0 })
    webviewRef.current?.reload()
  }, [])

  return (
    <div className="relative flex h-full w-full flex-col bg-[#0c0d10]">
      <div className="flex h-[46px] shrink-0 items-center gap-3 border-b border-white/[0.04] bg-[#0c0d10] px-4">
        <div className="flex items-center gap-2 min-w-0">
          <IconChartBar className="w-5 h-5 text-white/70" />
          <h1 className="text-[14px] font-semibold text-white/90">Статистика сервера</h1>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <IconSearch className="w-4 h-4 text-white/40 flex-shrink-0" />
            <input
              value={customNick}
              onChange={(e) => setCustomNick(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCustomSearch()
              }}
              placeholder={nick || t("stats.searchPlaceholder")}
              className="w-56 bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-1.5 text-[13px] text-white placeholder:text-white/30 outline-none focus:border-[#5a6ff2]/60"
            />
            <button
              onClick={handleCustomSearch}
              disabled={loadingTick}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#5a6ff2] hover:bg-[#6c7ff6] px-3 py-1.5 text-[13px] font-medium text-white transition-colors disabled:opacity-60"
            >
              {loadingTick ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <IconSearch className="w-4 h-4" />}
              {t("stats.find")}
            </button>
          </div>

          <div className="flex items-center gap-2 text-[12px] text-white/50">
            {nick && (
              <button
                onClick={handleFindMe}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] px-3 py-1.5 text-white/80 transition-colors"
              >
                <IconSearch className="w-3.5 h-3.5" />
                {t("stats.findMe")} <span className="text-[#8d9ff5] font-medium">@{nick}</span>
              </button>
            )}
            <span
              className={
                search.status === "found"
                  ? "text-emerald-400"
                  : search.status === "notfound"
                    ? "text-amber-400"
                    : "text-white/40"
              }
            >
              {search.status === "searching"
                ? t("stats.searching")
                : search.status === "found"
                  ? t("stats.found", { count: search.count })
                  : search.status === "notfound"
                    ? t("stats.notFound")
                    : ""}
            </span>
            <button
              onClick={handleReload}
              className="inline-flex items-center gap-1 rounded-lg border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] px-2.5 py-1.5 text-white/70 transition-colors"
            >
              <IconRefresh className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => void window.electronAPI?.openExternal(STATS_URL)}
              className="inline-flex items-center gap-1 rounded-lg border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] px-2.5 py-1.5 text-white/70 transition-colors"
            >
              <IconExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
        <webview
          ref={setWebviewRef}
          src={STATS_URL}
          style={{ width: "100%", height: "100%" }}
          partition="persist:stats"
        />
      </div>
    </div>
  )
}
