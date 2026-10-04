// Robust task-oriented downloader
// Author: MAINER4IK
import * as fs from "fs";
import * as path from "path";
import * as fsSync from "fs";
import { sha1Hash, ensureDirSync } from "../utils/index.js";
import { DownloadProgressCallback } from "../types/index.js";

export interface DownloadOptions {
  url: string;
  fallbackUrls?: string[];
  dest: string;
  sha1?: string;
  size?: number;
  onProgress?: DownloadProgressCallback;
  retries?: number;
  skipIfExists?: boolean;
}

export interface TaskStatus {
  fileName: string;
  downloaded: number;
  total: number;
  percent: number;
  status: "pending" | "downloading" | "completed" | "failed";
  error?: string;
}

/**
 * A single download task.
 */
export class DownloadTask {
  public status: TaskStatus;
  private currentAttempt = 0;

  constructor(public options: DownloadOptions) {
    this.status = {
      fileName: options.dest ? (fsSync.existsSync(options.dest) ? options.dest : "unknown") : "unknown",
      downloaded: 0,
      total: options.size ?? 0,
      percent: 0,
      status: "pending",
    };
    if (options.dest) {
      this.status.fileName = options.dest.split(/[\\/]/).pop() || "unknown";
    }
  }

  async execute(): Promise<void> {
    const { url, fallbackUrls = [], dest, sha1: expectedSha1, size: expectedSize, onProgress, retries = 3, skipIfExists = true } = this.options;
    
    if (!url) {
      this.status.status = "completed";
      return;
    }

    const candidateUrls = Array.from(new Set([url, ...fallbackUrls].filter(Boolean)));

    // Check if file already exists and is valid
    if (skipIfExists && fsSync.existsSync(dest)) {
      const stats = fsSync.statSync(dest);
      
      if (stats.isDirectory()) {
        // dest is a directory; remove it so we can download the file
        fsSync.rmSync(dest, { recursive: true, force: true });
      } else {
        let isValid = true;

        // Fast path: compare only the size. Hashing every installed file on
        // every launch (libraries + ~1600 assets) made launches feel like a
        // full re-download even when nothing was missing.
        if (typeof expectedSize === "number" && expectedSize > 0 && stats.size !== expectedSize) {
          isValid = false;
        }

        if (isValid) {
          this.status.status = "completed";
          this.status.downloaded = stats.size;
          this.status.total = stats.size;
          this.status.percent = 100;
          return;
        }
      }
    }

    ensureDirSync(path.dirname(dest));

    this.status.status = "downloading";
    let lastError: Error | null = null;

    for (const candidateUrl of candidateUrls) {
      for (let attempt = 1; attempt <= retries; attempt++) {
        this.currentAttempt = attempt;
        try {
          await this.downloadOnce(candidateUrl, dest, expectedSha1, onProgress);
          this.status.status = "completed";
          this.status.percent = 100;
          return;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          if (attempt < retries) {
            await new Promise((r) => setTimeout(r, 1000 * attempt));
          }
        }
      }
    }

    this.status.status = "failed";
    this.status.error = lastError?.message;
    throw lastError ?? new Error(`Failed to download ${url} after ${retries} attempts`);
  }

  private async downloadOnce(
    url: string,
    dest: string,
    expectedSha1: string | undefined,
    onProgress: DownloadProgressCallback | undefined,
  ): Promise<void> {
    if (url.startsWith("file://")) {
      const sourcePath = url.slice(7);
      if (!fsSync.existsSync(sourcePath)) throw new Error(`File not found: ${sourcePath}`);
      ensureDirSync(path.dirname(dest));
      fsSync.copyFileSync(sourcePath, dest);
      return;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

    const totalSize = parseInt(res.headers.get("content-length") ?? "0", 10);
    this.status.total = totalSize > 0 ? totalSize : this.status.total;

    // Generate a unique temp path so parallel downloads of the same dest
    // never collide, and clean up *all* stale temp files for this dest.
    const tempBase = `${dest}.tmp`;
    const unique = `${tempBase}.${process.pid}.${Math.random().toString(36).slice(2, 8)}`;
    cleanupTempFiles(tempBase);
    ensureDirSync(path.dirname(unique));

    const writeStream = fsSync.createWriteStream(unique);
    const reader = res.body?.getReader();
    if (!reader) throw new Error("No reader for response body");

    let downloaded = 0;
    let rejectStream: ((err: Error) => void) | undefined;
    const streamError = new Promise<void>((_, reject) => {
      rejectStream = reject;
    });
    writeStream.on("error", rejectStream!);

    let tempCommitted = false;

    try {
      while (true) {
        const { done, value } = await Promise.race([reader.read(), streamError]) as any;
        if (done) break;

        downloaded += value.length;
        this.status.downloaded = downloaded;
        if (this.status.total > 0) {
          this.status.percent = Math.round((downloaded / this.status.total) * 100);
        }

        if (onProgress) {
          onProgress({
            fileName: this.status.fileName,
            file: dest,
            downloaded,
            total: this.status.total,
            percent: this.status.percent,
          });
        }

        await new Promise<void>((resolve, reject) => {
          writeStream.write(Buffer.from(value), (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      await new Promise<void>((resolve) => writeStream.end(resolve));

      if (expectedSha1) {
        const actualSha1 = sha1Hash(fsSync.readFileSync(unique));
        if (actualSha1 !== expectedSha1) {
          throw new Error(`SHA1 mismatch: expected ${expectedSha1}, got ${actualSha1}`);
        }
      }

      commitFile(unique, dest);
      tempCommitted = true;
    } finally {
      if (!tempCommitted) {
        removeBestEffort(unique);
      }
      // Always sweep any lingering temp files for this dest.
      removeBestEffort(tempBase);
      writeStream.removeListener("error", rejectStream!);
    }
  }
}

function cleanupTempFiles(tempBase: string): void {
  let dir: string;
  let prefix: string;
  try {
    dir = path.dirname(tempBase);
    prefix = path.basename(tempBase);
  } catch {
    return;
  }

  let entries: string[];
  try {
    entries = fsSync.readdirSync(dir);
  } catch {
    return;
  }

  for (const name of entries) {
    if (name === prefix || name.startsWith(`${prefix}.`)) {
      removeBestEffort(path.join(dir, name));
    }
  }
}

function removeBestEffort(target: string): void {
  try {
    if (!fsSync.existsSync(target)) return;
    const s = fsSync.statSync(target);
    if (s.isDirectory()) fsSync.rmSync(target, { recursive: true, force: true });
    else fsSync.rmSync(target, { force: true });
  } catch {
    // best effort — file may be locked by another process
  }
}

// Moves `from` onto `to` in a way that works reliably on Windows, where
// renameSync over an existing file often throws EPERM. If the destination
// cannot be replaced, fall back to a copy so the download still succeeds.
function commitFile(from: string, to: string): void {
  const retries = 4;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      removeBestEffort(to);
      fsSync.renameSync(from, to);
      return;
    } catch (err) {
      if (attempt === retries - 1) {
        // Last resort: copy instead of rename.
        removeBestEffort(to);
        fsSync.copyFileSync(from, to);
        return;
      }
      // Give any lock-holder a moment to release the file.
      const pause = new Date().getTime() + 80 * (attempt + 1);
      while (new Date().getTime() < pause) { /* busy-wait */ }
      removeBestEffort(to);
    }
  }
}

/**
 * A job containing multiple tasks, executing them in parallel with a concurrency limit.
 */
export class DownloadJob {
  private tasks: DownloadTask[] = [];
  private concurrency: number;

  constructor(public name: string, concurrency = 16) {
    this.concurrency = concurrency;
  }

  addTask(options: DownloadOptions): DownloadTask {
    const task = new DownloadTask(options);
    this.tasks.push(task);
    return task;
  }

  async execute(): Promise<void> {
    const queue = [...this.tasks];
    const workers: Promise<void>[] = [];

    const worker = async (): Promise<void> => {
      while (queue.length > 0) {
        const task = queue.shift();
        if (task) {
          try {
            await task.execute();
          } catch (e) {
            console.error(`[DownloadJob:${this.name}] Task failed: ${task.options.url}`, e);
          }
        }
      }
    };

    for (let i = 0; i < Math.min(this.concurrency, this.tasks.length); i++) {
      workers.push(worker());
    }

    await Promise.all(workers);

    const failed = this.tasks.filter(t => t.status.status === "failed");
    if (failed.length > 0) {
      throw new Error(`Job "${this.name}" failed with ${failed.length} errors. First error: ${failed[0].status.error}`);
    }
  }

  get stats() {
    const total = this.tasks.length;
    const completed = this.tasks.filter(t => t.status.status === "completed").length;
    const failed = this.tasks.filter(t => t.status.status === "failed").length;
    const downloading = this.tasks.filter(t => t.status.status === "downloading").length;
    
    return { total, completed, failed, downloading };
  }
}

/**
 * Legacy Downloader class for backward compatibility.
 */
export class Downloader {
  async download(options: DownloadOptions): Promise<void> {
    const task = new DownloadTask(options);
    await task.execute();
  }

  async downloadMultiple(items: DownloadOptions[], concurrency = 16): Promise<void> {
    const job = new DownloadJob("LegacyMulti", concurrency);
    for (const item of items) {
      job.addTask(item);
    }
    await job.execute();
  }
}
