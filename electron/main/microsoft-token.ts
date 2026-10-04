import { fetchWithRetry } from "@spot/core/retry"
import { getMicrosoftDeviceClientId } from "./config"
import { dbHelpers } from "../db"
import { sendToRenderer } from "./runtime"

const XBOX_LIVE_AUTH_URL = "https://user.auth.xboxlive.com/user/authenticate"
const XSTS_AUTH_URL = "https://xsts.auth.xboxlive.com/xsts/authorize"
const MC_LAUNCHER_LOGIN_URL = "https://api.minecraftservices.com/launcher/login"
const MC_PROFILE_URL = "https://api.minecraftservices.com/minecraft/profile"

// Официальный Client ID и endpoint для личного использования
const MS_LIVE_TOKEN_URL = "https://login.live.com/oauth20_token.srf"
const MS_SCOPE = "service::user.auth.xboxlive.com::MBI_SSL"
const OFFICIAL_CLIENT_ID = "00000000402b5328"

const FORM_HEADERS = { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }

export type MicrosoftSessionTokens = { accessToken: string; refreshToken: string }
export type MicrosoftAccountPayloadLike = {
  id: string
  username: string
  uuid: string
  accessToken: string
  refreshToken: string
  clientId?: string
}
export type MicrosoftTokenState = "valid" | "invalid" | "unknown"

async function fetchMsaTokens(clientId: string, refreshToken: string): Promise<MicrosoftSessionTokens | null> {
  try {
    const res = await fetchWithRetry(MS_LIVE_TOKEN_URL, {
      method: "POST",
      headers: FORM_HEADERS,
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope: MS_SCOPE,
      }).toString(),
    }, { retries: 1 })

    const raw = await res.text()
    if (!res.ok) {
      console.error(`[Auth] MSA refresh failed via ${MS_LIVE_TOKEN_URL}: HTTP ${res.status}: ${raw}`)
      return null
    }

    let data: Record<string, unknown>
    try {
      data = JSON.parse(raw)
    } catch {
      console.error(`[Auth] MSA refresh: invalid JSON: ${raw}`)
      return null
    }

    const accessToken = data.access_token as string | undefined
    if (!accessToken) {
      console.error(`[Auth] MSA refresh: no access_token: ${raw}`)
      return null
    }
    return {
      accessToken,
      refreshToken: (data.refresh_token as string) || refreshToken,
    }
  } catch (error) {
    console.error(`[Auth] MSA refresh exception:`, error)
    return null
  }
}

export async function refreshMsaTokens(clientId: string, refreshToken: string): Promise<MicrosoftSessionTokens | null> {
  // Всегда используем официальный clientId для личного использования
  return fetchMsaTokens(OFFICIAL_CLIENT_ID, refreshToken)
}

export async function xboxUserStep(msaAccessToken: string): Promise<{ token: string; uhs: string }> {
  const response = await fetchWithRetry(XBOX_LIVE_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "x-xbl-contract-version": "1" },
    body: JSON.stringify({
      Properties: { AuthMethod: "RPS", SiteName: "user.auth.xboxlive.com", RpsTicket: `d=${msaAccessToken}` },
      RelyingParty: "http://auth.xboxlive.com",
      TokenType: "JWT",
    }),
  }, { retries: 2 })

  const raw = await response.text()
  if (!response.ok) throw new Error(`Xbox user authentication failed: HTTP ${response.status}: ${raw}`)

  const obj = JSON.parse(raw) as Record<string, unknown>
  const token = obj.Token as string | undefined
  const uhs = ((obj.DisplayClaims as { xui?: Array<{ uhs?: string }> } | undefined)?.xui?.[0]?.uhs) ?? ""
  if (!token || !uhs) throw new Error("Xbox user authentication: missing token or uhs")
  return { token, uhs }
}

export async function xstsStep(userToken: string): Promise<{ token: string; uhs: string }> {
  const response = await fetchWithRetry(XSTS_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "x-xbl-contract-version": "1" },
    body: JSON.stringify({
      Properties: { SandboxId: "RETAIL", UserTokens: [userToken] },
      RelyingParty: "rp://api.minecraftservices.com/",
      TokenType: "JWT",
    }),
  }, { retries: 2 })

  const raw = await response.text()
  if (!response.ok) {
    let xerr: number | undefined
    try {
      const obj = JSON.parse(raw) as Record<string, unknown>
      xerr = typeof obj.XErr === "number" ? obj.XErr : undefined
    } catch { /* ignore */ }
    throw new Error(`XSTS authorization failed: HTTP ${response.status}${xerr !== undefined ? ` (XErr ${xerr})` : ""}`)
  }

  const obj = JSON.parse(raw) as Record<string, unknown>
  const token = obj.Token as string | undefined
  if (!token) throw new Error("XSTS authorization: missing token")
  return { token, uhs: "" }
}

export async function minecraftLauncherLogin(uhs: string, xstsToken: string): Promise<{ accessToken: string; username: string }> {
  const response = await fetchWithRetry(MC_LAUNCHER_LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ xtoken: `XBL3.0 x=${uhs};${xstsToken}`, platform: "PC_LAUNCHER" }),
  }, { retries: 2 })

  const raw = await response.text()
  let obj: Record<string, unknown>
  try {
    obj = JSON.parse(raw) as Record<string, unknown>
  } catch {
    throw new Error(`Failed to get Minecraft access token: invalid JSON (HTTP ${response.status})`)
  }
  if (!response.ok) throw new Error(`Failed to get Minecraft access token: HTTP ${response.status}: ${raw}`)
  if (typeof obj.access_token !== "string" || typeof obj.username !== "string") {
    throw new Error("Failed to parse the Minecraft access token response.")
  }
  return { accessToken: obj.access_token, username: obj.username }
}

export async function refreshMicrosoftMcSession(clientId: string, refreshToken: string): Promise<MicrosoftSessionTokens> {
  const msa = await refreshMsaTokens(clientId, refreshToken)
  if (!msa) throw new Error("Failed to refresh Microsoft token")
  const userToken = await xboxUserStep(msa.accessToken)
  const xstsToken = await xstsStep(userToken.token)
  const mc = await minecraftLauncherLogin(userToken.uhs, xstsToken.token)
  return { accessToken: mc.accessToken, refreshToken: msa.refreshToken }
}

export async function checkMcAccessToken(accessToken: string): Promise<MicrosoftTokenState> {
  try {
    const res = await fetch(MC_PROFILE_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15000),
    })
    if (res.ok) return "valid"
    if (res.status === 401 || res.status === 403) return "invalid"
    return "unknown"
  } catch {
    return "unknown"
  }
}

type FreshAccountInput = {
  id: string
  type: string
  username: string
  isActive?: boolean
  uuid?: string
  accessToken?: string
  refreshToken?: string
  clientId?: string
  sortOrder?: number
  skinUrl?: string
}

function broadcastAccountsChanged(): void {
  try {
    sendToRenderer("accounts:updated", { type: "microsoft" })
  } catch { /* ignore */ }
}

export async function ensureFreshMicrosoftAccount<T extends FreshAccountInput>(account: T): Promise<T> {
  if (account.type !== "microsoft") return account

  // Всегда используем официальный clientId
  const clientId = OFFICIAL_CLIENT_ID

  if (!account.accessToken) {
    if (!account.refreshToken) return account
    try {
      const refreshed = await refreshMicrosoftMcSession(clientId, account.refreshToken)
      const updated = { ...account, accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken, clientId }
      await dbHelpers.saveAccount(updated as any)
      broadcastAccountsChanged()
      console.log(`[Auth] Refreshed Microsoft session (no access token): ${account.username}`)
      return updated
    } catch (error) {
      console.error(`[Auth] Failed to refresh Microsoft session for ${account.username}:`, error)
      return account
    }
  }

  const state = await checkMcAccessToken(account.accessToken)
  if (state !== "invalid") return account

  if (!account.refreshToken) {
    console.warn(`[Auth] Microsoft token invalid for ${account.username} and no refresh token — re-login required`)
    return account
  }

  try {
    const refreshed = await refreshMicrosoftMcSession(clientId, account.refreshToken)
    const updated = { ...account, accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken, clientId }
    await dbHelpers.saveAccount(updated as any)
    broadcastAccountsChanged()
    console.log(`[Auth] Refreshed expired Microsoft session: ${account.username}`)
    return updated
  } catch (error) {
    console.error(`[Auth] Failed to refresh expired Microsoft session for ${account.username}:`, error)
    return account
  }
}

export async function autoRefreshMicrosoftAccounts(): Promise<void> {
  try {
    const accounts = await dbHelpers.loadAccounts()
    for (const account of accounts) {
      if (account.type !== "microsoft" || !account.refreshToken) continue
      await ensureFreshMicrosoftAccount(account)
    }
  } catch (error) {
    console.error("[Auth] Error during auto-refresh of Microsoft accounts:", error)
  }
}