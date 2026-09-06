<?php
/**
 * Публичный API статистики (для дашборда). GET /api/stats.php
 * Возвращает JSON со сводкой, топ-игроками, серверами и активностью.
 * Данные могут обновляться при каждом запросе (close_stale_sessions внутри).
 */

declare(strict_types=1);

require_once __DIR__ . '/../inc/config.php';
require_once __DIR__ . '/../inc/security.php';
require_once __DIR__ . '/../inc/stats.php';

header('Cache-Control: no-store');
json_out(['ok' => true, 'data' => get_dashboard_data()]);
