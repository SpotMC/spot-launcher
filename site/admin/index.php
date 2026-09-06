<?php
declare(strict_types=1);
require_once __DIR__ . '/../inc/config.php';
require_once __DIR__ . '/../inc/security.php';
start_secure_session();
require_admin(redirect: true);
$token = csrf_token();
?>
<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Панель управления — Spot Launcher</title>
<link rel="stylesheet" href="/assets/css/style.css">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
</head>
<body class="admin-page">

<div class="admin-shell">
  <!-- Сайдбар -->
  <aside class="sidebar">
    <div class="sidebar-brand">
      <span class="logo">S</span>
      <div class="brand-txt">
        <div class="brand-name">Spot Launcher</div>
        <div class="brand-sub">Панель управления</div>
      </div>
    </div>

    <nav class="side-menu">
      <button class="side-item active" data-view="updates">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v9"/><path d="M12 12l-3.5-3.5"/><path d="M12 12l3.5-3.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>
        <span>Обновления лаунчера</span>
      </button>
      <button class="side-item" data-view="stats">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
        <span>Статистика</span>
      </button>
      <button class="side-item" data-view="players">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <span>Игроки</span>
      </button>
      <button class="side-item" data-view="servers">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
        <span>Серверы</span>
      </button>
      <button class="side-item" data-view="settings">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        <span>Настройки</span>
      </button>
    </nav>

    <div class="sidebar-foot">
      <a class="side-item plain" href="/">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l9-9 9 9"/><path d="M5 10v10"/><path d="M19 10v10"/><path d="M9 21V12h6v9"/></svg>
        <span>На сайт</span>
      </a>
      <a class="side-item plain" href="/logout.php">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
        <span>Выйти</span>
      </a>
    </div>
  </aside>

  <!-- Контент -->
  <main class="admin-main">
    <header class="admin-topbar">
      <div>
        <h1 class="page-title" id="pageTitle">Обновления лаунчера</h1>
        <p class="page-sub">Spot Launcher — администрирование сервиса</p>
      </div>
      <a class="btn ghost small" href="/">Открыть сайт</a>
    </header>

    <!-- Обновления -->
    <section id="view-updates" class="view">
      <div class="card-grid">
        <div class="stat-card">
          <div class="stat-ico stat-accent">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v9"/><path d="M12 12l-3.5-3.5"/><path d="M12 12l3.5-3.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>
          </div>
          <div><div class="stat-num" id="statUpdates">—</div><div class="stat-label">Обновлений загружено</div></div>
        </div>
        <div class="card-zone" id="updatesZone">
          <h3>Загрузка новой версии</h3>
          <p class="muted">Загрузите файлы новой версии: <code>latest.yml</code>, <code>Spot-Launcher-Setup-*.exe</code> и <code>*.blockmap</code>. Лаунчер автоматически найдёт и скачает обновление.</p>
          <input type="hidden" name="csrf" value="<?php echo htmlspecialchars($token); ?>">
          <div class="drop-zone" id="dropZone">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5-5 5 5"/><path d="M12 5v12"/></svg>
            <div class="dz-title">Перетащите файлы сюда или нажмите для выбора</div>
            <div class="dz-sub">Разрешены: <?php echo implode(', ', ALLOWED_EXT); ?></div>
          </div>
          <input type="file" id="fileInput" multiple style="display:none" accept=".yml,.yaml,.exe,.blockmap,.zip,.json">
          <div id="uploadStatus"></div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h3>Журнал обновлений</h3><span class="badge" id="badgeUpdates">0</span></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Файл</th><th>Версия</th><th>Размер</th><th>Дата</th><th>SHA256</th><th></th></tr></thead>
            <tbody id="updatesTable"></tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- Статистика -->
    <section id="view-stats" class="view" style="display:none">
      <div class="stats-actions">
        <button class="btn small" id="statsRefresh">Обновить</button>
        <span class="muted" id="statsUpdated"></span>
      </div>
      <div class="card-grid">
        <div class="stat-card"><div class="stat-num" id="stOnline">—</div><div class="stat-label">Сейчас онлайн</div></div>
        <div class="stat-card"><div class="stat-num" id="stPlayers">—</div><div class="stat-label">Уникальных игроков</div></div>
        <div class="stat-card"><div class="stat-num" id="stSessions">—</div><div class="stat-label">Сессий</div></div>
        <div class="stat-card"><div class="stat-num" id="stHours">—</div><div class="stat-label">Часов игры</div></div>
      </div>
      <div class="chart-grid">
        <div class="panel chart-panel">
          <div class="panel-head"><h3>Активность за 30 дней (часы)</h3></div>
          <div class="chart-box"><canvas id="chartDaily" height="220"></canvas></div>
        </div>
        <div class="panel chart-panel">
          <div class="panel-head"><h3>Время по серверам</h3></div>
          <div class="chart-box chart-sm"><canvas id="chartServers" height="220"></canvas></div>
        </div>
        <div class="panel chart-panel">
          <div class="panel-head"><h3>Топ-10 игроков по времени</h3></div>
          <div class="chart-box"><canvas id="chartPlayers" height="220"></canvas></div>
        </div>
      </div>
    </section>

    <!-- Игроки -->
    <section id="view-players" class="view" style="display:none">
      <div class="panel">
        <div class="panel-head"><h3>Игроки</h3><span class="badge" id="badgePlayers">0</span></div>
        <div class="field search-field">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="playerSearch" placeholder="Поиск по нику...">
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Ник</th><th>Время</th><th>Сессий</th><th>Последний вход</th></tr></thead>
            <tbody id="playersBody"></tbody>
          </table>
        </div>
        <div id="playerDetail"></div>
      </div>
    </section>

    <!-- Серверы -->
    <section id="view-servers" class="view" style="display:none">
      <div class="panel">
        <div class="panel-head"><h3>Серверы</h3></div>
        <p class="muted panel-note">Отметьте наш (Spot) сервер — для него будет показываться расширенная статистика.</p>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Адрес</th><th>Название</th><th>Часов</th><th>Сессий</th><th>Наш</th></tr></thead>
            <tbody id="serversBody"></tbody>
          </table>
        </div>
        <div class="panel-actions"><button class="btn ghost small" id="closeStale">Закрыть зависшие сессии</button></div>
      </div>
    </section>

    <!-- Настройка -->
    <section id="view-settings" class="view" style="display:none">
      <div class="panel">
        <div class="panel-head"><h3>Секреты и доступ</h3></div>
        <ul class="settings-list">
          <li>Пароль администратора: файл <code><?php echo basename(SECRETS_FILE); ?></code> (создаётся через <code>setup.php</code>).</li>
          <li>Секрет событий лаунчера: находится в файле секретов <code>.secrets.php</code>, укажите его в настройках лаунчера.</li>
          <li>Кнопка «Закрыть зависшие сессии» сбрасывает сессии, не завершённые корректно (например, при краше игры).</li>
          <li>Базовая конфигурация: <code>inc/config.php</code>.</li>
        </ul>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Подключение лаунчера</h3></div>
        <p class="muted panel-note">Адрес API событий: <code>/api/events.php</code></p>
      </div>
    </section>
  </main>
</div>

<script>
var BASE = '';
var CSRF = '<?php echo htmlspecialchars($token); ?>';
var TITLES = { updates: 'Обновления лаунчера', stats: 'Статистика', players: 'Игроки', servers: 'Серверы', settings: 'Настройки' };

var fileInput = document.getElementById('fileInput');
var dropZone = document.getElementById('dropZone');
var uploadStatus = document.getElementById('uploadStatus');

dropZone.addEventListener('click', function () { fileInput.click(); });
dropZone.addEventListener('dragover', function (e) { e.preventDefault(); dropZone.classList.add('drag'); });
dropZone.addEventListener('dragleave', function () { dropZone.classList.remove('drag'); });
dropZone.addEventListener('drop', function (e) { e.preventDefault(); dropZone.classList.remove('drag'); upload(e.dataTransfer.files); });
fileInput.addEventListener('change', function () { upload(this.files); fileInput.value = ''; });

async function upload(files) {
  uploadStatus.innerHTML = '';
  for (var i = 0; i < files.length; i++) {
    var fd = new FormData();
    fd.append('csrf', CSRF);
    fd.append('file', files[i]);
    fd.append('notes', '');
    var d = document.createElement('div');
    d.className = 'alert'; d.style.marginTop = '8px';
    d.textContent = 'Загрузка: ' + files[i].name + '...';
    uploadStatus.appendChild(d);
    try {
      var r = await fetch(BASE + '/api/upload.php', { method: 'POST', body: fd });
      var j = await r.json();
      d.textContent = j.ok ? '✓ Загружен: ' + j.file + (j.version ? ' (v' + j.version + ')' : '') : ('✗ ' + files[i].name + ': ' + j.error);
      d.className = 'alert ' + (j.ok ? 'ok' : 'error');
    } catch (e) { d.textContent = '✗ Ошибка сети'; d.className = 'alert error'; }
  }
  loadUpdates();
}

async function api(action, extra) {
  var fd = new FormData();
  fd.append('csrf', CSRF);
  fd.append('action', action);
  if (extra) for (var k in extra) fd.append(k, extra[k]);
  var r = await fetch(BASE + '/api/admin.php', { method: 'POST', body: fd });
  return await r.json();
}

function esc(x) { var d = document.createElement('div'); d.textContent = x; return d.innerHTML; }
function fmtDur(s) { s = s || 0; var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h > 0 ? h + ' ч ' + m + ' мин' : m + ' мин'; }
function dmy(ts) { if (!ts) return '—'; var d = new Date(ts * 1000); return d.toLocaleString('ru-RU'); }
function fmtSize(b) { b = b || 0; if (b >= 1048576) return (b / 1048576).toFixed(b >= 10485760 ? 0 : 1) + ' МБ'; return Math.round(b / 1024) + ' КБ'; }

async function loadUpdates() {
  var j = await api('list-updates');
  var list = j.updates || [];
  document.getElementById('badgeUpdates').textContent = list.length;
  document.getElementById('statUpdates').textContent = list.length;
  var tb = document.querySelector('#updatesTable'); tb.innerHTML = '';
  list.forEach(function (u) {
    var tr = document.createElement('tr');
    tr.innerHTML = '<td><a class="file-link" href="' + esc(u.url) + '" target="_blank">' + esc(u.filename) + '</a></td>' +
      '<td>' + (u.version ? '<span class="chip">v' + esc(u.version) + '</span>' : '—') + '</td>' +
      '<td>' + fmtSize(u.size) + '</td>' +
      '<td class="muted-cell">' + dmy(u.uploaded_at) + '</td>' +
      '<td class="hash-cell">' + esc(u.sha256 || '') + '</td>' +
      '<td class="row-actions"><button class="btn danger small" data-del="' + u.id + '">Удалить</button></td>';
    tb.appendChild(tr);
  });
  tb.querySelectorAll('[data-del]').forEach(function (b) {
    b.addEventListener('click', async function () {
      if (!confirm('Удалить файл обновления?')) return;
      await api('delete-update', { id: b.getAttribute('data-del') });
      loadUpdates();
    });
  });
}

var searchTimer = null;
document.getElementById('playerSearch').addEventListener('input', function (e) {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(function () { loadPlayers(e.target.value); }, 300);
});

async function loadPlayers(q) {
  var j = await api('list-players', { q: q || '' });
  var list = j.players || [];
  document.getElementById('badgePlayers').textContent = list.length;
  var tb = document.querySelector('#playersBody'); tb.innerHTML = '';
  if (!list.length) { tb.innerHTML = '<tr><td colspan="4" class="empty-row">Игроки не найдены</td></tr>'; return; }
  list.forEach(function (p) {
    var tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.innerHTML = '<td><span class="player-chip">' + esc(p.nick) + '</span></td><td>' + fmtDur(p.total_seconds) + '</td><td>' + p.sessions_count + '</td><td class="muted-cell">' + dmy(p.last_seen) + '</td>';
    tr.addEventListener('click', function () { showPlayer(p.nick); });
    tb.appendChild(tr);
  });
}

async function showPlayer(nick) {
  var j = await api('player-detail', { nick: nick });
  var el = document.getElementById('playerDetail');
  if (!j.ok) { el.innerHTML = '<div class="alert error">' + esc(j.error) + '</div>'; return; }
  var d = j.detail;
  var rows = (d.sessions || []).map(function (s) {
    return '<tr><td>' + esc(s.server_label) + '</td><td>' + esc(s.joined_at) + '</td><td>' + esc(s.left_at) + '</td><td>' + esc(s.duration) + '</td></tr>';
  }).join('');
  el.innerHTML = '<div class="panel mt detail-panel"><div class="panel-head"><h3>' + esc(d.nick) + '</h3><span class="badge">' + d.sessions_count + ' сес.</span></div>' +
    '<p class="muted">Всего: <b>' + fmtDur(d.total_seconds) + '</b> · Первый вход: ' + dmy(d.first_seen) + ' · Последний: ' + dmy(d.last_seen) + '</p>' +
    '<div class="table-wrap mt"><table class="table"><thead><tr><th>Сервер</th><th>Вход</th><th>Выход</th><th>Длительность</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
}

async function loadServers() {
  var j = await api('list-servers');
  var tb = document.querySelector('#serversBody'); tb.innerHTML = '';
  (j.servers || []).forEach(function (s) {
    var tr = document.createElement('tr');
    tr.innerHTML = '<td><span class="srv-addr">' + esc(s.address) + '</span></td><td>' + esc(s.label) + '</td><td>' + fmtDur(s.total_seconds) + '</td><td>' + s.sessions_count + '</td>' +
      '<td><label class="switch"><input type="checkbox" data-srv="' + esc(s.address) + '" ' + (s.is_spot == 1 ? 'checked' : '') + '><span class="slider"></span></label></td>';
    tb.appendChild(tr);
  });
  tb.querySelectorAll('[data-srv]').forEach(function (c) {
    c.addEventListener('change', function () { api('toggle-spot', { server: c.getAttribute('data-srv'), is_spot: c.checked ? 1 : 0 }); });
  });
}

document.getElementById('closeStale').addEventListener('click', async function () {
  var j = await api('close-stale');
  if (j.ok) loadServers();
});

document.querySelectorAll('.side-item[data-view]').forEach(function (b) {
  b.addEventListener('click', function () {
    document.querySelectorAll('.side-item[data-view]').forEach(function (x) { x.classList.remove('active'); });
    b.classList.add('active');
    var v = b.getAttribute('data-view');
    document.querySelectorAll('.view').forEach(function (x) { x.style.display = 'none'; });
    var vv = document.getElementById('view-' + v);
    if (vv) vv.style.display = 'block';
    var pt = document.getElementById('pageTitle');
    if (pt) pt.textContent = TITLES[v] || v;
    if (v === 'updates') loadUpdates();
    if (v === 'players') loadPlayers('');
    if (v === 'servers') loadServers();
  });
});

loadUpdates();
</script>
</body>
</html>
