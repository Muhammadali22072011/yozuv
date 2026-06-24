# Yozuv — мобильное приложение (APK / iOS)

Нативная обёртка на **Capacitor**. Приложение — тонкий нативный шелл,
который грузит задеплоенный веб-фронт Yozuv (тот же URL, что и Telegram
Mini App). Вход — по логину/паролю (или Telegram), backend не меняется.

Всё живёт в `frontend/`:

- `capacitor.config.ts` — конфиг, читает `CAP_SERVER_URL`
- `mobile-shell/` — заставка, пока грузится сайт
- `android/` — нативный Android-проект (Gradle)

---

## 1. Указать URL фронта (обязательно)

APK должен знать, какой сайт грузить. Это публичный HTTPS-адрес фронта
(тот же, что у Mini App). Задаётся переменной `CAP_SERVER_URL`.

Без неё APK соберётся, но покажет только заставку.

---

## 2. Создать APK — облако (рекомендую, без установок)

Локально Android Studio не нужен. Собирает GitHub Actions.

1. В репозитории: **Settings → Secrets and variables → Actions → Variables**
   → New variable: `CAP_SERVER_URL` = `https://<домен-фронта>`
2. Вкладка **Actions → Build Android APK → Run workflow** (ветка `main`).
3. По завершении: внизу страницы запуска → **Artifacts → `yozuv-debug-apk`**.
   Скачать, распаковать → `app-debug.apk`.
4. Кинуть `.apk` на телефон (Telegram «Saved Messages», файл, USB) →
   открыть → разрешить установку из неизвестных источников → готово.

Это **debug-APK** — ставится и работает, годится для теста и раздачи.
Для Google Play нужен подписанный **release**-APK/AAB (см. §4).

---

## 3. Создать APK — локально (если поставишь Android Studio)

Нужно: Android Studio + JDK 17.

```bash
cd frontend
export CAP_SERVER_URL=https://<домен-фронта>   # Windows: $env:CAP_SERVER_URL="..."
npx cap sync android
npx cap open android        # откроет Android Studio → Build → Build APK(s)
```

Или из консоли без открытия студии:

```bash
cd frontend/android
./gradlew assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk
```

---

## 4. Release (для Google Play) — позже

1. Сгенерировать keystore (`keytool`), хранить как secret.
2. Подписать: `./gradlew assembleRelease` (или bundleRelease → `.aab`).
3. Google Play Console — разовый взнос **$25**.

Добавим, когда дойдём до публикации.

---

## 5. iOS

⚠️ iOS-сборку **нельзя собрать на Windows** — нужен macOS + Xcode (Apple).

```bash
cd frontend
npm i @capacitor/ios
npx cap add ios
npx cap sync ios
npx cap open ios            # ТОЛЬКО на Mac
```

Варианты без Мака: облачный Mac-CI (Codemagic / Ionic Appflow).
Плюс Apple Developer — **$99/год**. Отложено по решению.
