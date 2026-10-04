<?php
/**
 * Логика статистики: обработка событий лаунчера и агрегированные выборки.
 */

declare(strict_types=1);

require_once __DIR__ . '/db.php';

/** Нормализация ника (обрезаем, приводим к нижнему регистру для сравнения). */
function normalize_nick(string $nick): string {
    $nick = trim($nick);
    return preg_replace('/\s+/', ' ', $nick);
}

/** Получить или создать запись игрока. Возвращает id. */
function upsert_player(PDO $db, string $nick): int {
    $db->prepare("INSERT INTO players (nick, first_seen, last_seen) VALUES (?,?,?)
                  ON CONFLICT(nick) DO UPDATE SET last_seen = excluded.last_seen")
        ->execute([$nick, now_ts(), now_ts()]);
    $stmt = $db->prepare("SELECT id FROM players WHERE nick = ?");
    $stmt->execute([$nick]);
    return (int)$stmt->fetchColumn();
}

/** Получить или создать запись сервера. Возвращает id. */
function upsert_server(PDO $db, string $address, string $label, bool $isSpot): int {
    $db->prepare("INSERT INTO servers (address, label, is_spot) VALUES (?,?,?)
                  ON CONFLICT(address) DO UPDATE SET label = excluded.label, is_spot = excluded.is_spot")
        ->execute([$address, $label, $isSpot ? 1 : 0]);
    $stmt = $db->prepare("SELECT id FROM servers WHERE address = ?");
    $stmt->execute([$address]);
    return (int)$stmt->fetchColumn();
}

/** Закрыть незакрытые сессии игрока (например после краша) старше $maxAge секунд. */
function close_stale_sessions(PDO $db, int $maxAge = 300): void {
    $now = now_ts();
    $cutoff = $now - $maxAge;
    // Живучесть определяется по последнему heartbeat (last_seen), для старых
    // записей без колонки — по времени старта сессии.
    $stmt = $db->prepare(
        "SELECT id, joined_at, COALESCE(last_seen, joined_at) AS alive_at
         FROM sessions WHERE left_at IS NULL AND COALESCE(last_seen, joined_at) < ?"
    );
    $stmt->execute([$cutoff]);
    while ($s = $stmt->fetch()) {
        $sid = (int)$s['id'];
        $dur = max(0, $now - (int)$s['alive_at']);
        $db->prepare("UPDATE sessions SET left_at = ?, duration_seconds = ? WHERE id = ?")->execute([$cutoff, $dur, $sid]);
    }
    // Пересчёт агрегатов можно выполнить здесь же или отдельным запросом.
    recompute_player_totals($db);
    recompute_server_totals($db);
}

/** Пересчитать total_seconds у игроков на основе закрытых сессий. */
function recompute_player_totals(PDO $db): void {
    $db->exec("UPDATE players SET total_seconds = COALESCE((SELECT SUM(duration_seconds) FROM sessions WHERE sessions.player_id = players.id AND duration_seconds IS NOT NULL), 0)");
}

/** Пересчитать агрегаты серверов. */
function recompute_server_totals(PDO $db): void {
    $db->exec("UPDATE servers SET
        sessions_count = (SELECT COUNT(*) FROM sessions WHERE sessions.server_id = servers.id),
        total_seconds   = (SELECT COALESCE(SUM(duration_seconds),0) FROM sessions WHERE sessions.server_id = servers.id AND duration_seconds IS NOT NULL)");
}

/**
 * Обработать событие от лаунчера.
 * @return array{ok:bool, error?:string}
 */
function handle_event(array $payload): array {
    $event = $payload['event'] ?? null;
    $nickRaw = $payload['nick'] ?? '';
    $server = $payload['server'] ?? '';
    $label = $payload['server_label'] ?? ($server !== '' ? $server : 'Неизвестный сервер');
    $isSpot = isset($payload['is_spot']) ? ((int)$payload['is_spot'] === 1) : false;

    if (!in_array($event, ['join', 'leave', 'heartbeat', 'launcher_start'], true)) {
        return ['ok' => false, 'error' => 'Unknown event'];
    }
    $nick = normalize_nick((string)$nickRaw);

    // Событие старта лаунчера: сервера нет, просто фиксируем активность никелем.
    if ($event === 'launcher_start') {
        if ($nick !== '') {
            upsert_player(db(), $nick);
        }
        return ['ok' => true];
    }

    if ($nick === '' || $server === '') {
        return ['ok' => false, 'error' => 'nick and server are required'];
    }
    if (mb_strlen($nick) > 32 || mb_strlen((string)$server) > 96 || mb_strlen((string)$label) > 128) {
        return ['ok' => false, 'error' => 'Value too long'];
    }

    $db = db();
    $now = now_ts();
    $playerId = upsert_player($db, $nick);
    $serverId = upsert_server($db, $server, (string)$label, $isSpot);

    if ($event === 'join') {
        // Не создаём дубликат, если уже есть активная сессия на том же сервере.
        $exists = $db->prepare("SELECT id FROM sessions WHERE player_id = ? AND server_id = ? AND left_at IS NULL");
        $exists->execute([$playerId, $serverId]);
        if (!$exists->fetch()) {
            $db->prepare("INSERT INTO sessions (player_id, server_id, nick, server_address, joined_at, last_seen) VALUES (?,?,?,?,?,?)")
                ->execute([$playerId, $serverId, $nick, $server, $now, $now]);
        } else {
            return ['ok' => true, 'already' => true];
        }
    } elseif ($event === 'leave') {
        $row = $db->prepare("SELECT id, joined_at FROM sessions WHERE player_id = ? AND server_id = ? AND left_at IS NULL ORDER BY joined_at DESC LIMIT 1");
        $row->execute([$playerId, $serverId]);
        $s = $row->fetch();
        if ($s) {
            $dur = max(0, $now - (int)$s['joined_at']);
            $db->prepare("UPDATE sessions SET left_at = ?, duration_seconds = ? WHERE id = ?")
                ->execute([$now, $dur, (int)$s['id']]);
            recompute_player_totals($db);
            recompute_server_totals($db);
        } else {
            // leave без join — игнорируем либо фиксируем нулевую сессию.
            return ['ok' => true];
        }
    } elseif ($event === 'heartbeat') {
        // Продлеваем живучесть: last_seen у игрока и у активной сессии.
        $db->prepare("UPDATE players SET last_seen = ? WHERE id = ?")->execute([$now, $playerId]);
        $db->prepare("UPDATE sessions SET last_seen = ? WHERE player_id = ? AND server_id = ? AND left_at IS NULL")
            ->execute([$now, $playerId, $serverId]);
    }

    return ['ok' => true];
}

/**
 * Публичная сводная статистика для дашборда.
 */
function get_dashboard_data(): array {
    $db = db();
    close_stale_sessions($db);

    $playersTotal = (int)$db->query("SELECT COUNT(*) FROM players")->fetchColumn();
    $playersOnline = count_online($db);
    $serversTotal = (int)$db->query("SELECT COUNT(*) FROM servers")->fetchColumn();
    $totalSeconds = (int)$db->query("SELECT COALESCE(SUM(duration_seconds),0) FROM sessions")->fetchColumn();
    $totalSessions = (int)$db->query("SELECT COUNT(*) FROM sessions")->fetchColumn();

    // По игрокам: топ по времени (со счётчиком сессий).
    $players = $db->query(
        "SELECT p.nick, p.total_seconds, p.first_seen, p.last_seen,
                (SELECT COUNT(*) FROM sessions s WHERE s.player_id = p.id) AS sessions_count
         FROM players p ORDER BY p.total_seconds DESC LIMIT 50"
    )->fetchAll();

    // Кто сейчас онлайн (активные сессии).
    $onlinePlayers = online_players($db);

    // По серверам: часы, сессии, принадлежность.
    $servers = $db->query(
        "SELECT address, label, is_spot, sessions_count, total_seconds FROM servers ORDER BY total_seconds DESC"
    )->fetchAll();

    // Топ серверов (для круговой диаграммы) — по игровым часам.
    $serverPie = array_map(fn($s) => [
        'label' => $s['label'],
        'seconds' => (int)$s['total_seconds'],
    ], $servers);

    // Часовая активность за последние 7 дней (для линейного графика).
    $activity = daily_activity($db, 7);

    // Новые игроки по дням (для графика роста).
    $growth = players_growth($db, 7);

    // Для нашего Spot-сервера — расширенная статистика.
    $spotServer = null;
    foreach ($servers as $s) {
        if ((int)$s['is_spot'] === 1) {
            $spotServer = $s;
            break;
        }
    }

    return [
        'generated_at' => now_ts(),
        'totals' => [
            'players' => $playersTotal,
            'online' => $playersOnline,
            'servers' => $serversTotal,
            'total_seconds' => $totalSeconds,
            'total_hours' => round($totalSeconds / 3600, 1),
            'sessions' => $totalSessions,
        ],
        'top_players' => $players,
        'online_players' => $onlinePlayers,
        'servers' => $servers,
        'server_pie' => $serverPie,
        'daily_activity' => $activity,
        'players_growth' => $growth,
        'spot' => $spotServer,
    ];
}

/** Число игроков онлайн = число незакрытых (за последние 10 минут живучести) сессий по уникальным игрокам. */
function count_online(PDO $db): int {
    $cutoff = now_ts() - 600;
    $stmt = $db->prepare("SELECT COUNT(DISTINCT player_id) FROM sessions WHERE left_at IS NULL AND COALESCE(last_seen, joined_at) >= ?");
    $stmt->execute([$cutoff]);
    return (int)$stmt->fetchColumn();
}

/** Список игроков онлайн: ник, сервер, время присоединения (по уникальным игрокам). */
function online_players(PDO $db): array {
    $cutoff = now_ts() - 600;
    $stmt = $db->prepare(
        "SELECT s.nick, s.server_address, COALESCE(sv.label, s.server_address) AS server_label, s.joined_at
         FROM sessions s LEFT JOIN servers sv ON sv.id = s.server_id
         WHERE s.left_at IS NULL AND COALESCE(s.last_seen, s.joined_at) >= ?
         ORDER BY COALESCE(s.last_seen, s.joined_at) DESC"
    );
    $stmt->execute([$cutoff]);
    $rows = $stmt->fetchAll();

    // У игрока может быть несколько активных сессий (на разных серверах) —
    // оставляем самую свежую.
    $seen = [];
    $out = [];
    foreach ($rows as $r) {
        $nick = (string)$r['nick'];
        if (isset($seen[$nick])) continue;
        $seen[$nick] = true;
        $out[] = [
            'nick' => $nick,
            'server' => (string)$r['server_address'],
            'server_label' => (string)$r['server_label'],
            'joined_at' => (int)$r['joined_at'],
        ];
    }
    return $out;
}

/** Активность по дням: суммарные секунды за последние $days дней (по дате начала сессии). */
function daily_activity(PDO $db, int $days): array {
    $out = [];
    $today = strtotime('today');
    for ($i = $days - 1; $i >= 0; $i--) {
        $start = $today - $i * 86400;
        $end = $start + 86400;
        $stmt = $db->prepare(
            "SELECT COALESCE(SUM(
                CASE WHEN left_at IS NULL THEN ? - joined_at
                     ELSE COALESCE(duration_seconds, 0)
                END
            ),0) FROM sessions WHERE joined_at >= ? AND joined_at < ?"
        );
        $stmt->execute([now_ts(), $start, $end]);
        $sec = (int)$stmt->fetchColumn();
        $out[] = [
            'date' => date('d.m', $start),
            'seconds' => $sec,
            'hours' => round($sec / 3600, 1),
        ];
    }
    return $out;
}

/** Рост: число новых игроков по дням за последние $days дней (по дате первой встречи). */
function players_growth(PDO $db, int $days): array {
    $out = [];
    $today = strtotime('today');
    for ($i = $days - 1; $i >= 0; $i--) {
        $start = $today - $i * 86400;
        $end = $start + 86400;
        $stmt = $db->prepare("SELECT COUNT(*) FROM players WHERE first_seen >= ? AND first_seen < ?");
        $stmt->execute([$start, $end]);
        $out[] = [
            'date' => date('d.m', $start),
            'count' => (int)$stmt->fetchColumn(),
        ];
    }
    return $out;
}

/** Получить подробную статистику по конкретному игроку (админ-панель). */
function get_player_detail(string $nick): ?array {
    $db = db();
    $stmt = $db->prepare("SELECT id FROM players WHERE nick = ?");
    $stmt->execute([$nick]);
    $pid = $stmt->fetchColumn();
    if (!$pid) return null;
    $sessions = $db->prepare(
        "SELECT s.id, s.server_address, s.joined_at, s.left_at, s.duration_seconds, sv.label as server_label
         FROM sessions s LEFT JOIN servers sv ON sv.id = s.server_id
         WHERE s.player_id = ? ORDER BY s.joined_at DESC LIMIT 100"
    );
    $sessions->execute([(int)$pid]);
    $sessionsList = $sessions->fetchAll();
    $player = $db->prepare("SELECT nick, first_seen, last_seen, total_seconds FROM players WHERE id = ?");
    $player->execute([(int)$pid]);
    $p = $player->fetch();
    return [
        'nick' => $p['nick'],
        'first_seen' => (int)$p['first_seen'],
        'last_seen' => (int)$p['last_seen'],
        'total_seconds' => (int)$p['total_seconds'],
        'total_hours' => round((int)$p['total_seconds'] / 3600, 1),
        'sessions_count' => count($sessionsList),
        'sessions' => $sessionsList,
    ];
}
