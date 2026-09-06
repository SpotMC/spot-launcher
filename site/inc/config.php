<?php
/**
 * Spot Stats — конфигурация сайта.
 *
 * ВАЖНО: перед заливкой на хостинг отредактируйте значения ниже.
 * Значение SITE_BASE / UPDATES_URL / EVENTS_SECRET / ADMIN_USER можно заменить,
 * но секреты надёжнее генерировать через setup.php (см. ниже).
 */

declare(strict_types=1);

// Базовый URL сайта (без слэша в конце). Домен укажите позже, например:
// define('SITE_BASE', 'https://admin.boberchat.ru');
if (!defined('SITE_BASE')) {
    define('SITE_BASE', 'https://admin.boberchat.ru');
}

// Публичный URL папки обновлений лаунчера (generic-фид electron-updater).
if (!defined('UPDATES_URL')) {
    define('UPDATES_URL', SITE_BASE . '/updates');
}

// Имя и логин администратора.
if (!defined('ADMIN_USER')) {
    define('ADMIN_USER', 'admin');
}

// Каталоги.
if (!defined('DATA_DIR')) {
    define('DATA_DIR', __DIR__ . '/../data');
}
if (!defined('UPDATES_DIR')) {
    define('UPDATES_DIR', __DIR__ . '/../updates');
}
if (!defined('DB_FILE')) {
    define('DB_FILE', DATA_DIR . '/stats.sqlite');
}

// Файл секретов (генерируется setup.php). Хранит хэш пароля админа и HMAC-секрет.
if (!defined('SECRETS_FILE')) {
    define('SECRETS_FILE', DATA_DIR . '/.secrets.php');
}

// Ограничения загрузки обновлений (байты).
if (!defined('MAX_UPLOAD_BYTES')) {
    define('MAX_UPLOAD_BYTES', 1024 * 1024 * 1024); // 1 ГБ
}

// Какие расширения можно загружать в папку обновлений.
if (!defined('ALLOWED_EXT')) {
    define('ALLOWED_EXT', ['yml', 'yaml', 'exe', 'zip', 'blockmap', 'json', 'txt']);
}

// Защитные HTTP-заголовки.
if (!defined('ENABLE_HSTS')) {
    define('ENABLE_HSTS', true);
}

/**
 * Загрузка секретов. Возвращает массив [passwordHash, eventSecret] или null,
 * если setup ещё не выполнен.
 */
function load_secrets(): ?array {
    $file = SECRETS_FILE;
    if (!is_file($file)) return null;
    $out = require $file;
    if (!is_array($out)) return null;
    if (empty($out['passwordHash']) || empty($out['eventSecret'])) return null;
    return $out;
}

// Применяем защитные заголовки при не-CLI-запросе.
if (PHP_SAPI !== 'cli') {
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    header('Permissions-Policy: geolocation=(), microphone=(), camera=()');
    if (ENABLE_HSTS && !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        header('Strict-Transport-Security: max-age=63072000; includeSubDomains');
    }
    // При необходимости принудительно переключаем на HTTPS:
    // if (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS'] === 'off') {
    //     header('Location: ' . SITE_BASE . $_SERVER['REQUEST_URI']);
    //     exit;
    // }
}
