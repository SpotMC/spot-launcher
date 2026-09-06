<?php
/**
 * Функции безопасности: CSRF, rate-limit, сессии, JSON-ответы.
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

/** Отправить JSON-ответ и завершить. */
function json_out(array $data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Начать защищённую сессию. */
function start_secure_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'httponly' => true,
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'samesite' => 'Lax',
    ]);
    session_name('SPOTSESSID');
    session_start();
    // Защита от фиксации сессии: периодически обновляем ID.
    if (!isset($_SESSION['init'])) {
        session_regenerate_id(true);
        $_SESSION['init'] = time();
    }
}

/** Только метод POST (иначе — 405). */
function require_post(): void {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        json_out(['ok' => false, 'error' => 'Method Not Allowed'], 405);
    }
}

/**
 * Валидация CSRF-токена. Для форм сайта (не для API лаунчера).
 */
function check_csrf(): void {
    $token = $_POST['csrf'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($token) || !hash_equals($_SESSION['csrf'] ?? '', $token)) {
        json_out(['ok' => false, 'error' => 'CSRF token missing or invalid'], 403);
    }
}

/** Сгенерировать CSRF-токен и сохранить в сессии. */
function csrf_token(): string {
    start_secure_session();
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

/** Текущий IP клиента (учитывает прокси; настройте доверенный заголовок при необходимости). */
function client_ip(): string {
    $keys = ['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'];
    foreach ($keys as $k) {
        if (!empty($_SERVER[$k])) {
            $v = explode(',', $_SERVER[$k])[0];
            $v = trim($v);
            if ($v !== '') return $v;
        }
    }
    return '0.0.0.0';
}

/**
 * Rate-limit на основе SQLite-таблицы rate_limiting.
 * $window — окно в секундах, $max — max попыток за окно.
 * Возвращает true, если запрос разрешён; иначе завершает ответ 429.
 */
function rate_limit(string $action, int $window = 300, int $max = 8): void {
    $db = db();
    $ip = client_ip();
    $now = time();
    // Чистим старые записи.
    $db->exec("DELETE FROM rate_limiting WHERE window_start < " . intval($now - $window));
    $db->prepare("DELETE FROM rate_limiting WHERE action = ? AND ip = ? AND window_start < ?")
        ->execute([$action, $ip, $now - $window]);
    $db->prepare("INSERT INTO rate_limiting (action, ip, window_start, count) VALUES (?,?,?,1)
                  ON CONFLICT(action, ip, window_start) DO UPDATE SET count = count + 1")
        ->execute([$action, $ip, intdiv($now, $window)]);
    $stmt = $db->prepare("SELECT count FROM rate_limiting WHERE action = ? AND ip = ? AND window_start = ?");
    $stmt->execute([$action, $ip, intdiv($now, $window)]);
    $count = (int)($stmt->fetchColumn() ?: 0);
    if ($count > $max) {
        header('Retry-After: ' . $window);
        json_out(['ok' => false, 'error' => 'Too many attempts. Please try again later.'], 429);
    }
}

/** Проверка, что пользователь вошёл как админ. */
function is_admin(): bool {
    start_secure_session();
    return !empty($_SESSION['admin']) && $_SESSION['admin'] === true;
}

/** Требовать админа иначе — вернуть 401 JSON (для API) или редирект (для страниц). */
function require_admin(bool $redirect = true): void {
    if (is_admin()) return;
    if ($redirect && preg_match('/^\/[^.]*$/i', $_SERVER['REQUEST_URI'] ?? '/')) {
        header('Location: /login.php');
        exit;
    }
    json_out(['ok' => false, 'error' => 'Unauthorized'], 401);
}

/** Константа времени (UTC timestamp). */
function now_ts(): int {
    return time();
}
