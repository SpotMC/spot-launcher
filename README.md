# Spot Launcher

Electron-лаунчер Minecraft для Windows, macOS и Linux.

## Установка

### Windows

Скачайте `Spot-Launcher-Setup-<версия>.exe` и запустите. Установщик ставит лаунчер и Java 21 LTS (Adoptium) автоматически.

### macOS

Скачайте `Spot-Launcher-<версия>-mac-<архитектура>.zip` или `.dmg`.

Приложение **не подписано Apple Developer ID**, поэтому macOS заблокирует первый запуск. Снимите карантин одной командой в Терминале:

```bash
xattr -cr "/Applications/Spot Launcher.app"
```

После этого запустите лаунчер обычным двойным кликом. Команда нужна один раз.

Если macOS всё равно не открывает приложение, откройте «Системные настройки → Конфиденциальность и безопасность» и нажмите «Открыть в любом случае».

Java 21 устанавливается автоматически при первом запуске — отдельно ставить не нужно.

### Linux

Скачайте `.AppImage`, `.deb`, `.rpm` или `.tar.xz`. В зависимостях для `.deb`: `libnotify4`, `libsecret-1-0`, `libappindicator3-1`, `libxss1`.

## Сборка

```bash
pnpm install
pnpm run build          # проверка типов + сборка renderer и electron
pnpm run package:win    # Windows: NSIS + zip
pnpm run package:linux  # Linux: AppImage, deb, rpm, tar.xz, pacman
pnpm run package:mac    # macOS: dmg + zip
```

**Сборка macOS возможна только на macOS.** electron-builder не умеет собирать `.dmg` на Windows и Linux — попытка завершится ошибкой `Build for macOS is supported only on macOS`.

Для сборки под macOS используйте GitHub Actions: в `.github/workflows/release.yml` есть джоб на `macos-latest`, который запускается по тегу `v*` и собирает `dmg` и `zip`:

```bash
git tag v4.0.0
git push origin v4.0.0
```

Артефакты соберутся для Windows, macOS и Linux параллельно.

## Обновления

Лаунчер сам проверяет обновления и скачивает их в фоне. Канал выбирается в настройках: `Stable` для всех или `Beta` для ранних сборок.

Обновления публикуются в `https://admin.nexus-manage.ru/updates` (stable) и `/updates-beta` (beta). Для macOS electron-updater ожидает `latest-mac.yml` и `*-mac-*.zip`.

## Требования

- Java 21 LTS — ставится автоматически
- Windows 10+, macOS 11+, Linux с glibc 2.31+

## Лицензия

Проприетарная. Copyright © SpotMC.