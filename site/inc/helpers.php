<?php
/**
 * Вспомогательные функции (безопасные имена файлов, парсинг latest.yml).
 */

declare(strict_types=1);

/** Безопасное имя файла: только латиница, цифры, . _ -
 *  (убираем всё, что может быть опасно в путях/URL). */
function sanitize_filename(string $name): string {
    $name = basename($name);
    // Сначала декодируем url-encoding на всякий случай.
    $name = rawurldecode($name);
    $name = preg_replace('/[^A-Za-z0-9._\-]/u', '_', $name);
    $name = preg_replace('/_{2,}/', '_', $name);
    $name = trim($name, '._-');
    if ($name === '') $name = 'file_' . bin2hex(random_bytes(4));
    return $name;
}

/** Вытащить версию из latest.yml (максимально просто и безопасно). */
function extract_version_from_yml(string $path): ?string {
    $content = @file_get_contents($path);
    if ($content === false) return null;
    // Ищем строки вида "version: 1.2.3"
    if (preg_match('/^\s*version:\s*["\']?([^"\s\']+)["\']?\s*$/m', $content, $m)) {
        return $m[1];
    }
    return null;
}

/** Форматировать длительность в человекопонятный вид "X ч Y мин". */
function format_duration(int $seconds): string {
    $h = intdiv($seconds, 3600);
    $m = intdiv($seconds % 3600, 60);
    if ($h > 0) return $h . ' ч ' . $m . ' мин';
    return $m . ' мин';
}

/** Форматировать дату из unix-времени в локальную строку. */
function format_date(?int $ts): string {
    if (!$ts) return '—';
    return date('d.m.Y H:i', $ts);
}
