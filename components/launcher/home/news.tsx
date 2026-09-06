import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties } from "react"
import { useTranslation } from "react-i18next"
import { IconArrowUpRight, IconCoffee, IconInfoCircle, IconLayoutGrid, IconPhoto, IconRefresh } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { formatDate, NEWS_CARD_STYLE, NEWS_CARD_TEXT_HEIGHT, NEWS_GRID_GAP, NEWS_GRID_OVERSCAN_ROWS, NEWS_SCROLL_STYLE, type NewsEntry } from "@/lib/home-page-shared"

const REFRESH_INTERVAL = 30 * 60 * 1000
const NEWS_STORAGE_KEY = "xnlc:news-cache:v1"
const NEWS_CACHE_MAX_AGE = 12 * 60 * 60 * 1000

type NewsCacheRecord = { ts: number; entries: NewsEntry[] }

let persistedNews: NewsCacheRecord | null = null

function readNewsCache(): NewsEntry[] | null {
  if (persistedNews) return persistedNews.entries
  try {
    const raw = localStorage.getItem(NEWS_STORAGE_KEY)
    if (raw) persistedNews = JSON.parse(raw) as NewsCacheRecord
  } catch {
    persistedNews = null
  }
  return persistedNews?.entries ?? null
}

function isNewsCacheFresh() {
  return persistedNews !== null && Date.now() - persistedNews.ts < NEWS_CACHE_MAX_AGE
}

function writeNewsCache(entries: NewsEntry[]) {
  persistedNews = { ts: Date.now(), entries }
  try {
    localStorage.setItem(NEWS_STORAGE_KEY, JSON.stringify(persistedNews))
  } catch {
    // storage full — keep memory copy
  }
}

const NewsCard = memo(function NewsCard({ entry, height }: { entry: NewsEntry; height?: number }) {
  const imgUrl = entry.playPageImage?.url ?? entry.newsPageImage?.url
  const tag = entry.tag ?? entry.category ?? entry.newsType?.[0]
  const style = useMemo<CSSProperties>(() => (height ? { ...NEWS_CARD_STYLE, height } : NEWS_CARD_STYLE), [height])
  return (
    <div className="group relative overflow-hidden rounded-xl bg-white/[0.03] border border-white/[0.04] hover:border-white/[0.1] hover:bg-white/[0.05] transition-all duration-200 flex flex-col p-2 gap-2 cursor-pointer" style={style}>
      <div className="h-28 w-full overflow-hidden rounded-lg bg-white/[0.04] flex-shrink-0">
        {imgUrl ? (
          <img src={imgUrl} alt={entry.title} loading="lazy" decoding="async" className="w-full h-full object-cover transform-gpu transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <IconPhoto className="w-8 h-8 text-white/10" strokeWidth={1.5} />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 flex-1 px-1 pb-0.5">
        {tag && (
          <span className="self-start px-1.5 py-0.5 rounded bg-[#8d9ff5]/10 text-[#8d9ff5]/70 text-[9px] font-semibold uppercase tracking-wider">
            {tag}
          </span>
        )}
        <p className="font-medium text-white/90 text-[12px] leading-snug line-clamp-2">{entry.title}</p>
        {entry.text && (
          <p className="text-[11px] text-white/35 line-clamp-2 leading-relaxed">{entry.text}</p>
        )}
        <div className="flex items-center justify-between mt-auto pt-1">
          <span className="text-[10px] text-white/20">{formatDate(entry.date)}</span>
          {entry.readMoreLink && (
            <button
              type="button"
              onClick={() => entry.readMoreLink && window.open(entry.readMoreLink)}
              className="flex h-5 w-5 items-center justify-center rounded bg-white/[0.06] text-white/40 transition-all opacity-0 group-hover:opacity-100 hover:bg-[#8d9ff5]/20 hover:text-[#8d9ff5]"
            >
              <IconArrowUpRight className="h-3 w-3" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
})

const VirtualNewsGrid = memo(function VirtualNewsGrid({ entries }: { entries: NewsEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<number | null>(null)
  const [viewport, setViewport] = useState({ scrollTop: 0, height: 0, width: 0 })
  const updateViewport = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setViewport(prev => {
      const next = { scrollTop: el.scrollTop, height: el.clientHeight, width: el.clientWidth }
      return prev.scrollTop === next.scrollTop && prev.height === next.height && prev.width === next.width ? prev : next
    })
  }, [])
  const scheduleViewportUpdate = useCallback(() => {
    if (frameRef.current !== null) return
    frameRef.current = requestAnimationFrame(() => { frameRef.current = null; updateViewport() })
  }, [updateViewport])

  useEffect(() => {
    updateViewport()
    const el = scrollRef.current
    if (!el) return
    const observer = new ResizeObserver(updateViewport)
    observer.observe(el)
    return () => {
      observer.disconnect()
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [updateViewport])

  const columns = 4
  const rowCount = Math.ceil(entries.length / columns)
  const columnWidth = viewport.width > 0 ? (viewport.width - NEWS_GRID_GAP * (columns - 1)) / columns : 220
  const cardHeight = Math.ceil(columnWidth * 0.62 + NEWS_CARD_TEXT_HEIGHT)
  const rowHeight = cardHeight + NEWS_GRID_GAP
  const startRow = Math.max(0, Math.floor(viewport.scrollTop / rowHeight) - NEWS_GRID_OVERSCAN_ROWS)
  const endRow = Math.min(rowCount, Math.ceil((viewport.scrollTop + viewport.height) / rowHeight) + NEWS_GRID_OVERSCAN_ROWS)
  const visibleEntries = entries.slice(startRow * columns, endRow * columns)

  return (
    <div ref={scrollRef} onScroll={scheduleViewportUpdate} className="overflow-y-auto flex-1 px-1 pb-1" style={NEWS_SCROLL_STYLE}>
      <div style={{ height: startRow * rowHeight }} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">{visibleEntries.map(entry => <NewsCard key={entry.id} entry={entry} height={cardHeight} />)}</div>
      <div style={{ height: Math.max(0, (rowCount - endRow) * rowHeight) }} />
    </div>
  )
})

let cachedNews: NewsEntry[] | null = readNewsCache()
let cachedNewsPromise: Promise<NewsEntry[]> | null = null

function fetchNewsDirect(): Promise<NewsEntry[]> {
  cachedNewsPromise = window.electronAPI?.fetchMinecraftNews().then((entries) => { cachedNews = entries; writeNewsCache(entries); return entries }) ?? Promise.resolve([])
  return cachedNewsPromise
}

function fetchNewsCached(): Promise<NewsEntry[]> {
  if (cachedNews) return Promise.resolve(cachedNews)
  if (cachedNewsPromise) return cachedNewsPromise
  return fetchNewsDirect()
}

export const NewsSection = memo(function NewsSection() {
  const { t } = useTranslation()
  const [news, setNews] = useState<NewsEntry[]>(() => cachedNews ?? [])
  const [loading, setLoading] = useState(!cachedNews)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<"all" | "java">("java")
  const [search, setSearch] = useState("")

  useEffect(() => {
    const onSearch = (e: Event) => setSearch((e as CustomEvent<string>).detail ?? "")
    window.addEventListener("spot:search", onSearch)
    return () => window.removeEventListener("spot:search", onSearch)
  }, [])

  useEffect(() => {
    if (cachedNews) { setNews(cachedNews); setLoading(false); if (!isNewsCacheFresh()) { fetchNewsDirect().then(setNews).catch(() => {}) }; return }
    setLoading(true)
    fetchNewsCached().then((entries) => { setNews(entries); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      fetchNewsDirect().then(setNews).catch(() => {})
    }, REFRESH_INTERVAL)
    return () => clearInterval(timer)
  }, [])

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    fetchNewsDirect()
      .then((entries) => { setNews(entries) })
      .catch(() => {})
      .finally(() => { setRefreshing(false) })
  }, [])

  const filtered = useMemo(() => {
    const byType = filter === "java" ? news.filter(e => !e.newsType || e.newsType.includes("Java") || e.newsType.includes("java_edition")) : news
    const q = search.trim().toLowerCase()
    if (!q) return byType
    return byType.filter(e => e.title?.toLowerCase().includes(q) || e.text?.toLowerCase().includes(q))
  }, [news, filter, search])

  const filters = useMemo(() => [
    { id: "all" as const, label: t("home.news.all"), icon: IconLayoutGrid },
    { id: "java" as const, label: t("home.news.java"), icon: IconCoffee },
  ], [t])

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Section header */}
      <div className="flex flex-shrink-0 items-center gap-2 px-3 py-2.5">
        <span className="text-[12px] font-semibold text-white/70">Новости</span>
        <span className="text-[11px] text-white/20">·</span>
        <span className="text-[11px] text-white/30">{filtered.length}</span>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          {/* Filter pills */}
          <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-lg p-0.5 border border-white/[0.04]">
            {filters.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(prev => prev === id ? prev : id)}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all duration-150",
                  filter === id
                    ? "bg-white/[0.08] text-white/80"
                    : "text-white/30 hover:text-white/50"
                )}
              >
                <Icon className="h-3 w-3" strokeWidth={1.75} />
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex h-6 w-6 items-center justify-center rounded-md text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/60 disabled:opacity-50"
          >
            <IconRefresh className={cn("h-3 w-3", refreshing && "animate-spin")} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="overflow-y-auto flex-1 px-3 pb-2" style={NEWS_SCROLL_STYLE}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-white/[0.03] border border-white/[0.04] overflow-hidden animate-pulse">
                <div className="h-28 bg-white/[0.03]" />
                <div className="space-y-2 p-2">
                  <div className="h-1.5 bg-white/[0.06] rounded w-1/3" />
                  <div className="h-2 bg-white/[0.06] rounded w-full" />
                  <div className="h-2 bg-white/[0.06] rounded w-4/5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="overflow-y-auto flex-1 px-3 pb-2" style={NEWS_SCROLL_STYLE}>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mb-3">
              <IconInfoCircle className="w-6 h-6 text-white/20" strokeWidth={1.5} />
            </div>
            <p className="text-[12px] text-white/30">{t("home.newsError")}</p>
          </div>
        </div>
      ) : (
        <VirtualNewsGrid entries={filtered} />
      )}
    </div>
  )
})
