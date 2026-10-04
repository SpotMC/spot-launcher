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
            // Канал хранится не в БД, а определяется по тому, где лежит файл.
            $fn = (string)$r['filename'];
            if (is_file(UPDATES_DIR . '/' . $fn)) {
                $r['channel'] = 'stable';
                $r['url'] = UPDATES_URL . '/' . rawurlencode($fn);
            } else {
                $r['channel'] = 'beta';
                $r['url'] = UPDATES_URL . '-beta' . '/' . rawurlencode($fn);
            }
        }
        json_out(['ok' => true, 'updates' => $rows]);

    case 'delete-update':
        $id = (int)($_POST['id'] ?? 0);
        $stmt = $db->prepare("SELECT * FROM updates WHERE id = ?");
        $stmt->execute([$id]);
        $u = $stmt->fetch();
        if ($u) {
            $fn = basename((string)$u['filename']);
            // Файл может лежать в stable или в beta — ищем там, где он есть.
            foreach ([UPDATES_DIR, UPDATES_DIR . '-beta'] as $dir) {
                $path = $dir . '/' . $fn;
                $base = realpath($dir) ?: $dir;
                $real = realpath($path);
                if ($real !== false && is_file($real) && str_starts_with($real, $base . DIRECTORY_SEPARATOR)) {
                    @unlink($real);
                    break;
                }
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

    default:
        json_out(['ok' => false, 'error' => 'Unknown action'], 400);
}
