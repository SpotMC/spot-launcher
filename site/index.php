<?php
/**
 * Точка входа. Статистика и управление доступны только администраторам.
 * Все остальные перенаправляются на страницу входа (с защитой PIN-кодом).
 */

declare(strict_types=1);

require_once __DIR__ . '/inc/config.php';
require_once __DIR__ . '/inc/security.php';
start_secure_session();

// Только админы → админка. Остальные → пин/логин.
if (is_admin()) {
    header('Location: /admin/');
} else {
    header('Location: /login.php');
}
exit;
