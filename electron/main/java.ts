import { ipcMain } from "electron"
import path from "path"
import fs from "fs/promises"
import { dbHelpers } from "../db"
import { getMainWindow } from "./runtime"
import { scanForJavaInstallations } from "./system"

const JAVA_MAJOR = 21

export type JavaCheckResult = {
  installed: boolean
  path?: string
  version?: string
  label?: string
}

function sendInstallProgress(patch: { status: string; percent: number | null; message: string }) {
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send("java:install-progress", { ...patch })
  }
}

async function bundledJavaPath(): Promise<string | null> {
  const launcherDir = await dbHelpers.getLauncherDirectory()
  const base = path.join(launcherDir, "runtime", "java")
  return findJavaExecutable(base)
}

async function findJavaExecutable(root: string): Promise<string | null> {
  const exeName = process.platform === "win32" ? "java.exe" : "java"
  const jreBin = path.join(root, "bin", exeName)
  try {
    await fs.access(jreBin)
    return jreBin
  } catch {}
  try {
    const entries = await fs.readdir(root)
    for (const entry of entries) {
      const candidate = path.join(root, entry, "bin", exeName)
      try {
        await fs.access(candidate)
        return candidate
      } catch {}
    }
  } catch {}
  return null
}

export async function checkJava(): Promise<JavaCheckResult> {
  const bundled = await bundledJavaPath()
  if (bundled) {
    return { installed: true, path: bundled }
  }
  const list = await scanForJavaInstallations()
  if (list.length > 0) {
    const first = list[0]
    return { installed: true, path: first.path, version: first.version, label: first.label }
  }
  return { installed: false }
}

export async function installJava(): Promise<{ success: boolean; path?: string; error?: string }> {
  const launcherDir = await dbHelpers.getLauncherDirectory()
  const runtimeDir = path.join(launcherDir, "runtime", "java")
  const majorDir = path.join(runtimeDir, `jre-${JAVA_MAJOR}`)

  try {
    const existing = await findJavaExecutable(majorDir)
    if (existing) {
      await dbHelpers.setSetting("javaPath", existing)
      return { success: true, path: existing }
    }
  } catch {}

  const pl = process.platform as string
  const osName = pl === "win32" ? "windows" : pl === "darwin" ? "mac" : "linux"
  const arch = process.arch === "arm64" ? "aarch64" : process.arch === "ia32" ? "x86" : "x64"

  const downloadUrl = `https://api.adoptium.net/v3/binary/latest/${JAVA_MAJOR}/ga/${osName}/${arch}/jre/hotspot/normal/eclipse`
  const tempZip = path.join(runtimeDir, `jre-${JAVA_MAJOR}.zip`)

  await fs.mkdir(runtimeDir, { recursive: true })

  sendInstallProgress({ status: "prepare", percent: 0, message: "Подготовка к скачиванию..." })

  // Скачивание с таймаутом и одной повторной попыткой, чтобы не зависать навсегда.
  async function downloadWithRetry(url: string, target: string): Promise<void> {
    const attempts = [0, 1]
    for (const attempt of attempts) {
      sendInstallProgress({ status: "download", percent: attempt === 0 ? 2 : 1, message: attempt === 0 ? "Скачивание Java..." : "Повторная попытка скачивания..." })
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 150_000)
      try {
        const resp = await fetch(url, { redirect: "follow", signal: controller.signal })
        if (!resp.ok || !resp.body) {
          throw new Error(`HTTP ${resp.status}`)
        }
        const total = Number(resp.headers.get("content-length") || 0)
        const reader = resp.body.getReader()
        const file = await fs.open(target, "w")
        let received = 0
        try {
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            await file.write(value)
            received += value.length
            if (total > 0) {
              const percent = Math.min(99, Math.round(2 + (received / total) * 97))
              sendInstallProgress({ status: "download", percent, message: `Скачивание Java... ${percent}%` })
            }
          }
        } finally {
          await file.close()
        }
        return
      } catch (e) {
        await fs.unlink(target).catch(() => {})
        if (e instanceof Error && e.name === "AbortError") {
          throw new Error("Скачивание Java заняло слишком много времени. Проверьте интернет-соединение.")
        }
        if (attempt < attempts.length - 1) {
          continue
        }
        throw e
      } finally {
        clearTimeout(timer)
      }
    }
  }

  try {
    await downloadWithRetry(downloadUrl, tempZip)
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Не удалось скачать Java" }
  }

  sendInstallProgress({ status: "extract", percent: null, message: "Установка Java..." })

  try {
    await fs.mkdir(majorDir, { recursive: true })
    const AdmZip = (await import("adm-zip")).default
    const zip = new AdmZip(tempZip)
    zip.extractAllTo(majorDir, true)
  } catch (e) {
    await fs.unlink(tempZip).catch(() => {})
    return { success: false, error: e instanceof Error ? e.message : "Ошибка при распаковке Java" }
  } finally {
    await fs.unlink(tempZip).catch(() => {})
  }

  const javaPath = await findJavaExecutable(majorDir)
  if (!javaPath) {
    return { success: false, error: "Java установлена, но не найден исполняемый файл" }
  }

  await dbHelpers.setSetting("javaPath", javaPath)
  sendInstallProgress({ status: "done", percent: 100, message: "Java установлена" })
  return { success: true, path: javaPath }
}

export function registerJavaHandlers() {
  ipcMain.handle("java:check", async (): Promise<JavaCheckResult> => {
    return checkJava()
  })

  ipcMain.handle("java:install", async (): Promise<{ success: boolean; path?: string; error?: string }> => {
    try {
      return await installJava()
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Ошибка установки Java" }
    }
  })
}
