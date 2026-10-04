try { require("dotenv/config") } catch {}
import "./auth"
import { autoRefreshMicrosoftAccounts } from "./microsoft-token"
import "./discord-rpc"

import { registerModsHandlers } from "./mods"
import { registerBuildHandlers } from "./builds"
import { registerCloudHandlers } from "./cloud/handlers"
import { registerP2PHandlers } from "./p2p"
import { registerSystemHandlers } from "./system"
import { registerWindowLifecycle } from "./window"
import { registerMinecraftHandlers } from "./minecraft"
import { registerWorldsHandlers } from "./worlds"
import { registerServerHandlers } from "./servers"
import { registerVpnHandlers } from "./vpn"
import { registerQuickPlayHandlers } from "./quick-play"
import { registerUpdater } from "./updater"
import { registerSkinsHandlers } from "./skins"
import { registerBundledModsHandlers } from "./bundled-mods"
import { registerJavaHandlers } from "./java"
import { app } from "electron"

registerWindowLifecycle()
registerSystemHandlers()
registerJavaHandlers()
registerModsHandlers()
registerBuildHandlers()
registerCloudHandlers()
registerMinecraftHandlers()
registerWorldsHandlers()
registerServerHandlers()
registerVpnHandlers()

registerP2PHandlers()
registerQuickPlayHandlers()
registerUpdater()
registerSkinsHandlers()
registerBundledModsHandlers()

// Автообновление Microsoft-сессий: на старте и далее раз в 4 часа,
// чтобы перед запуском игры токен всегда был действителен.
const MICROSOFT_REFRESH_INTERVAL_MS = 4 * 60 * 60 * 1000

app.whenReady().then(async () => {
  await autoRefreshMicrosoftAccounts()
  setInterval(() => {
    void autoRefreshMicrosoftAccounts()
  }, MICROSOFT_REFRESH_INTERVAL_MS)
})

import("@spot/mods").catch(() => {})

