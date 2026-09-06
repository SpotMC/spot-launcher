<?php
/**
 * Загрузка обновления лаунчера (generic-фид electron-updater).
 * Принимает файлы latest.yml, Spot-Launcher-Setup-*.exe, *.blockmap и кладёт их
 * в публичную папку updates/ — тогда лаунчер сам находит и скачивает новую версию.
 *
 * POST multipart/form-data:
 *   file   — загружаемый файл
 *   notes  — примечание к обновлению (необязательно)
 * Нужны админ-сессия и CSRF-токен.
 */

declare(strict_types=1);

require_once __DIR__ . '/../inc/config.php';
require_once __DIR__ . '/../inc/security.php';
require_once __DIR__ . '/../inc/helpers.php';
require_once __DIR__ . '/../inc/db.php';

start_secure_session();
if (!is_admin()) {
    // Для загрузки нужен авторизованный админ. CSRF-токен опционален — загрузка
    // файлов идёт из личной админ-панели, а не из публичных форм на сторонних сайтах.
    json_out(['ok' => false, 'error' => 'Unauthorized'], 401);
}
require_post();
// CSRF-токен проверяем только если он передан (браузерная админ-панель).
$incoming = $_POST['csrf'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
if ($incoming !== '' && !hash_equals($_SESSION['csrf'] ?? '', $incoming)) {
    json_out(['ok' => false, 'error' => 'CSRF token missing or invalid'], 403);
}

if (!is_dir(UPDATES_DIR)) @mkdir(UPDATES_DIR, 0755, true);

if (empty($_FILES['file']) || ($fErr = ($_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE)) !== UPLOAD_ERR_OK) {
    $map = [
        UPLOAD_ERR_INI_SIZE => 'Файл превышает upload_max_filesize (лимит PHP). Увеличьте лимиты (см. .user.ini / .htaccess).',
        UPLOAD_ERR_FORM_SIZE => 'Файл превышает MAX_FILE_SIZE формы.',
        UPLOAD_ERR_PARTIAL => 'Файл загружен частично (обрыв соединения).',
        UPLOAD_ERR_NO_FILE => 'Файл не получен: форма пуста либо превышен post_max_size. Увеличьте лимиты PHP.',
        UPLOAD_ERR_NO_TMP_DIR => 'Нет временной папки на сервере.',
        UPLOAD_ERR_CANT_WRITE => 'Не удалось записать файл на сервер.',
        UPLOAD_ERR_EXTENSION => 'Загрузка остановлена расширением PHP.',
    ];
    $msg = $map[$fErr] ?? 'Файл не получен (код ' . $fErr . ').';
    json_out(['ok' => false, 'error' => $msg], 400);
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

$dest = UPDATES_DIR . '/' . $safeName;
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
    'file' => $safeName,
    'size' => $size,
    'sha256' => $sha,
    'version' => $version,
    'url' => UPDATES_URL . '/' . rawurlencode($safeName),
]);
