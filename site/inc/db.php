<?php
/**
 * Инициализация SQLite-базы данных (PDO) и схемы.
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

/** Единственный объект PDO (синглтон). */
function db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;

    if (!is_dir(DATA_DIR)) {
        @mkdir(DATA_DIR, 0750, true);
    }

    $pdo = new PDO('sqlite:' . DB_FILE);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('PRAGMA foreign_keys = ON');
    $pdo->exec('PRAGMA busy_timeout = 5000');

    init_schema($pdo);
    return $pdo;
}

/** Создаёт таблицы, если их нет. */
function init_schema(PDO $pdo): void {
    $pdo->exec(<<<SQL
CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nick TEXT NOT NULL UNIQUE,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    total_seconds INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT NOT NULL UNIQUE,         -- например 185.9.145.192:30716
    label TEXT NOT NULL,
    is_spot INTEGER NOT NULL DEFAULT 0,   -- 1, если это наш (Spot) сервер
    sessions_count INTEGER NOT NULL DEFAULT 0,
    total_seconds INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    nick TEXT NOT NULL,
    server_address TEXT NOT NULL,
    joined_at INTEGER NOT NULL,
    left_at INTEGER,
    duration_seconds INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sessions_player ON sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_sessions_server ON sessions(server_id);
CREATE INDEX IF NOT EXISTS idx_sessions_joined ON sessions(joined_at);
CREATE TABLE IF NOT EXISTS updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    version TEXT,
    size INTEGER NOT NULL DEFAULT 0,
    sha256 TEXT,
    uploaded_at INTEGER NOT NULL,
    notes TEXT
);
CREATE TABLE IF NOT EXISTS rate_limiting (
    action TEXT NOT NULL,
    ip TEXT NOT NULL,
    window_start INTEGER NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (action, ip, window_start)
);
CREATE TABLE IF NOT EXISTS launcher_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nick TEXT NOT NULL,
    event TEXT NOT NULL,               -- launcher_start / launcher_quit
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_launcher_log_created ON launcher_log(created_at);
SQL);
}
