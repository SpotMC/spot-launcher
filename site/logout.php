<?php
declare(strict_types=1);
require_once __DIR__ . '/inc/config.php';
require_once __DIR__ . '/inc/security.php';
start_secure_session();
$_SESSION = [];
session_destroy();
header('Location: /');
exit;
