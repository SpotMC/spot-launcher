import { app } from "electron"
import fsSync from "fs"
import path from "path"

// Переезд каталогов данных со старых имён (spotlauncher / spot-launcher)
// на новые (spotlauncher / spot-launcher) при первом запуске. Выполняется
// только если целевой каталог ещё не существует, а старый найден.
export function migrateLegacyLauncherDirectories(): void {
  const home = app.getPath("home")
  const pairs: Array<[string, string]> = [
    [path.join(app.getPath("appData"), "spotlauncher"), path.join(app.getPath("appData"), "spotlauncher")],
    [path.join(home, ".spotlauncher"), path.join(home, ".spotlauncher")],
    [path.join(home, ".config", "spot-launcher"), path.join(home, ".config", "spot-launcher")],
    [path.join(home, ".cache", "spot-launcher"), path.join(home, ".cache", "spot-launcher")],
  ]

  for (const [from, to] of pairs) {
    try {
      if (fsSync.existsSync(from) && !fsSync.existsSync(to)) {
        fsSync.renameSync(from, to)
        console.log(`[Migration] ${from} -> ${to}`)
      }
    } catch (error) {
      console.error(`[Migration] Failed to migrate ${from}:`, error)
    }
  }
}
