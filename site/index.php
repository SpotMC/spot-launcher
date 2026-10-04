<?php
declare(strict_types=1);
require_once __DIR__ . '/inc/config.php';
require_once __DIR__ . '/inc/security.php';
start_secure_session();
$isAdmin = is_admin();
?>
<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Статистика — Spot Launcher</title>
<link rel="stylesheet" href="<?php echo SITE_BASE; ?>/assets/css/style.css">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
</head>
<body class="<?php echo !empty($_GET['embed']) ? 'embed' : ''; ?>">
<header class="topbar">
  <div class="brand">
    <span class="logo">S</span>
    <div>
      <div class="brand-name">Spot Launcher</div>
      <div class="brand-sub">Статистика игры</div>
    </div>
  </div>
  <nav>
    <?php if ($isAdmin): ?>
      <a href="<?php echo SITE_BASE; ?>/admin/" class="btn small">Панель админа</a>
      <a href="<?php echo SITE_BASE; ?>/logout.php" class="btn ghost small">Выйти</a>
    <?php else: ?>
      <a href="<?php echo SITE_BASE; ?>/login.php" class="btn small">Вход</a>
    <?php endif; ?>
  </nav>
</header>

<main class="wrap">
  <section class="cards" id="totals">
    <div class="card"><div class="label">Игроков всего</div><div class="num" data-num="players">—</div></div>
    <div class="card"><div class="label">Сейчас онлайн</div><div class="num accent" data-num="online">—</div><div class="sub" data-num="online-sub">—</div></div>
    <div class="card"><div class="label">Серверов</div><div class="num" data-num="servers">—</div></div>
    <div class="card"><div class="label">Сыграно часов</div><div class="num" data-num="hours">—</div></div>
    <div class="card"><div class="label">Сессий</div><div class="num" data-num="sessions">—</div></div>
  </section>

  <section class="panel" id="onlinePanel" style="display:none">
    <div class="panel-head"><h3>Сейчас онлайн</h3><span class="chip" id="onlineCount">0</span></div>
    <div class="online-list" id="onlineList"></div>
  </section>

  <section class="grid charts">
    <div class="panel">
      <h3>Игровое время по серверам</h3>
      <div class="chart-box" id="pieBox">
        <canvas id="pieChart"></canvas>
        <div class="chart-center"><b id="pieTotal">—</b><span>часов всего</span></div>
      </div>
    </div>
    <div class="panel">
      <h3>Активность за 7 дней (часов)</h3>
      <div class="chart-box"><canvas id="barChart"></canvas></div>
    </div>
    <div class="panel">
      <h3>Новые игроки за 7 дней</h3>
      <div class="chart-box"><canvas id="growthChart"></canvas></div>
    </div>
  </section>

  <section class="panel">
    <div class="panel-head"><h3>Топ игроков по времени</h3><span class="badge">за всё время</span></div>
    <table class="table" id="topPlayers">
      <thead><tr><th>#</th><th>Игрок</th><th>Время</th><th>Сессий</th><th>Последнее посещение</th></tr></thead>
      <tbody></tbody>
    </table>
  </section>

  <section class="panel">
    <h3>Серверы</h3>
    <div class="server-list" id="serverList"></div>
  </section>
</main>

<footer class="footer">Spot Launcher © <?php echo date('Y'); ?> · <a href="<?php echo SITE_BASE; ?>/docs.php">Пользовательское соглашение</a> · <a href="<?php echo SITE_BASE; ?>/docs.php?doc=privacy">Обработка персональных данных</a></footer>

<script>
var API = '<?php echo SITE_BASE; ?>/api/stats.php';
var base = '<?php echo SITE_BASE; ?>';

async function refresh() {
  var res = await fetch(API, { cache: 'no-store' });
  var j = await res.json();
  var d = j.data;
  var t = d.totals;

  document.querySelector('[data-num="players"]').textContent = t.players;
  document.querySelector('[data-num="online"]').textContent = t.online;
  var onlineSub = document.querySelector('[data-num="online-sub"]');
  if (onlineSub) onlineSub.textContent = 'обновлено ' + new Date().toLocaleTimeString('ru-RU');
  document.querySelector('[data-num="servers"]').textContent = t.servers;
  document.querySelector('[data-num="hours"]').textContent = t.total_hours;
  document.querySelector('[data-num="sessions"]').textContent = t.sessions;

  renderTopPlayers(d.top_players);
  renderOnline(d.online_players);
  renderServers(d.servers, d.spot);
  renderPie(d.server_pie);
  renderBar(d.daily_activity);
  renderGrowth(d.players_growth);
}

function renderOnline(players) {
  var lst = players || [];
  var panel = document.getElementById('onlinePanel');
  var list = document.getElementById('onlineList');
  if (!lst.length) {
    if (panel) panel.style.display = 'none';
    list.innerHTML = '';
    return;
  }
  panel.style.display = '';
  document.getElementById('onlineCount').textContent = lst.length + ' · ' + (lst.length === 1 ? 'игрок' : 'игроков');
  list.innerHTML = '';
  lst.forEach(function (p) {
    var nick = p.nick || '?';
    var hue = (nick.charCodeAt(0) || 0) * 47 % 360;
    var el = document.createElement('div');
    el.className = 'online-item';
    el.innerHTML =
      '<span class="online-dot"></span>' +
      '<span class="online-avatar" style="background:hsl(' + hue + ',60%,46%)">' + esc(nick.slice(0, 1).toUpperCase()) + '</span>' +
      '<span class="online-nick">' + esc(nick) + '</span>' +
      '<span class="online-srv">' + esc(p.server_label || p.server || '') + '</span>' +
      '<span class="online-since">' + dmyTime(p.joined_at) + '</span>';
    list.appendChild(el);
  });
}

function renderTopPlayers(players) {
  var tb = document.querySelector('#topPlayers tbody');
  tb.innerHTML = '';
  var top = (players || []).slice(0, 20);
  var max = 1;
  top.forEach(function (p) { if ((p.total_seconds || 0) > max) max = p.total_seconds; });
  top.forEach(function (p, i) {
    var rank = i + 1;
    var nick = p.nick || '?';
    var hue = (nick.charCodeAt(0) || 0) * 47 % 360;
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td><span class="rank r' + (rank <= 3 ? rank : '') + '">' + rank + '</span></td>' +
      '<td><span class="player-cell"><span class="p-av" style="background:hsl(' + hue + ',60%,46%)">' + esc(nick.slice(0, 1).toUpperCase()) + '</span><span class="player-chip">' + esc(nick) + '</span></span></td>' +
      '<td><div class="tbar"><i style="width:' + Math.round((p.total_seconds || 0) / max * 100) + '%"></i></div><span class="cell-sub">' + fmtDur(p.total_seconds) + '</span></td>' +
      '<td class="muted-cell">' + (p.sessions_count || 0) + '</td>' +
      '<td class="muted-cell">' + dmy(p.last_seen) + '</td>';
    tb.appendChild(tr);
  });
  if (!top.length) tb.innerHTML = '<tr><td colspan="5" class="empty-row">Пока нет данных</td></tr>';
}

function renderServers(servers, spot) {
  var list = document.querySelector('#serverList');
  list.innerHTML = '';
  var srv = servers || [];
  var max = 1;
  srv.forEach(function (s) { if ((s.total_seconds || 0) > max) max = s.total_seconds; });
  srv.forEach(function (s) {
    var isSpot = s.is_spot == 1;
    var el = document.createElement('div');
    el.className = 'server-item' + (isSpot ? ' spot' : '');
    el.innerHTML =
      '<div class="srv-info">' +
        '<div class="srv-name">' + (isSpot ? '★ ' : '') + esc(s.label) + '</div>' +
        '<div class="srv-addr">' + esc(s.address) + (isSpot ? ' · наш сервер' : '') + '</div>' +
      '</div>' +
      '<div class="srv-bars">' +
        '<div class="srv-bar"><span class="lbl"><span>Игровое время</span><span>' + fmtDur(s.total_seconds) + '</span></span><div class="tbar"><i style="width:' + Math.round((s.total_seconds || 0) / max * 100) + '%"></i></div></div>' +
        '<div class="srv-bar"><span class="lbl"><span>Сессии</span><span>' + (s.sessions_count || 0) + '</span></span><div class="tbar tbar2"><i style="width:' + Math.min(100, Math.round((s.sessions_count || 0) / 2)) + '%"></i></div></div>' +
      '</div>';
    list.appendChild(el);
  });
  if (!srv.length) list.innerHTML = '<div class="muted">Пока нет данных</div>';
}

function renderPie(data) {
  var vals = data ? (data.length ? data : []) : [];
  var el = document.getElementById('pieChart');
  if (window.__pie) window.__pie.destroy();
  var totalH = 0;
  vals.forEach(function (v) { totalH += (v.seconds || 0) / 3600; });
  var center = document.getElementById('pieTotal');
  if (center) center.textContent = Math.round(totalH).toLocaleString('ru-RU');
  if (!vals.length) { center.textContent = '—'; return; }
  window.__pie = new Chart(el, {
    type: 'doughnut',
    data: {
      labels: vals.map(function (v) { return v.label; }),
      datasets: [{
        data: vals.map(function (v) { return Math.round(v.seconds / 3600); }),
        backgroundColor: ['#5a6ff2', '#8d9ff5', '#b9c4fa', '#f97316', '#4caf50', '#e91e63', '#ffc107', '#78909c'],
        borderWidth: 2, borderColor: '#0d0e13', hoverOffset: 6, cutout: '72%'
      }]
    },
    options: { plugins: { legend: { position: 'bottom', labels: { color: '#c8ccd8', boxWidth: 12, padding: 14 } } }, maintainAspectRatio: false }
  });
}

function renderBar(activity) {
  var act = activity ? (activity.length ? activity : []) : [];
  if (!act.length) return;
  var el = document.getElementById('barChart');
  if (window.__bar) window.__bar.destroy();
  window.__bar = new Chart(el, {
    type: 'bar',
    data: {
      labels: act.map(function (a) { return a.date; }),
      datasets: [{
        label: 'Часов',
        data: act.map(function (a) { return a.hours; }),
        backgroundColor: '#8d9ff5', borderRadius: 6
      }]
    },
    options: { plugins: { legend: { display: false } }, maintainAspectRatio: false,
      scales: { x: { ticks: { color: '#c8ccd8' }, grid: { color: '#1c1e27' } }, y: { ticks: { color: '#c8ccd8' }, grid: { color: '#1c1e27' }, beginAtZero: true } } }
  });
}

function renderGrowth(data) {
  var act = data ? (data.length ? data : []) : [];
  var el = document.getElementById('growthChart');
  if (window.__growth) window.__growth.destroy();
  if (!act.length) return;
  window.__growth = new Chart(el, {
    type: 'line',
    data: {
      labels: act.map(function (a) { return a.date; }),
      datasets: [{
        label: 'Новых игроков',
        data: act.map(function (a) { return a.count; }),
        borderColor: '#34d399', backgroundColor: 'rgba(52,211,153,.14)',
        fill: true, tension: .35, borderWidth: 2,
        pointBackgroundColor: '#34d399', pointBorderColor: '#0d0e13', pointRadius: 3, pointHoverRadius: 5
      }]
    },
    options: { plugins: { legend: { display: false } }, maintainAspectRatio: false,
      scales: { x: { ticks: { color: '#c8ccd8' }, grid: { color: '#1c1e27' } }, y: { ticks: { color: '#c8ccd8', precision: 0 }, grid: { color: '#1c1e27' }, beginAtZero: true } } }
  });
}

function fmtDur(s) { s = s || 0; var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h > 0 ? h + ' ч ' + m + ' мин' : m + ' мин'; }
function dmy(ts) { if (!ts) return '—'; var d = new Date(ts * 1000); return d.toLocaleDateString('ru-RU'); }
function dmyTime(ts) { if (!ts) return '—'; var d = new Date(ts * 1000); return d.toLocaleDateString('ru-RU') + ', ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); }
function esc(x) { var d = document.createElement('div'); d.textContent = x; return d.innerHTML; }

refresh();
setInterval(refresh, 15000);
</script>
