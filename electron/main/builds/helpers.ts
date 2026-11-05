import { app } from "electron"
import path from "path"
import fs from "fs/promises"
import { sendToRenderer } from "../runtime"
import { dbHelpers } from "../../db"
import { ensureSharedGameLinksSync } from "../shared-game-cache"

export function getBaseDataRoot(): string {
  if (process.platform === "win32") return path.join(app.getPath("appData"), "spotlauncher")
  if (process.platform === "darwin") return path.join(app.getPath("home"), "Library", "Application Support", "spotlauncher")
  return path.join(app.getPath("home"), ".spotlauncher")
}

let cachedInstancesRoot: string | null = null

/** Loads the configured instances directory (setting `instancesPath`) into the cache. */
export async function loadInstancesRoot(): Promise<string> {
  try {
    const stored = await dbHelpers.getSetting("instancesPath")
    if (stored && stored.trim()) {
      cachedInstancesRoot = stored.trim()
      return cachedInstancesRoot
    }
  } catch {}
  cachedInstancesRoot = getBaseDataRoot()
  return cachedInstancesRoot
}

/** Returns the current instances root (the parent directory that contains `intents/`). */
export function getInstancesRoot(): string {
  return cachedInstancesRoot ?? getBaseDataRoot()
}

export function getBuildIntentDirName(rawName: string): string {
  return rawName.replace(/[^a-zA-Z0-9а-яА-ЯёЁ _-]/g, "_") || "unnamed-build"
}

export function getBuildIntentPath(dirName: string): string {
  const baseDataRoot = getInstancesRoot()
  const safeName = getBuildIntentDirName(dirName)
  return path.join(baseDataRoot, "intents", safeName)
}

export async function ensureBuildIntentDir(dirName: string): Promise<string> {
  const baseDataRoot = getInstancesRoot()
  const safeName = getBuildIntentDirName(dirName)
  const intentPath = path.join(baseDataRoot, "intents", safeName)
  await fs.mkdir(intentPath, { recursive: true }).catch(() => {})
  const modsPath = path.join(intentPath, "mods")
  await fs.mkdir(modsPath, { recursive: true }).catch(() => {})
  const resourcepacksPath = path.join(intentPath, "resourcepacks")
  await fs.mkdir(resourcepacksPath, { recursive: true }).catch(() => {})
  const shaderpacksPath = path.join(intentPath, "shaderpacks")
  await fs.mkdir(shaderpacksPath, { recursive: true }).catch(() => {})
  ensureSharedGameLinksSync(intentPath)
  return intentPath
}

// ── Загрузка файлов ─────────────────────────────────────────
// Серверы модпаков регулярно отвечают 429/5xx при массовой загрузке и рвут
// соединение на середине файла. Поэтому: повторяем запрос с бэкоффом (учитывая
// Retry-After), пишем потоком во временный файл и только по завершении
// переименовываем его в целевой путь.

const RETRYABLE_HTTP_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])
const DOWNLOAD_MAX_RETRIES = 3
const PROGRESS_THROTTLE_MS = 100
const IDLE_TIMEOUT_MS = 60_000
const RETRYABLE_NETWORK_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "ENOTFOUND",
  "EAI_AGAIN",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
])

type HttpDownloadError = Error & { status: number; retryable: boolean; waitMs?: number }

function isAbortError(error: unknown): boolean {
  return (error instanceof DOMException && error.name === "AbortError")
    || (error instanceof Error && error.name === "AbortError")
}

function createAbortError(): Error {
  const error = new Error("Загрузка отменена")
  error.name = "AbortError"
  return error
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError())
      return
    }
    const cleanup = () => {
      clearTimeout(timer)
      signal?.removeEventListener("abort", onAbort)
    }
    const onAbort = () => {
      cleanup()
      reject(createAbortError())
    }
    const timer = setTimeout(() => {
      cleanup()
      resolve()
    }, ms)
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

function downloadBackoffMs(attempt: number): number {
  return Math.min(30_000, 750 * 2 ** attempt) + Math.round(Math.random() * 250)
}

function parseRetryAfter(value: string | null): number | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  const seconds = Number(trimmed)
  if (Number.isFinite(seconds)) return Math.max(0, Math.min(60_000, seconds * 1000))
  const date = Date.parse(trimmed)
  if (!Number.isNaN(date)) return Math.max(0, Math.min(60_000, date - Date.now()))
  return undefined
}

function isRetryableNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "NetworkError") return true
    const code = (error as { code?: unknown }).code
    if (typeof code === "string" && RETRYABLE_NETWORK_CODES.has(code)) return true
  }
  return false
}

function createTimeoutError(): Error {
  const error = new Error("Превышено время ожидания данных от сервера")
  ;(error as { code?: string }).code = "ETIMEDOUT"
  return error
}

/**
 * Прерывает ожидание, если сервер не присылает данных дольше IDLE_TIMEOUT_MS.
 * onTimeout должен закрыть соединение (abort/reader.cancel), чтобы запрос не остался висеть.
 */
function withIdleTimeout<T>(promise: Promise<T>, onTimeout: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      onTimeout()
      reject(createTimeoutError())
    }, IDLE_TIMEOUT_MS)

    promise.then(
      (value) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function createProgressReporter(fileName: string | undefined, total: number) {
  let lastSentAt = 0
  return (received: number, force = false) => {
    if (!fileName || total <= 0) return
    const now = Date.now()
    if (!force && now - lastSentAt < PROGRESS_THROTTLE_MS) return
    lastSentAt = now
    sendToRenderer("content:download-progress", { fileName, current: received, total })
  }
}

/**
 * Выполняет загрузку с повторами. Повторяется как сам запрос (сеть, 408/425/429/5xx),
 * так и чтение тела ответа — соединение может оборваться уже после заголовков.
 */
async function withDownloadRetry<T>(
  url: string,
  signal: AbortSignal | undefined,
  attemptFn: (res: Response, abort: () => void) => Promise<T>,
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= DOWNLOAD_MAX_RETRIES; attempt++) {
    throwIfImportCancelled(signal)
    const controller = new AbortController()
    const attemptSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
    try {
      const res = await withIdleTimeout(fetch(url, { signal: attemptSignal }), () => controller.abort())
      if (!res.ok) {
        const waitMs = parseRetryAfter(res.headers.get("retry-after"))
        await res.body?.cancel().catch(() => {})
        const error = new Error(`HTTP ${res.status}: ${url}`) as HttpDownloadError
        error.status = res.status
        error.retryable = RETRYABLE_HTTP_STATUS.has(res.status)
        error.waitMs = waitMs
        throw error
      }
      return await attemptFn(res, () => controller.abort())
    } catch (error) {
      lastError = error
      if (isAbortError(error) || signal?.aborted) {
        throwIfImportCancelled(signal)
        throw error
      }
      const httpError = error as Partial<HttpDownloadError>
      const retryable = httpError.retryable ?? isRetryableNetworkError(error)
      if (!retryable || attempt >= DOWNLOAD_MAX_RETRIES) throw error
      const waitMs = httpError.waitMs ?? downloadBackoffMs(attempt)
      console.warn(`[builds] Загрузка не удалась (попытка ${attempt + 1}/${DOWNLOAD_MAX_RETRIES + 1}), повтор через ${waitMs} мс: ${url}`)
      await delay(waitMs, signal)
    }
  }
  throw lastError
}

export async function downloadBuffer(url: string, signal?: AbortSignal, progressFileName?: string): Promise<Buffer> {
  return withDownloadRetry(url, signal, async (res, abort) => {
    const total = Number(res.headers.get("content-length") || 0)
    const report = createProgressReporter(progressFileName, total)

    if (!res.body) {
      const data = Buffer.from(await withIdleTimeout(res.arrayBuffer(), abort))
      report(data.length, true)
      return data
    }

    const reader = res.body.getReader()
    const chunks: Buffer[] = []
    let received = 0
    for (;;) {
      const { done, value } = await withIdleTimeout(reader.read(), () => { void reader.cancel().catch(() => {}); abort() })
      if (done) break
      if (!value || value.length === 0) continue
      received += value.length
      chunks.push(Buffer.from(value))
      report(received)
    }
    report(received, true)
    return Buffer.concat(chunks)
  })
}

async function writeResponseToFile(
  res: Response,
  filePath: string,
  signal: AbortSignal | undefined,
  abort: () => void,
  progressFileName?: string,
): Promise<void> {
  const total = Number(res.headers.get("content-length") || 0)
  const report = createProgressReporter(progressFileName, total)
  const handle = await fs.open(filePath, "w")
  try {
    if (!res.body) {
      const data = Buffer.from(await withIdleTimeout(res.arrayBuffer(), abort))
      await handle.write(data)
      report(data.length, true)
      return
    }

    const reader = res.body.getReader()
    let received = 0
    for (;;) {
      throwIfImportCancelled(signal)
      const { done, value } = await withIdleTimeout(reader.read(), () => { void reader.cancel().catch(() => {}); abort() })
      if (done) break
      if (!value || value.length === 0) continue
      received += value.length
      await handle.write(value)
      report(received)
    }
    report(received, true)
  } finally {
    await handle.close().catch(() => {})
  }
}

async function replaceFile(tempPath: string, targetPath: string): Promise<void> {
  try {
    await fs.rename(tempPath, targetPath)
  } catch {
    // Windows: rename поверх существующего файла может выдать EPERM — пробуем замену.
    await fs.rm(targetPath, { force: true })
    await fs.rename(tempPath, targetPath)
  }
}

/**
 * Скачивает файл по URL во временный файл рядом с целевым и только после
 * успешного получения переименовывает его в конечный путь. При ошибке временный
 * файл удаляется, поэтому битая/неполная копия модификации не остаётся на диске
 * и не попадает в игру (а из-за этого игра и падала при загрузке).
 */
export async function downloadBufferToFile(
  url: string,
  filePath: string,
  signal?: AbortSignal,
  progressFileName?: string,
): Promise<void> {
  await withDownloadRetry(url, signal, async (res, abort) => {
    const tempPath = `${filePath}.spot-tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    try {
      await writeResponseToFile(res, tempPath, signal, abort, progressFileName)
      await replaceFile(tempPath, filePath)
    } catch (error) {
      await fs.rm(tempPath, { force: true }).catch(() => {})
      throw error
    }
  })
}

export function sanitizeFileName(fileName: string): string {
  const normalized = path.basename(fileName).trim()
  return normalized.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_") || "download.bin"
}

export function sanitizeRelativeContentPath(fileName: string): string {
  const segments = fileName
    .replace(/\\/g, "/")
    .split("/")
    .map(segment => segment.trim())
    .filter(Boolean)
    .map(segment => segment.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_"))
    // Защита от выхода за пределы папки сборки через «..» в путях манифеста.
    .filter(segment => segment !== "." && segment !== "..")

  if (segments.length === 0) return "download.bin"

  return path.join(...segments)
}

export function getContentDirectoryName(contentType: "mod" | "resourcepack" | "shader"): "mods" | "resourcepacks" | "shaderpacks" {
  if (contentType === "resourcepack") return "resourcepacks"
  if (contentType === "shader") return "shaderpacks"
  return "mods"
}

export async function saveRemoteContentToIntent(dirName: string, contentType: "mod" | "resourcepack" | "shader", url: string, fileName: string): Promise<string | null> {
  try {
    const intentPath = await ensureBuildIntentDir(dirName)
    const targetDir = path.join(intentPath, getContentDirectoryName(contentType))
    await fs.mkdir(targetDir, { recursive: true }).catch(() => {})
    const safeFileName = sanitizeFileName(fileName)
    const filePath = path.join(targetDir, safeFileName)
    await downloadBufferToFile(url, filePath, undefined, safeFileName)
    return filePath
  } catch (error) {
    console.error(`[builds] Failed to save remote content "${fileName}" to "${dirName}":`, error)
    return null
  }
}

export async function saveLocalContentToIntent(dirName: string, contentType: "mod" | "resourcepack" | "shader", localFilePath: string): Promise<string | null> {
  try {
    const intentPath = await ensureBuildIntentDir(dirName)
    const targetDir = path.join(intentPath, getContentDirectoryName(contentType))
    await fs.mkdir(targetDir, { recursive: true }).catch(() => {})
    const destPath = path.join(targetDir, sanitizeFileName(path.basename(localFilePath)))
    try { await fs.access(destPath) } catch {
      await fs.copyFile(localFilePath, destPath)
    }
    return destPath
  } catch (error) {
    console.error(`[builds] Failed to save local content "${localFilePath}" to "${dirName}":`, error)
    return null
  }
}

export async function deleteContentFromIntent(dirName: string, contentType: "mod" | "resourcepack" | "shader", fileName: string): Promise<{ success: boolean; error?: string }> {
  const normalizePath = (p: string) => path.resolve(p).toLowerCase()

  try {
    const intentPath = await ensureBuildIntentDir(dirName)
    const targetDir = path.join(intentPath, getContentDirectoryName(contentType))
    const relPath = sanitizeRelativeContentPath(fileName)
    const relBase = path.basename(relPath)
    const normalizedTargetDir = normalizePath(targetDir)

    const isInside = (p: string) => {
      const n = normalizePath(p)
      return n === normalizedTargetDir || n.startsWith(`${normalizedTargetDir}${path.sep}`)
    }

    const candidates = new Set<string>()

    const addTarget = (p: string) => {
      if (isInside(p)) candidates.add(path.resolve(p))
    }
    addTarget(path.join(targetDir, relPath))
    addTarget(path.join(targetDir, relBase))

    // Иногда slug в БД не совпадает с реальным путём файла (например, мод лежит
    // в подпапке или имя файла отличается). Поэтому дополнительно ищем файл по
    // относительному пути и по имени в поддереве папки контента.
    const wantedRel = relPath.toLowerCase().replace(/\\/g, "/")
    const wantedBase = relBase.toLowerCase()
    const walk = async (dir: string): Promise<void> => {
      if (!isInside(dir)) return
      let entries
      try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return }
      for (const entry of entries) {
        const full = path.join(dir, entry.name)
        if (!isInside(full)) continue
        if (entry.isDirectory()) {
          await walk(full)
          continue
        }
        if (!entry.isFile()) continue
        if (!entry.name.endsWith(".jar") && !entry.name.endsWith(".zip") && !entry.name.endsWith(".disabled")) continue
        const entryRel = path.relative(targetDir, full).toLowerCase().replace(/\\/g, "/")
        if (entryRel === wantedRel || path.basename(entryRel).toLowerCase() === wantedBase) {
          candidates.add(full)
          return
        }
      }
    }
    await walk(targetDir)

    let removed = 0
    for (const candidate of candidates) {
      let existsHere = false
      try { await fs.access(candidate); existsHere = true } catch {}
      if (!existsHere) continue

      let attempts = 0
      for (;;) {
        attempts++
        try {
          await fs.rm(candidate, { force: true, recursive: true })
        } catch {}
        let stillExists = false
        try { await fs.access(candidate); stillExists = true } catch {}
        if (!stillExists) {
          removed++
          break
        }
        if (attempts >= 3) {
          return { success: false, error: `Не удалось удалить файл (возможно, он заблокирован): ${candidate}` }
        }
        await new Promise(r => setTimeout(r, 150 * attempts))
      }
    }

    // Файла на диске уже нет (запись осталась в БД) — тоже считаем удаление
    // успешным, иначе такой мод нельзя будет убрать из списка.
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** Renames a content file on disk so Minecraft actually enables or disables it. */
export async function setContentEnabledInIntent(
  dirName: string,
  contentType: "mod" | "resourcepack" | "shader",
  fileName: string,
  enabled: boolean,
): Promise<{ success: boolean; fileName?: string; error?: string }> {
  try {
    const intentPath = await ensureBuildIntentDir(dirName)
    const targetDir = path.resolve(intentPath, getContentDirectoryName(contentType))
    const relPath = sanitizeRelativeContentPath(fileName)
    const requested = path.resolve(targetDir, relPath)
    const isInside = requested.startsWith(`${targetDir}${path.sep}`)
    if (!isInside) return { success: false, error: "Недопустимый путь файла" }

    const disabledSuffix = ".disabled"
    const isDisabledName = requested.toLowerCase().endsWith(disabledSuffix)
    const source = enabled && isDisabledName
      ? requested.slice(0, -disabledSuffix.length)
      : !enabled && !isDisabledName
        ? requested
        : requested
    const destination = enabled
      ? (isDisabledName ? requested.slice(0, -disabledSuffix.length) : requested)
      : (isDisabledName ? requested : `${requested}${disabledSuffix}`)

    try {
      await fs.access(source)
    } catch {
      return { success: false, error: "Файл контента не найден" }
    }

    if (source !== destination) await fs.rename(source, destination)
    return { success: true, fileName: path.relative(targetDir, destination).replace(/\\/g, "/") }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export type ImportProgressPayload = {
  current: number
  total: number
  message: string
  itemName?: string
}

export function sendImportProgress(current: number, total: number, message: string, itemName?: string) {
  const payload: ImportProgressPayload = { current, total, message }
  if (itemName) payload.itemName = itemName
  sendToRenderer("import:progress", payload)
}

export async function runConcurrent<T>(tasks: (() => Promise<T>)[], concurrency: number, signal?: AbortSignal): Promise<T[]> {
  const results: T[] = []
  const batchSize = Math.max(1, concurrency)
  for (let i = 0; i < tasks.length; i += batchSize) {
    // После отмены не стартуем новые пачки — текущие задачи откажутся через AbortSignal.
    throwIfImportCancelled(signal)
    const settled = await Promise.allSettled(tasks.slice(i, i + batchSize).map(fn => fn()))
    // Ждём завершения всех задач пачки, чтобы не оставить «висящие» загрузки,
    // и только потом сообщаем о первой ошибке.
    for (const item of settled) {
      if (item.status === "fulfilled") {
        results.push(item.value)
      } else {
        throw item.reason
      }
    }
    throwIfImportCancelled(signal)
  }
  return results
}

export async function copyOverrideEntries(zip: AdmZipType, intentPath: string) {
  for (const entry of zip.getEntries()) {
    if (entry.entryName.startsWith("overrides/") && !entry.isDirectory) {
      const relPath = entry.entryName.replace(/^overrides\//, "")
      const destPath = path.join(intentPath, relPath)
      const destDir = path.dirname(destPath)
      await fs.mkdir(destDir, { recursive: true }).catch(() => {})
      await fs.writeFile(destPath, entry.getData())
    }
  }
}

export function formatDisplayNameFromFileName(fileName: string): string {
  return fileName.replace(/\.jar$|\.zip$/i, "").replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

export function readArchiveText(zip: AdmZipType, entryName: string): string | null {
  const entry = zip.getEntry(entryName)
  if (!entry) return null
  try {
    return entry.getData().toString("utf-8")
  } catch {
    return null
  }
}

function getArchiveMimeType(entryName: string): string {
  const ext = path.extname(entryName).toLowerCase()
  if (ext === ".png") return "image/png"
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg"
  if (ext === ".gif") return "image/gif"
  if (ext === ".webp") return "image/webp"
  if (ext === ".bmp") return "image/bmp"
  if (ext === ".svg") return "image/svg+xml"
  if (ext === ".ico") return "image/x-icon"
  return "application/octet-stream"
}

export function readArchiveEntryAsDataUrl(zip: AdmZipType, entryName?: string | null): string | undefined {
  if (!entryName) return undefined
  const normalizedEntryName = entryName.replace(/^\/+/, "")
  const entry = zip.getEntry(normalizedEntryName)
  if (!entry) return undefined

  try {
    const data = entry.getData()
    return `data:${getArchiveMimeType(normalizedEntryName)};base64,${data.toString("base64")}`
  } catch {
    return undefined
  }
}

export type AdmZipType = {
  getEntries(): { entryName: string; isDirectory: boolean; getData(): Buffer }[]
  getEntry(name: string): { getData(): Buffer } | null
  addLocalFolder(localPath: string, readstream?: unknown, filter?: (entryPath: string) => boolean): void
  writeZip(outputPath: string, keepOrder?: boolean): void
  toBuffer(): Buffer
}
type AdmZipConstructor = new (data?: Buffer) => AdmZipType

let admZipPromise: Promise<AdmZipConstructor> | null = null
export function loadAdmZip(): Promise<AdmZipConstructor> {
  if (!admZipPromise) {
    admZipPromise = import("adm-zip").then(m => m.default as unknown as AdmZipConstructor)
  }
  return admZipPromise
}

let tomlModulePromise: Promise<{ parse(input: string): Record<string, unknown> }> | null = null
export function loadToml(): Promise<{ parse(input: string): Record<string, unknown> }> {
  if (!tomlModulePromise) {
    tomlModulePromise = import("toml").then(m => m.default || m) as Promise<{ parse(input: string): Record<string, unknown> }>
  }
  return tomlModulePromise
}

let modsModulePromise: Promise<ModsModule> | null = null
export function loadModsModule(): Promise<ModsModule> {
  if (!modsModulePromise) {
    modsModulePromise = import("@spot/mods")
  }
  return modsModulePromise
}

import type * as ModsApi from "@spot/mods" with { "resolution-mode": "import" }
type ModsModule = typeof ModsApi
export type { ModsModule }

export type ImportModEntry = {
  id: string
  slug: string
  name: string
  description: string
  version: string
  icon_url?: string
  source?: "local" | "modrinth" | "curseforge"
  projectId?: string
  modId?: number
  author?: string
  enabled?: boolean
}

export type ScannedBuildContent = {
  mods: ImportModEntry[]
  resourcepacks: ImportModEntry[]
  shaders: ImportModEntry[]
  installedMods: Record<string, string>
}

export class ImportCancelledError extends Error {
  constructor() {
    super("Импорт отменен")
    this.name = "ImportCancelledError"
  }
}

export function isImportCancelledError(error: unknown): boolean {
  return error instanceof ImportCancelledError
    || (error instanceof Error && (error.name === "AbortError" || error.message === "Импорт отменен"))
}

let activeImportController: AbortController | null = null

export function throwIfImportCancelled(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new ImportCancelledError()
  }
}

export function startImportSession(): AbortSignal {
  if (activeImportController && !activeImportController.signal.aborted) {
    throw new Error("Импорт уже выполняется")
  }

  activeImportController = new AbortController()
  return activeImportController.signal
}

export function finishImportSession(signal: AbortSignal) {
  if (activeImportController?.signal === signal) {
    activeImportController = null
  }
}

export function cancelImport(): boolean {
  if (!activeImportController || activeImportController.signal.aborted) {
    return false
  }
  activeImportController.abort()
  sendImportProgress(0, 1, "Отмена импорта...")
  return true
}

export function getLoaderSelectionFromModrinthDeps(deps: Record<string, string>): { modLoader: string; loaderVersion?: string } {
  if (deps["fabric-loader"]) return { modLoader: "fabric", loaderVersion: deps["fabric-loader"] }
  if (deps["quilt-loader"]) return { modLoader: "quilt", loaderVersion: deps["quilt-loader"] }
  if (deps["neoforge"]) return { modLoader: "neoforge", loaderVersion: deps["neoforge"] }
  return { modLoader: "vanilla" }
}

export function getLoaderSelectionFromCurseManifest(loaderRaw: string): { modLoader: string; loaderVersion?: string } {
  if (!loaderRaw) return { modLoader: "vanilla" }

  const [loaderType, ...versionParts] = loaderRaw.split("-")
  const loaderVersion = versionParts.join("-") || undefined

  if (loaderType === "fabric") return { modLoader: "fabric", loaderVersion }
  if (loaderType === "quilt") return { modLoader: "quilt", loaderVersion }
  if (loaderType === "neoforge") return { modLoader: "neoforge", loaderVersion }
  return { modLoader: "vanilla" }
}
