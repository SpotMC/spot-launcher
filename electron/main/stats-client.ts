// ============================================================
// Spot Stats Client
// Отправляет данные игровой сессии на сайт (api/events.php).
// События подписываются HMAC-SHA256 (см. протокол в site/api/events.php).
// ============================================================

import crypto from "node:crypto"
import { dbHelpers } from "../db"
import type { DbAccount } from "../db"
import { logRuntime, logRuntimeDebug } from "./runtime"

// Значения по умолчанию (можно переопределить в настройках лаунчера).
const DEFAULT_API_URL = "https://admin.nexus-manage.ru/api/events.php"
const DEFAULT_SECRET = "7be4c4398bfb2973d4d93e73d18fbf2963cc9763a0c168947b60fb34d492ecb1"

const SPOT_IP = "185.9.145.192"

type StatsSession = {
  nick: string
  server: string // "ip:port"
  serverLabel: string
  isSpot: boolean
  startedAt: number
}

let current: StatsSession | null = null
let heartbeatTimer: NodeJS.Timeout | null = null

function isSpotAddr(host: string): boolean {
  return host.trim().split(":")[0].toLowerCase() === SPOT_IP
}

function makeServerLabel(host: string, quickPlay: string | undefined): string {
  const h = (host || "").trim().toLowerCase()
  if (isSpotAddr(h)) return "SpotMC"
  if (quickPlay && quickPlay.trim()) return quickPlay.trim()
  return h || ""
}

async function getConfig(): Promise<{ url: string; secret: string }> {
  let url = DEFAULT_API_URL
  let secret = DEFAULT_SECRET
  try {
    const u = await dbHelpers.getSetting("statsApiUrl")
    const s = await dbHelpers.getSetting("statsHmacSecret")
    if (u) url = u
    if (s) secret = s
  } catch {
    // fallback to defaults
  }
  return { url, secret }
}

async function postEvent(event: string, session: StatsSession): Promise<void> {
  const { url, secret } = await getConfig()
  if (!url || !secret) return
  const startedSec = Math.floor(session.startedAt / 1000)
  const nowSec = Math.floor(Date.now() / 1000)
  const playtime = Math.max(0, nowSec - startedSec)

  const body = JSON.stringify({
    event,
    nick: session.nick,
    server: session.server,
    server_label: session.serverLabel,
    is_spot: session.isSpot,
    started_at: startedSec,
    playtime,
  })

  const ts = String(Math.floor(Date.now() / 1000))
  const sig = crypto.createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex")

  try {
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 5000)
    const sep = url.includes("?") ? "&" : "?"
    const res = await fetch(`${url}${sep}ts=${ts}&sig=${sig}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
      signal: ctrl.signal,
    })
    clearTimeout(timeout)
    logRuntimeDebug(`[SpotStats] event=${event} status=${res.status}`)
  } catch (error) {
    logRuntimeDebug(`[SpotStats] event=${event} failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Начать игровую сессию: отправить 'join' и запустить heartbeat (раз в ~5 с).
 */
export async function startStatsSession(
  account: DbAccount,
  options: { quickPlayMultiplayer?: string; buildName?: string },
): Promise<void> {
  const nick = account?.username || "unknown"
  const quick = options?.quickPlayMultiplayer
  const server = (quick && quick.trim()) ? quick.trim() : options?.buildName || ""
  const host = server.split(":")[0]

  const session: StatsSession = {
    nick,
    server,
    serverLabel: makeServerLabel(host, server),
    isSpot: isSpotAddr(host),
    startedAt: Date.now(),
  }

  stopStatsSession(false) // сброс предыдущего, если был
  current = session
  logRuntime(`[SpotStats] session started nick=${nick} server=${server} is_spot=${String(session.isSpot)}`)

  // Первая отправка — сразу (игра запустилась).
  await postEvent("join", session)

  if (heartbeatTimer) clearInterval(heartbeatTimer)
  heartbeatTimer = setInterval(() => {
    if (current) postEvent("heartbeat", current)
  }, 1000)
}

/**
 * Остановить сессию: отправить 'leave' и остановить heartbeat.
 */
export async function stopStatsSession(sendLeave = true): Promise<void> {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
  const session = current
  current = null
  if (sendLeave && session) {
    logRuntime(`[SpotStats] session ended nick=${session.nick}`)
    await postEvent("leave", session)
  }
}

/**
 * Отправка события при старте самого лаунчера (приложение открылось).
 * Идёт сразу, ещё до запуска игры.
 */
export async function reportLauncherStarted(): Promise<void> {
  const { url, secret } = await getConfig()
  if (!url || !secret) return

  let nick = "unknown"
  try {
    const accounts = await dbHelpers.loadAccounts()
    const active = accounts.find(a => a.isActive) ?? accounts[0]
    if (active?.username) nick = active.username
  } catch {
    // ignore
  }

  const ts = String(Math.floor(Date.now() / 1000))
  const body = JSON.stringify({
    event: "launcher_start",
    nick,
    started_at: parseInt(ts, 10),
  })
  const sig = crypto.createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex")

  try {
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 5000)
    const sep = url.includes("?") ? "&" : "?"
    const res = await fetch(`${url}${sep}ts=${ts}&sig=${sig}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
      signal: ctrl.signal,
    })
    clearTimeout(timeout)
    logRuntimeDebug(`[SpotStats] launcher_start status=${res.status}`)
  } catch (error) {
    logRuntimeDebug(`[SpotStats] launcher_start failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}
