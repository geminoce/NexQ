# Russian UI Localization Plan

## Цель

Перевести весь пользовательский интерфейс NexQ на русский язык так, чтобы:

- не сломать существующую функцию перевода транскриптов;
- не смешать UI localization с `useTranslation` / `translationStore`, которые сейчас отвечают за перевод текста встреч;
- сохранить возможность позже добавить переключение языков UI;
- не трогать unrelated code без необходимости.

## Важное наблюдение

В проекте уже есть сущности с названием `Translation`, но они относятся к переводу транскриптов и post-meeting translation. Это не i18n интерфейса.

Поэтому нельзя просто переиспользовать `useTranslation` из `src/hooks/useTranslation.ts`. Для UI нужен отдельный слой, например:

- `src/i18n/ru.ts`
- `src/i18n/en.ts`
- `src/i18n/index.ts`
- `useI18n()` или простой `t(key)` helper

## Общая стратегия

Делать локализацию не хаотичной заменой строк в JSX, а через централизованный словарь ключей. Так проще:

- проверить полноту перевода;
- избежать повторов;
- позже вернуть английский UI или добавить переключатель;
- не ломать компоненты, где строка используется как `aria-label`, `title`, `placeholder`, toast или error text.

## Шаг 0. Подготовка ветки

Ветка для работы:

```bash
Rus-Localization
```

Перед началом каждого крупного этапа:

```bash
git status --short
npm run build
```

После изменений:

```bash
npm run build
```

Rust проверять только если затрагивались `src-tauri` файлы:

```bash
cd src-tauri
cargo check
cd ..
```

## Шаг 1. Инвентаризация всех UI-строк

Найти все видимые пользователю строки:

- JSX text nodes;
- `placeholder`;
- `title`;
- `aria-label`;
- `label`;
- button text;
- toast messages;
- modal text;
- empty states;
- error messages;
- confirmation messages;
- onboarding/wizard text;
- tray menu labels;
- Tauri window titles, если они видны пользователю;
- demo scenario UI labels, если они отображаются в приложении.

Основные зоны:

- `src/launcher`
- `src/overlay`
- `src/settings`
- `src/components`
- `src/components/wizard`
- `src/context`
- `src/calllog`
- `src/hooks`
- `src/stores/toastStore.ts` consumers
- `src-tauri/src/tray`

Не переводить:

- internal logs;
- технические enum/string IDs;
- provider IDs: `deepgram`, `parakeet_tdt`, `ollama`, etc.;
- model IDs;
- API command names;
- database fields;
- prompt keys и системные инструкции, если они уходят в LLM и должны оставаться на английском.

## Шаг 2. Создать UI i18n слой

Создать:

```text
src/i18n/
  index.ts
  en.ts
  ru.ts
  types.ts
```

Минимальный вариант:

- `en.ts` содержит текущие английские строки;
- `ru.ts` содержит русские строки;
- `index.ts` экспортирует `t(key, params?)`;
- текущий активный язык пока hardcoded как `ru`;
- тип ключей строится от структуры `en`.

Пример API:

```ts
t("settings.stt.language")
t("common.save")
t("toast.meetingEnded")
t("meeting.start")
```

Поддержать interpolation:

```ts
t("toast.translatedNewSegments", { count, total })
```

## Шаг 3. Добавить правила именования ключей

Структура ключей:

```text
common.*
settings.*
settings.stt.*
settings.llm.*
settings.translation.*
meeting.*
launcher.*
overlay.*
wizard.*
context.*
calllog.*
toast.*
errors.*
tray.*
```

Правила:

- короткие общие слова в `common`;
- screen-specific строки рядом по namespace;
- не плодить разные ключи для одинакового текста вроде `Save`, `Cancel`, `Delete`;
- не переводить значения, которые сравниваются в коде.

## Шаг 4. Начать с общих компонентов и shell UI

Перевести сначала общую оболочку:

- `src/settings/SettingsOverlay.tsx`
- `src/components/Toast.tsx`, если есть статический текст;
- `src/components/ErrorBoundary.tsx`
- `src/launcher/LauncherView.tsx`
- `src/overlay/OverlayView.tsx`
- `src/components/ServiceStatusBar.tsx`
- `src/overlay/StatusBar.tsx`

Цель этапа: основные вкладки, навигация, заголовки и глобальные ошибки должны стать русскими.

Проверка:

- приложение запускается;
- Settings открывается;
- Overlay открывается;
- нет missing translation keys.

## Шаг 5. Перевести Settings по вкладкам

Идти вкладками, по одной за раз:

1. `GeneralSettings`
2. `HotkeySettings`
3. `MeetingAudioSettings`
4. `STTSettings`
5. `LLMSettings`
6. `TranslationSettings`
7. `ContextStrategySettings`
8. `ScenarioSettings` - готово: UI-строки и встроенные prompt-тексты сценариев переведены
9. `NoisePresetSettings` - готово: компонент уже использует i18n-ключи для названий, описаний и статистики пресетов
10. `ConfidenceSettings`
11. `LocalModelManager`
12. `OpusMtModelManager`
13. `OpenRouterModelCatalog`

После каждой вкладки:

```bash
npm run build
```

Особое внимание:

- `Settings -> STT -> Language`: названия языков можно перевести, но значения вроде `ru-RU`, `en-US` не менять.
- provider names обычно не переводить: `Deepgram`, `Parakeet TDT`, `Groq Whisper`.
- технические параметры Deepgram/Groq можно оставить как code labels, но поясняющий UI перевести.

## Шаг 6. Перевести onboarding wizard

Файлы:

- `src/components/wizard/FirstRunWizard.tsx`
- `WelcomeStep.tsx`
- `AudioSetupStep.tsx`
- `STTSetupStep.tsx`
- `LLMSetupStep.tsx`
- `ReadyStep.tsx`

Проверить:

- все шаги wizard читаются по-русски;
- кнопки Next/Back/Start Meeting переведены;
- provider/model IDs не изменены;
- хоткеи отображаются как есть.

## Шаг 7. Перевести launcher и post-meeting UI

Файлы:

- `src/launcher/LauncherView.tsx`
- `src/launcher/MeetingCard.tsx`
- `src/launcher/RecentMeetings.tsx`
- `src/launcher/MeetingDetails.tsx`
- `src/launcher/meeting-details/*`

Перевести:

- список встреч;
- empty states;
- поиск;
- tabs;
- transcript controls;
- summary/action items/bookmarks labels;
- export menu;
- copy/download toasts.

Проверить:

- открыть Past Meetings;
- открыть конкретную встречу;
- поиск transcript;
- copy/export actions.

## Шаг 8. Перевести overlay/live meeting UI

Файлы:

- `src/overlay/OverlayView.tsx`
- `src/overlay/ModeButtons.tsx`
- `src/overlay/AskInput.tsx`
- `src/overlay/AIResponsePanel.tsx`
- `src/overlay/TranscriptPanel.tsx`
- `src/overlay/TranscriptLine.tsx`
- `src/overlay/BookmarkPanel.tsx`
- `src/overlay/BookmarkToast.tsx`
- `src/overlay/TranscriptContextMenu.tsx`
- `src/overlay/SpeakerNamingBanner.tsx`
- `src/overlay/SpeakerStatsPanel.tsx`

Не переводить:

- сам transcript;
- AI-generated content;
- user-entered text;
- speaker IDs, если они используются как data keys.

Проверить:

- start meeting;
- live transcript;
- Ask input;
- mode buttons;
- bookmarks;
- speaker rename;
- overlay hide/show.

## Шаг 9. Перевести context/RAG UI

Файлы:

- `src/context/ContextPanel.tsx`
- `src/context/FileUpload.tsx`
- `src/context/ResourceCard.tsx`
- `src/context/TestSearchDialog.tsx`
- `src/context/CustomInstructions.tsx`
- `src/context/TokenBudget.tsx`
- `src/context/RagIndexBar.tsx`

Важно:

- UI перевести;
- RAG content, file names, extracted text не переводить;
- prompt/custom instruction content пользователя не менять.

Проверить:

- upload file;
- indexing state;
- search test dialog;
- resource remove/re-index.

## Шаг 10. Перевести toast/error messages

Найти все `showToast(...)`.

Категории:

- success;
- info;
- error;
- warning.

Перевести через ключи:

```ts
showToast(t("toast.meetingEnded"), "info")
showToast(t("errors.copyFailed"), "error")
```

Если сообщение содержит переменные:

```ts
t("toast.translatedSegments", { count, total })
```

Проверить основные сценарии:

- start/end meeting;
- copy transcript;
- translation fail;
- upload fail;
- model download fail;
- API key test fail.

## Шаг 11. Перевести Tauri tray menu

Файлы:

- `src-tauri/src/tray/menu.rs`
- возможно `src-tauri/src/tray/tooltip.rs`

Так как это Rust-side UI, есть два варианта:

1. Минимальный: сразу заменить visible labels на русский.
2. Правильный: создать Rust-side localization helper для tray labels.

Для текущей задачи можно сделать минимальный вариант:

- `Start Meeting` -> `Начать встречу`
- `Stop Meeting` -> `Завершить встречу`
- `Mute Microphone` -> `Выключить микрофон`
- `Mute System Audio` -> `Выключить системный звук`
- `Settings` -> `Настройки`
- `Quit NexQ` -> `Выйти из NexQ`
- copy actions тоже перевести.

После изменения Rust:

```bash
cd src-tauri
cargo check
cd ..
```

## Шаг 12. Проверить hardcoded строки автоматически

После первичного перевода запустить поиски:

```bash
rg -n "\"[A-Z][^\"]{2,}\"" src
rg -n "placeholder=\"|aria-label=\"|title=\"" src
rg -n "showToast\\(" src
```

Ручная фильтрация обязательна, потому что будут false positives:

- CSS class names;
- provider names;
- model names;
- internal errors;
- imports;
- object keys.

## Шаг 13. Добавить fallback для missing keys

В `t()` helper:

- если ключа нет в `ru`, брать `en`;
- если нет и в `en`, возвращать сам ключ;
- в dev-режиме логировать warning.

Так UI не развалится из-за одного пропущенного перевода.

## Шаг 14. Добавить настройку языка UI

После полной русификации можно добавить UI language setting:

Файл:

- `src/stores/configStore.ts`
- `src/settings/GeneralSettings.tsx`

Новое поле:

```ts
uiLanguage: "ru" | "en"
```

Default:

```ts
"ru"
```

Action:

```ts
setUiLanguage(language)
```

Это лучше делать после основного перевода, чтобы не смешивать инфраструктуру и массовую замену строк.

## Шаг 15. Финальная ручная проверка

Проверить основные user flows:

1. Первый запуск / wizard.
2. Launcher без встреч.
3. Launcher со встречами.
4. Start meeting.
5. Overlay live transcript.
6. Ask AI.
7. End meeting.
8. Past meeting details.
9. Settings все вкладки.
10. STT language Russian.
11. Translation settings.
12. Context/RAG upload.
13. Tray menu.
14. Ошибки API key.
15. Model download UI.

## Шаг 16. Финальные проверки перед commit

```bash
npm run build
cd src-tauri
cargo check
cd ..
git diff --stat
git status --short
```

Если делались Rust formatting changes, не запускать `cargo fmt` на весь проект без отдельного решения, потому что сейчас `cargo fmt --check` показывает много unrelated formatting diffs.

## Рекомендуемый порядок коммитов

1. `Add UI localization infrastructure`
2. `Localize settings UI to Russian`
3. `Localize launcher and meeting details UI`
4. `Localize overlay UI`
5. `Localize context and call log UI`
6. `Localize tray menu`
7. `Add Russian localization verification notes`

## Что не делать

- Не переводить transcript content.
- Не переводить AI responses.
- Не переводить model/provider IDs.
- Не менять backend commands ради UI-текста, кроме tray/menu labels.
- Не рефакторить audio capture, RAG, LLM, STT routing без необходимости.
- Не делать массовую замену строк без ключей, если строка используется больше одного раза.
