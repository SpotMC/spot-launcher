<?php
/**
 * Загрузка обновления лаунчера (generic-фид electron-updater).
 * Принимает файлы latest.yml, Spot-Launcher-Setup-*.exe, *.blockmap и кладёт их
 * в публичную папку updates/ — тогда лаунчер сам находит и скачивает новую версию.
 *
 * POST multipart/form-data:
 *   file    — загружаемый файл
 *   notes   — примечание к обновлению (необязательно)
 *   channel — канал: stable (по умолчанию) или beta
 * Нужны админ-сессия и CSRF-токен.
 *
 * Канал влияет только на целевую папку (updates/ или updates-beta/).
 * Схема БД не меняется: колонки channel здесь нет и не требуется.
 */

declare(strict_types=1);

require_once __DIR__ . '/../inc/config.php';
require_once __DIR__ . '/../inc/security.php';
require_once __DIR__ . '/../inc/helpers.php';
require_once __DIR__ . '/../inc/db.php';

start_secure_session();
require_admin(redirect: false);
require_post();
check_csrf();

// Канал: stable → UPDATES_DIR, beta → UPDATES_DIR-beta.
// Ничего больше от канала не зависит, поэтому новых таблиц/колонок не нужно.
$channel = (($_POST['channel'] ?? '') === 'beta') ? 'beta' : 'stable';
$targetDir = $channel === 'beta' ? UPDATES_DIR . '-beta' : UPDATES_DIR;

if (!is_dir($targetDir)) @mkdir($targetDir, 0755, true);

if (empty($_FILES['file']) || ($_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    json_out(['ok' => false, 'error' => 'Файл не получен'], 400);
}

$f = $_FILES['file'];
$tmp = $f['tmp_name'];
$origName = basename((string)$f['name']);
$size = (int)$f['size'];

if ($size < 1 || $size > MAX_UPLOAD_BYTES) {
    json_out(['ok' => false, 'error' => 'Недопустимый размер файла'], 400);
}
if (!is_uploaded_file($tmp)) {
    json_out(['ok' => false, 'error' => 'Неверный источник файла'], 400);
}

$ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
if (!in_array($ext, ALLOWED_EXT, true)) {
    json_out(['ok' => false, 'error' => 'Недопустимое расширение: .' . $ext . '. Разрешено: ' . implode(', ', ALLOWED_EXT) . '.'], 400);
}

// Оставляем исходное имя (electron-updater ожидает точные имена из latest.yml).
$safeName = sanitize_filename($origName);

$dest = $targetDir . '/' . $safeName;
if (!move_uploaded_file($tmp, $dest)) {
    json_out(['ok' => false, 'error' => 'Не удалось сохранить файл'], 500);
}
@chmod($dest, 0644);

$sha = hash_file('sha256', $dest);
$version = null;
if ($ext === 'yml' || $ext === 'yaml') {
    $version = extract_version_from_yml($dest);
}
if ($ext === 'exe') {
    // Пробуем извлечь версию из имени файла Spot-Launcher-Setup-X.Y.Z.exe
    if (preg_match('/-(\d+\.\d+\.\d+(?:[-+][\w.-]+)?)\.exe$/i', $safeName, $vm)) {
        $version = $vm[1];
    }
}

$db = db();
$db->prepare("INSERT INTO updates (filename, version, size, sha256, uploaded_at, notes) VALUES (?,?,?,?,?,?)")
    ->execute([$safeName, $version, $size, $sha, now_ts(), (string)($_POST['notes'] ?? '')]);

json_out([
    'ok' => true,
    'channel' => $channel,
    'file' => $safeName,
    'size' => $size,
    'sha256' => $sha,
    'version' => $version,
    'url' => ($channel === 'beta' ? UPDATES_URL . '-beta' : UPDATES_URL) . '/' . rawurlencode($safeName),
]);
