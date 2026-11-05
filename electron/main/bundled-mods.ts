import { app, ipcMain } from "electron"
import path from "path"
import fs from "fs/promises"
import { getGameDir } from "./minecraft-core"

// Mods bundled with the launcher and shipped alongside the renderer build.
// Vite copies `public/bundled-mods/*.jar` into `dist/bundled-mods`, and the
// electron code lives in `dist-electron/main`, so the shared path is
// `../../dist/bundled-mods` relative to __dirname (works in dev and packaged).
function getBundledModsDir(): string {
  return path.join(__dirname, "../../dist/bundled-mods")
}

function isRequired(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return lower.includes("voicechat") || lower.includes("emotecraft")
}

function toDisplayName(fileName: string): string {
  return fileName.replace(/\.jar$/i, "").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export type BundledModEntry = {
  fileName: string
  displayName: string
  required: boolean
}

export function registerBundledModsHandlers() {
  ipcMain.handle("bundled-mods:list", async (): Promise<BundledModEntry[]> => {
    let entries: string[]
    try {
      entries = await fs.readdir(getBundledModsDir())
    } catch {
      return []
    }
    return entries
      .filter((name) => name.toLowerCase().endsWith(".jar"))
      .sort((a, b) => a.localeCompare(b))
      .map((fileName) => ({
        fileName,
        displayName: toDisplayName(fileName),
        required: isRequired(fileName),
      }))
  })

  ipcMain.handle(
    "bundled-mods:install",
    async (_event, selected: string[]): Promise<{ success: boolean; installed: number; error?: string }> => {
      try {
        const bundledDir = getBundledModsDir()
        let files: string[]
        try {
          files = await fs.readdir(bundledDir)
        } catch {
          return { success: false, installed: 0, error: "Папка с модами не найдена" }
        }

        const available = new Set(files.filter((f) => f.toLowerCase().endsWith(".jar")))
        const need = new Set(selected ?? [])

        // Always ensure the required mods are installed.
        for (const f of available) {
          if (isRequired(f)) need.add(f)
        }

        const gameDir = await getGameDir()
        const modsDir = path.join(gameDir, "mods")
        await fs.mkdir(modsDir, { recursive: true })

        let installed = 0
        for (const fileName of need) {
          if (!available.has(fileName)) continue
          const src = path.join(bundledDir, fileName)
          const dest = path.join(modsDir, fileName)
          try {
            await fs.copyFile(src, dest)
            installed++
          } catch {
            // skip files that fail to copy (e.g. already locked)
          }
        }

        return { success: true, installed }
      } catch (e) {
        return { success: false, installed: 0, error: e instanceof Error ? e.message : String(e) }
      }
    },
  )
}
