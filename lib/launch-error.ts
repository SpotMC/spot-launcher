import type { TFunction } from "i18next"

/**
 * Коды ошибок запуска, которые main-process отдаёт вместо готового текста,
 * чтобы renderer мог показать локализованное сообщение.
 */
const LAUNCH_ERROR_I18N_KEYS: Record<string, string> = {
  UPDATE_REQUIRED: "settings.update.forcedBlocked",
}

/**
 * Превращает `error` из ответа `minecraft:launch` в текст для интерфейса.
 * Известные коды переводятся через i18n, остальные показываются как есть.
 */
export function resolveLaunchErrorMessage(error: string | undefined, t: TFunction, fallback: string): string {
  if (!error) return fallback
  const key = LAUNCH_ERROR_I18N_KEYS[error]
  return key ? t(key) : error
}
