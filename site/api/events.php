<?php
/**
 * API приёма событий от лаунчера.
 * Защита: подпись HMAC-SHA256 по телу + timestamp (предотвращает подделку и replay).
 *
 * Протокол:
 *   POST /api/events.php
 *   Подпись передаётся одним из двух способов:
 *     1) Header: Authorization: Bearer <timestamp>.<hmac>
 *     2) Query:  ?ts=<timestamp>&sig=<hmac>   (используется лаунчером Spot)
 *   Body (raw JSON): { "event": "join"|"leave"|"heartbeat"|"launcher_start", "nick": "...", "server": "ip:port", "server_label": "...", "is_spot": false }
 *
 *   hmac = hex( hash_hmac('sha256', timestamp . '.' . rawBody, $eventSecret) )
 *   timestamp должен отличаться от текущего времени не более чем на 900 секунд.
 *
 * Только HTTP-метод POST. Размер тела ограничен.
 */

declare(strict_types=1);

require_once __DIR__ . '/../inc/config.php';
require_once __DIR__ . '/../inc/security.php';
require_once __DIR__ . '/../inc/stats.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(['ok' => false, 'error' => 'Method Not Allowed'], 405);
}

// Ограничение размера входящего тела.
$contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($contentLength > 16 * 1024) {
    json_out(['ok' => false, 'error' => 'Body too large'], 413);
}

$secrets = load_secrets();
if (!$secrets) {
    json_out(['ok' => false, 'error' => 'Server not configured'], 503);
}

// --- Проверка подписи ---
// Лаунчер шлёт подпись в query (?ts=..&sig=..); поддерживаем и старый
// вариант через Header: Authorization: Bearer <ts>.<hmac>.
$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
if ($auth === '' && !empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
    $auth = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
}
$ts = '';
$sig = '';
if (preg_match('/^Bearer\s+([^.\s]+)\.([a-f0-9]{64})$/i', trim($auth), $m)) {
    $ts = $m[1];
    $sig = strtolower($m[2]);
} elseif (isset($_GET['ts'], $_GET['sig']) && is_string($_GET['ts']) && is_string($_GET['sig'])) {
    $ts = trim($_GET['ts']);
    $sig = strtolower(trim($_GET['sig']));
}
if (!preg_match('/^\d{10,13}$/', $ts) || !preg_match('/^[a-f0-9]{64}$/', $sig)) {
    json_out(['ok' => false, 'error' => 'Bad signature'], 401);
}
if (abs(now_ts() - (int)$ts) > 900) {
    json_out(['ok' => false, 'error' => 'Signature expired'], 401);
}

$rawBody = file_get_contents('php://input');
if ($rawBody === false || $rawBody === '') {
    json_out(['ok' => false, 'error' => 'Empty body'], 400);
}

$expected = hash_hmac('sha256', $ts . '.' . $rawBody, $secrets['eventSecret']);
if (!hash_equals($expected, $sig)) {
    json_out(['ok' => false, 'error' => 'Invalid signature'], 401);
}

$payload = json_decode($rawBody, true);
if (!is_array($payload)) {
    json_out(['ok' => false, 'error' => 'Invalid JSON'], 400);
}

// Лёгкий rate-limit на приём событий с одного IP (защита от спама).
// Сердцебиения лаунчера следуют каждые несколько секунд, поэтому запас широкий.
rate_limit('events', window: 60, max: 240);

try {
    $result = handle_event($payload);
} catch (Throwable $e) {
    json_out(['ok' => false, 'error' => 'Server error'], 500);
}

if (empty($result['ok'])) {
    json_out(['ok' => false, 'error' => is_string($result['error'] ?? null) ? $result['error'] : 'Bad event'], 400);
}

json_out(['ok' => true]);
