<?php
/**
 * Админ-API. Только для авторизованного администратора.
 * Действия (method POST, требуется CSRF):
 *   action=list-updates          — список загруженных обновлений
 *   action=delete-update         — удалить файл обновления (id)
 *   action=list-players          — список игроков (поиск nick)
 *   action=player-detail         — детальная статистика по нику (nick)
 *   action=list-servers          — список серверов
 *   action=toggle-spot           — пометить/снять пометку "наш сервер" (server)
 *   action=close-stale           — закрыть зависшие сессии
 */

declare(strict_types=1);

require_once __DIR__ . '/../inc/config.php';
require_once __DIR__ . '/../inc/security.php';
require_once __DIR__ . '/../inc/helpers.php';
require_once __DIR__ . '/../inc/stats.php';

start_secure_session();
require_admin(redirect: false);
require_post();
check_csrf();

$db = db();
$action = (string)($_POST['action'] ?? '');

switch ($action) {
    case 'list-updates':
        $rows = $db->query("SELECT * FROM updates ORDER BY uploaded_at DESC")->fetchAll();
        foreach ($rows as &$r) {
            $r['url'] = UPDATES_URL . '/' . rawurlencode($r['filename']);
        }
        json_out(['ok' => true, 'updates' => $rows]);

    case 'delete-update':
        $id = (int)($_POST['id'] ?? 0);
        $stmt = $db->prepare("SELECT * FROM updates WHERE id = ?");
        $stmt->execute([$id]);
        $u = $stmt->fetch();
        if ($u) {
            $path = UPDATES_DIR . '/' . $u['filename'];
            if (is_file($path) && str_starts_with($path, realpath(UPDATES_DIR) ?: UPDATES_DIR)) {
                @unlink($path);
            }
            $db->prepare("DELETE FROM updates WHERE id = ?")->execute([$id]);
        }
        json_out(['ok' => true]);

    case 'list-players':
        $q = trim((string)($_POST['q'] ?? ''));
        $sql = "SELECT nick, total_seconds, sessions_count, first_seen, last_seen FROM (
                    SELECT p.nick, p.total_seconds, p.first_seen, p.last_seen,
                           (SELECT COUNT(*) FROM sessions s WHERE s.player_id = p.id) AS sessions_count
                    FROM players p
                 ) AS sub";
        $params = [];
        if ($q !== '') {
            $sql .= " WHERE nick LIKE ?";
            $params[] = '%' . $q . '%';
        }
        $sql .= " ORDER BY total_seconds DESC LIMIT 200";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $players = $stmt->fetchAll();
        foreach ($players as &$p) {
            $p['total_hours'] = round((int)$p['total_seconds'] / 3600, 1);
        }
        json_out(['ok' => true, 'players' => $players]);

    case 'player-detail':
        $nick = trim((string)($_POST['nick'] ?? ''));
        $detail = get_player_detail($nick);
        if (!$detail) {
            json_out(['ok' => false, 'error' => 'Игрок не найден'], 404);
        }
        foreach ($detail['sessions'] as &$s) {
            $s['joined_at'] = format_date((int)$s['joined_at']);
            $s['left_at'] = format_date($s['left_at'] ? (int)$s['left_at'] : null);
            $s['duration'] = $s['duration_seconds'] !== null ? format_duration((int)$s['duration_seconds']) : '—';
        }
        json_out(['ok' => true, 'detail' => $detail]);

    case 'list-servers':
        $servers = $db->query("SELECT address, label, is_spot, sessions_count, total_seconds FROM servers ORDER BY total_seconds DESC")->fetchAll();
        foreach ($servers as &$s) {
            $s['total_hours'] = round((int)$s['total_seconds'] / 3600, 1);
        }
        json_out(['ok' => true, 'servers' => $servers]);

    case 'toggle-spot':
        $address = trim((string)($_POST['server'] ?? ''));
        $toSpot = (int)($_POST['is_spot'] ?? 0) === 1;
        $stmt = $db->prepare("UPDATE servers SET is_spot = ? WHERE address = ?");
        $stmt->execute([$toSpot ? 1 : 0, $address]);
        json_out(['ok' => true]);

    case 'close-stale':
        close_stale_sessions($db);
        json_out(['ok' => true]);

    case 'stats':
        $daily = daily_activity($db, 30);
        $online = count_online($db);

        $srvRows = $db->query("SELECT label, total_seconds, sessions_count FROM servers ORDER BY total_seconds DESC LIMIT 10")->fetchAll();
        $servers = array_map(function ($s) {
            return ['label' => $s['label'] !== '' ? $s['label'] : $s['address'], 'hours' => round((int)$s['total_seconds'] / 3600, 1), 'sessions' => (int)$s['sessions_count']];
        }, $srvRows);

        $plRows = $db->query("SELECT nick, total_seconds FROM players ORDER BY total_seconds DESC LIMIT 10")->fetchAll();
        $players = array_map(function ($p) {
            return ['nick' => $p['nick'], 'hours' => round((int)$p['total_seconds'] / 3600, 1)];
        }, $plRows);

        $tot = $db->query("SELECT COUNT(*) c, COALESCE(SUM(total_seconds),0) ts FROM players")->fetch();
        $ses = $db->query("SELECT COALESCE(SUM(duration_seconds),0) ts, COUNT(*) c FROM sessions WHERE left_at IS NOT NULL")->fetch();

        json_out([
            'ok' => true,
            'online' => $online,
            'daily' => $daily,
            'servers' => $servers,
            'players' => $players,
            'totals' => [
                'players' => (int)$tot['c'],
                'total_hours' => round((int)$tot['ts'] / 3600, 1),
                'sessions' => (int)$ses['c'],
                'play_hours' => round((int)$ses['ts'] / 3600, 1),
            ],
        ]);

    default:
        json_out(['ok' => false, 'error' => 'Unknown action'], 400);
}
