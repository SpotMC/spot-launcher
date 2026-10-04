// ============================================================
// VPN Detection IPC
// - "vpn:detect": determine whether a VPN adapter is active
// ============================================================

import { ipcMain } from "electron"
import os from "os"

// Ключевые слова в имени сетевого адаптера, указывающие на VPN/TUN-соединение.
const VPN_INTERFACE_KEYWORDS = [
  "vpn",
  "tun",
  "tap-windows",
  "wireguard",
  "openvpn",
  "nordvpn",
  "protonvpn",
  "surfshark",
  "private internet access",
  "ipvanish",
  "expressvpn",
  "windscribe",
  "cyberghost",
  "hotspot shield",
  "ultrasurf",
  "psiphon",
  "amnezia",
  "hiddify",
  "neko",
  "tailscale",
  "zerotier",
  "hamachi",
  "anyconnect",
  "globalprotect",
  "forticlient",
  "softether",
  "uttun",
  "utun",
  "v2ray",
  "clash",
  "mihomo",
  "sing-box",
  "singbox",
  "xray",
  "openconnect",
  "browsec",
  "tunnelbear",
  "betternet",
  "touchvpn",
  "supervpn",
  "fastvpn",
  "vpnify",
  "mullvad",
  "ivacy",
  "tunnelblick",
  "tinc",
  "hysteria",
  "tuic",
]

export type VpnDetectResult = {
  vpnDetected: boolean
  matches: string[]
}

export function detectVpn(): VpnDetectResult {
  const matches: string[] = []

  try {
    const ifaces = os.networkInterfaces()
    for (const [name, addrs] of Object.entries(ifaces)) {
      if (!addrs || addrs.length === 0) continue
      const lower = name.toLowerCase()
      if (VPN_INTERFACE_KEYWORDS.some((keyword) => lower.includes(keyword))) {
        matches.push(name)
      }
    }
  } catch {
    // ignore detection errors
  }

  // Вторичный сигнал — прокси-переменные окружения (часто выставляются вместе с VPN).
  for (const key of ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"]) {
    const value = process.env[key]
    if (value) {
      matches.push(`${key}=${value}`)
    }
  }

  return { vpnDetected: matches.length > 0, matches }
}

export function registerVpnHandlers(): void {
  ipcMain.handle("vpn:detect", () => detectVpn())
}