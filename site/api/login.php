<?php
/**
 * API входа администратора: логин + пароль -> сессия.
 * Защита: rate-limit по IP, password_verify (bcrypt), regenerate session id, CSRF.
 */

declare(strict_types=1);

require_once __DIR__ . '/../inc/config.php';
require_once __DIR__ . '/../inc/security.php';
require_once __DIR__ . '/../inc/db.php';

start_secure_session();
require_post();
check_csrf();
rate_limit('admin_login', window: 600, max: 8);

$user = trim((string)($_POST['username'] ?? ''));
$pass = (string)($_POST['password'] ?? '');

$secrets = load_secrets();
if (!$secrets || empty($secrets['passwordHash'])) {
    json_out(['ok' => false, 'error' => 'Server not configured. Run setup.php.'], 503);
}

$adminUser = $secrets['adminUser'] ?? ADMIN_USER;
$ok = hash_equals($adminUser, $user)
    && password_verify($pass, $secrets['passwordHash']);

if (!$ok) {
    json_out(['ok' => false, 'error' => 'Неверный логин или пароль'], 401);
}

// Успешный вход — обновляем ID сессии, чтобы исключить фиксацию.
session_regenerate_id(true);
$_SESSION['admin'] = true;
$_SESSION['csrf'] = bin2hex(random_bytes(32));
$_SESSION['login_at'] = now_ts();

json_out(['ok' => true, 'redirect' => '/admin/']);
