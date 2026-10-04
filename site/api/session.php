<?php
/**
 * Проверка сессии администратора. GET -> { ok, admin }.
 */

declare(strict_types=1);

require_once __DIR__ . '/../inc/security.php';
require_once __DIR__ . '/../inc/db.php';

start_secure_session();
json_out(['ok' => true, 'admin' => is_admin()]);
