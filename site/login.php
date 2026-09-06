<?php
declare(strict_types=1);
require_once __DIR__ . '/inc/config.php';
require_once __DIR__ . '/inc/security.php';
start_secure_session();

if (is_admin()) {
    header('Location: /admin/');
    exit;
}

$token = csrf_token();
$error = '';
// Показываем ошибку, если передан параметр (не храним в сессии).
if (isset($_GET['e']) && $_GET['e'] == 1) $error = 'Неверный логин или пароль';
?>
<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Авторизация</title>
<link rel="stylesheet" href="/assets/css/style.css">
</head>
<body>
<header class="topbar">
  <div class="brand">
    <span class="logo">S</span>
    <div>
      <div class="brand-name">Система управления</div>
      <div class="brand-sub">Вход для администратора</div>
    </div>
  </div>
</header>

<main>
  <div class="auth-card">
    <h1>Авторизация</h1>
    <?php if ($error): ?><div class="alert error"><?php echo htmlspecialchars($error); ?></div><?php endif; ?>
    <form id="loginForm">
      <input type="hidden" name="csrf" value="<?php echo htmlspecialchars($token); ?>">
      <div class="field">
        <label>Логин</label>
        <input type="text" name="username" autocomplete="username" required autofocus>
      </div>
      <div class="field">
        <label>Пароль</label>
        <input type="password" name="password" autocomplete="current-password" required>
      </div>
      <button type="submit" class="btn block">Войти</button>
      <p class="muted mt" style="text-align:center;font-size:13px;margin-top:14px">Доступ только для администратора сервера.</p>
    </form>
  </div>
</main>

<script>
document.getElementById('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  var btn = this.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Проверка...';
  var fd = new FormData(this);
  try {
    var r = await fetch('/api/login.php', { method: 'POST', body: fd });
    var j = await r.json();
    if (j.ok) { location.href = j.redirect || '/admin/'; }
    else { showErr(j.error || 'Ошибка входа'); btn.disabled = false; btn.textContent = 'Войти'; }
  } catch (err) { showErr('Сетевая ошибка'); btn.disabled = false; btn.textContent = 'Войти'; }
});
function showErr(m) {
  var old = document.querySelector('.alert');
  if (old) old.remove();
  var d = document.createElement('div'); d.className = 'alert error'; d.textContent = m;
  document.querySelector('.auth-card h1').after(d);
}
</script>
</body>
</html>
