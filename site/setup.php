<?php
/**
 * Одноразовый скрипт настройки: создаёт хэш пароля администратора и HMAC-секрет
 * для приёма событий от лаунчера. Запускается из браузера один раз, затем
 * ДЕЛЕЙТЕ ЭТОТ ФАЙЛ с сервера (или как минимум защитите доступ).
 *
 * Пример вызова:  https://site/setup.php?action=hash&password=СВОЙ_ПАРОЛЬ
 *                  https://site/setup.php?action=gen-secret
 *                  https://site/setup.php?action=status
 * ВАЖНО: указывайте пароль только так, чтобы никто его не увидел в логах,
 * либо введите пароль в форме внизу этой страницы.
 */

declare(strict_types=1);

require_once __DIR__ . '/inc/config.php';
require_once __DIR__ . '/inc/db.php';

if (!is_dir(DATA_DIR)) @mkdir(DATA_DIR, 0750, true);

$secretsFile = SECRETS_FILE;
$lockFile = DATA_DIR . '/.setup-lock';

function read_secrets_array(): array {
    return is_file(SECRETS_FILE) ? (require SECRETS_FILE) : [];
}

function write_secrets(array $secrets): void {
    $content = "<?php\n// Секреты. Файл НЕ должен быть доступен извне (защищён .htaccess).\nreturn " . var_export($secrets, true) . ";\n";
    if (@file_put_contents(SECRETS_FILE, $content) === false) {
        http_response_code(500);
        exit('Не удалось записать секреты. Проверьте права на папку data/.');
    }
    // Максимально ограничиваем права файла.
    @chmod(SECRETS_FILE, 0600);
}

$secrets = read_secrets_array();
$action = $_GET['action'] ?? ($_POST['action'] ?? 'status');
$msg = '';

if ($action === 'hash' && isset($_POST['password']) && $_POST['password'] !== '') {
    // Первый раз — блокируем повторное переопределение пароля, если он уже задан.
    if (!empty($secrets['passwordHash'])) {
        $msg = 'Пароль уже задан. Для смены пароля отредактируйте файл .secrets.php или удалите его и повторите настройку.';
    } else {
        $secrets['passwordHash'] = password_hash($_POST['password'], PASSWORD_BCRYPT, ['cost' => 12]);
        write_secrets($secrets);
        $msg = 'Пароль администратора создан.';
    }
} elseif ($action === 'gen-secret') {
    // Перегенерировать событийный секрет (приведёт к необходимости обновить его в лаунчере).
    $secrets['eventSecret'] = bin2hex(random_bytes(32));
    $section = bin2hex(random_bytes(16)); // доп. соль для событий
    $secrets['eventSecretId'] = $section;
    write_secrets($secrets);
    $msg = 'Новый секрет для событий лаунчера сгенерирован.';
} elseif ($action === 'status') {
    $msg = 'Статус: '
        . (!empty($secrets['passwordHash']) ? 'пароль установлен; ' : 'пароль НЕ установлен; ')
        . (!empty($secrets['eventSecret']) ? 'секрет событий установлен.' : 'секрет событий НЕ установлен.');
}

$secrets = read_secrets_array();
$eventSecret = $secrets['eventSecret'] ?? '';
?>
<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Настройка — Spot Stats</title>
<style>
  body{font-family:system-ui,Arial,sans-serif;background:#0d0d10;color:#e5e7eb;max-width:640px;margin:40px auto;padding:0 16px}
  h1{color:#8d9ff5} pre{background:#16171c;padding:12px;border-radius:8px;overflow:auto}
  input[type=password]{width:100%;padding:10px;border:1px solid #3a3b45;border-radius:8px;background:#16171c;color:#fff;margin:6px 0}
  button{padding:10px 18px;border:0;border-radius:8px;background:#5a6ff2;color:#fff;cursor:pointer}
  .msg{background:#1a2a1a;border:1px solid #2e5a2e;padding:10px;border-radius:8px;color:#9fe29f;margin:12px 0}
  .btn{display:inline-block;margin:6px 4px 0 0}
</style>
</head>
<body>
<h1>Настройка сайта статистики</h1>
<div class="msg"><?php echo htmlspecialchars($msg); ?></div>

<?php if (empty($secrets['passwordHash'])): ?>
<h2>1. Задать пароль администратора</h2>
<form method="post" action="setup.php?action=hash">
  <input type="password" name="password" autocomplete="new-password" required placeholder="Надёжный пароль (мин. 12 символов)">
  <button type="submit">Создать пароль</button>
</form>
<?php else: ?>
<p>Пароль администратора уже создан. Для смены удалите файл <code><?php echo htmlspecialchars(SECRETS_FILE); ?></code> и повторите настройку.</p>
<?php endif; ?>

<h2>2. HMAC-секрет для событий лаунчера</h2>
<p>Этот секрет нужно указать в настройках лаунчера (в config), чтобы сервер принимал от него статистику. Не передавайте его третьим лицам.</p>
<?php if ($eventSecret !== ''): ?>
<pre><?php echo htmlspecialchars($eventSecret); ?></pre>
<p>
  <a class="btn" href="setup.php?action=gen-secret" onclick="return confirm('Перегенерировать секрет? Старый перестанет работать.');">Перегенерировать</a>
</p>
<?php else: ?>
<p><a class="btn" href="setup.php?action=gen-secret">Сгенерировать секрет</a></p>
<?php endif; ?>

<h2>Меры безопасности</h2>
<ol>
  <li>Удалите этот файл <code>setup.php</code> с сервера после настройки.</li>
  <li>Убедитесь, что папка <code>data/</code> закрыта от прямого доступа (файл <code>data/.htaccess</code> уже прилагается).</li>
  <li>Включите HTTPS на хостинге; сайт принудительно отдаёт заголовки безопасности.</li>
  <li>Регулярно обновляйте пароль администратора.</li>
</ol>
</body>
</html>
