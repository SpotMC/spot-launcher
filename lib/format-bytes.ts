/**
 * Форматирует объём в байтах в человекочитаемый вид (основание 1024).
 * Пример: 1536 → «1.5 КБ», 872033 → «852 КБ».
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 Б"
  const units = ["Б", "КБ", "МБ", "ГБ", "ТБ"]
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`
}
