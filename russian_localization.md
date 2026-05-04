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

1. `GeneralSettings` - готово: видимые строки и переключатели используют i18n-ключи
2. `HotkeySettings` - готово: заголовки, таблица, подсказки, aria-label и toast-сообщения используют i18n-ключи
3. `MeetingAudioSettings` - готово: пресеты, роли, источники, мониторинг, аудиосессии и выбор STT-провайдера используют i18n-ключи
4. `STTSettings` - готово: основные секции, язык, подключения, модели и advanced-блоки используют i18n-ключи; карточки облачных STT-провайдеров расширены, чтобы названия не обрезались
5. `LLMSettings` - готово: провайдеры, API-ключи, подключение, список моделей и OpenRouter-каталог используют i18n-ключи
6. `TranslationSettings` - готово: провайдеры, API-ключи, языки, поведение и OPUS-MT manager используют i18n-ключи; badge-статусы провайдеров зафиксированы внутри карточек
7. `ContextStrategySettings` - готово: стратегии, пресеты, статусы индекса, поиск и кастомные параметры используют i18n-ключи
8. `ScenarioSettings` - готово: UI-строки и встроенные prompt-тексты сценариев переведены
9. `NoisePresetSettings` - готово: компонент уже использует i18n-ключи для названий, описаний и статистики пресетов
10. `ConfidenceSettings` - готово: все видимые строки компонента уже используют i18n-ключи
11. `LocalModelManager` - готово: кнопки Activate/Download/Delete, статусы, accuracy/speed и toast-сообщения используют i18n-ключи
12. `OpusMtModelManager` - готово: заголовок, фильтр языков, статусы, кнопки, tooltips и toast-сообщения переведены через i18n
13. `OpenRouterModelCatalog` - готово: поиск, сортировка, фильтры, избранное, недавно использованные, карточки и пустые состояния переведены через i18n
14. `AIActionsSettings` - готово: раздел `AI-действия`, стиль ответа, поведение AI, окно контекста, список Actions, `System Prompt`, источники контекста и overrides переведены через i18n
15. `PromptPreviewDialog` - готово: предпросмотр промпта, `System Prompt`, `User Message`, included sections, оценка токенов и параметры переведены через i18n
16. `AboutSettings` - готово: раздел `О программе`, статусы обновления, quick links и footer переведены через i18n

Дополнительно:

- `src-tauri/src/stt/local_engines/model_registry.rs` - обновлены подписи и рейтинги моделей GigaAM: v2 Russian = точность 3 / скорость 5; v3 e2e RNNT = `GigaAM v3 e2e RNNT (int8, Russian, punctuation)`, точность 5 / скорость 4.
- `src/settings/SettingsOverlay.tsx` - для grid-heavy вкладок (`LLM`, `STT`, `Перевод`, `AI-действия`, `Стратегия контекста`) выставлена умеренная ширина content-area, чтобы UI не растягивался в обычном оконном режиме.
- `src/settings/LLMSettings.tsx`, `src/settings/STTSettings.tsx`, `src/settings/TranslationSettings.tsx` - карточки провайдеров приведены к компактному формату; в LLM/STT статусный badge закреплён справа сверху, а название и описание читаются слева.
- `src/settings/MeetingAudioSettings.tsx` - пресеты аудио разложены симметричной сеткой 3x2 без горизонтального скролла.
- `src/settings/ContextStrategySettings.tsx` - быстрые пресеты не переносят названия внутри кнопок; полные подписи `Самый быстрый` и `Самый точный` сохранены в одну строку.

После каждой вкладки:

```bash
npm run build
```

Особое внимание:

- `Settings -> STT -> Language`: названия языков можно перевести, но значения вроде `ru-RU`, `en-US` не менять.
- provider names обычно не переводить: `Deepgram`, `Parakeet TDT`, `Groq Whisper`.
- технические параметры Deepgram/Groq можно оставить как code labels, но поясняющий UI перевести.

## Шаг 6. Перевести onboarding wizard - готово

Файлы:

- `src/components/wizard/FirstRunWizard.tsx` - готово: навигация, счётчик шагов, aria-label, Back/Next/Skip переведены
- `WelcomeStep.tsx` - готово: приветствие, автообнаружение аудио/LLM, подписи `Ollama/LM Studio (локальная LLM)` и итоговые сообщения переведены
- `AudioSetupStep.tsx` - готово: настройка источников, smart scan, результаты, тест микрофона и подписи устройств переведены
- `STTSetupStep.tsx` - готово: описания STT-провайдеров, рекомендации и подписи сторон переведены
- `LLMSetupStep.tsx` - готово: локальные/облачные провайдеры, API-key блок, проверки подключения, выбор модели и подсказки переведены
- `ReadyStep.tsx` - готово: финальный экран, сводка аудио, горячие клавиши и кнопки запуска/перехода переведены

Проверить:

- все шаги wizard читаются по-русски;
- кнопки Next/Back/Start Meeting переведены;
- provider/model IDs не изменены;
- хоткеи отображаются как есть.

## Шаг 7. Перевести launcher и post-meeting UI - готово

Файлы:

- `src/launcher/LauncherView.tsx` - готово: поиск, фильтры, пустые состояния, удаление встреч и системные aria-label используют i18n
- `src/launcher/MeetingCard.tsx` - готово: карточки встреч, редактирование, избранное, статусы и удаление используют i18n
- `src/launcher/RecentMeetings.tsx` - готово: группы дат и empty state используют i18n
- `src/launcher/MeetingDetails.tsx` - готово: legacy-view деталей встречи переведён через i18n
- `src/launcher/meeting-details/*` - готово: вкладки, header stats, transcript controls, summary, AI log, speakers, action items, bookmarks, export menu и post-meeting translation controls переведены через i18n

Перевести:

- список встреч - готово;
- empty states - готово;
- поиск - готово;
- tabs - готово;
- transcript controls - готово;
- summary/action items/bookmarks labels - готово;
- export menu - готово;
- copy/download toasts - готово.

Проверить:

- открыть Past Meetings;
- открыть конкретную встречу;
- поиск transcript;
- copy/export actions.

## Шаг 8. Перевести overlay/live meeting UI - готово

Файлы:

- `src/overlay/OverlayView.tsx` - готово: заголовок встречи, статусы, кнопки header и системные подписи используют i18n
- `src/overlay/ModeButtons.tsx` - готово: режимы AI-действий используют i18n-ключи
- `src/overlay/AskInput.tsx` - готово: placeholder, aria-label и tooltips отправки/закрытия переведены
- `src/overlay/AIResponsePanel.tsx` - готово: вкладки, пустые состояния, панель текста AI и controls используют i18n
- `src/overlay/TranscriptPanel.tsx` - готово: заголовок, поиск, empty state, аудио-уровни и controls транскрипта используют i18n
- `src/overlay/TranscriptLine.tsx` - готово: tooltips переименования, перевода и закладок переведены
- `src/overlay/BookmarkPanel.tsx` - готово: список закладок, empty state, note placeholder и переход к строке переведены
- `src/overlay/BookmarkToast.tsx` - готово: toast закладки, добавление заметки, сохранение и закрытие переведены
- `src/overlay/TranscriptContextMenu.tsx` - готово: пункты правого клика для закладок, заметок и копирования переведены
- `src/overlay/SpeakerNamingBanner.tsx` - готово: баннер нового говорящего, naming/merge labels, placeholder и кнопки переведены
- `src/overlay/SpeakerStatsPanel.tsx` - готово: статистика говорящих, empty state, относительное время и word count переведены

Не переводить:

- сам transcript;
- user-entered text;
- speaker IDs, если они используются как data keys.

Проверено/проверить:

- start meeting - UI-строки overlay вынесены в i18n;
- live transcript - служебные подписи переведены, сам transcript не переводится;
- Ask input - готово;
- mode buttons - готово;
- bookmarks - готово;
- speaker rename - готово;
- overlay hide/show - без изменения логики.

## Шаг 9. Перевести context/RAG UI - готово

Файлы:

- `src/context/ContextPanel.tsx` - готово: заголовок, статус smart search и список загруженного контекста используют i18n
- `src/context/FileUpload.tsx` - готово: drop zone, file dialog filter, статусы обработки и кнопка выбора файлов используют i18n
- `src/context/ResourceCard.tsx` - готово: токены, чанки, статусы индекса, re-index/remove tooltips и toast-сообщения используют i18n
- `src/context/TestSearchDialog.tsx` - готово: заголовок, подсказки, шаблоны запросов, поиск, AI-ответ, empty/error states и copy tooltips переведены
- `src/context/CustomInstructions.tsx` - готово: заголовок, счётчики символов/токенов и placeholder используют i18n
- `src/context/TokenBudget.tsx` - готово: бюджет токенов, legend labels и aria-label используют i18n
- `src/context/RagIndexBar.tsx` - готово: количество чанков, токены на запрос, rebuild/test controls используют i18n

Важно:

- UI переведён;
- RAG content, file names, extracted text не переводились;
- prompt/custom instruction content пользователя не менялся.

Проверено/проверить:

- upload file - UI вынесен в i18n;
- indexing state - статусы ResourceCard/RagIndexBar переведены;
- search test dialog - служебный UI и шаблоны переведены;
- resource remove/re-index - tooltips и toast-сообщения переведены.

## Шаг 10. Перевести toast/error messages - готово

Найти все `showToast(...)`.

Категории:

- success - готово;
- info - готово;
- error - готово;
- warning - готово.

Перевести через ключи:

```ts
showToast(t("toast.meetingEnded"), "info")
showToast(t("errors.copyFailed"), "error")
```

Если сообщение содержит переменные:

```ts
t("toast.translatedSegments", { count, total })
```

Сделано:

- `src/stores/ragStore.ts` - готово: Ollama, rebuild/clear index, pull model toasts используют i18n;
- `src/hooks/useActionItemsExtraction.ts` - готово: action items success/info/parse error используют i18n;
- `src/hooks/useBookmarkSuggestions.ts` - готово: bookmark suggestion info/parse error используют i18n;
- `src/lib/export.ts` - готово: export success/failure toasts используют i18n;
- `src/hooks/useModelDownload.ts` - готово: download failed toast использует i18n;
- `src/hooks/useUpdater.ts` - готово: fallback unknown error использует i18n;
- `src/calllog/CallLogPanel.tsx` - готово: copy/export toasts используют i18n;
- `src/calllog/PromptViewer.tsx` - готово: copy failure toast использует i18n.

Проверено/проверить основные сценарии:

- start/end meeting - уже использует i18n;
- copy transcript - уже использует i18n;
- translation fail - уже использует i18n;
- upload fail - backend error text оставлен как есть, UI-обёртка уже переведена;
- model download fail - готово;
- API key test fail - уже использует i18n.

## Шаг 11. Перевести Tauri tray menu - готово

Файлы:

- `src-tauri/src/tray/menu.rs` - готово: Start/Stop Meeting, mute, stealth, overlay, copy actions, Settings и Quit переведены на русский
- `src-tauri/src/tray/tooltip.rs` - готово: Idle, Recording, Mic Muted, Stealth, AI Processing и Indexing tooltips переведены

Так как это Rust-side UI, есть два варианта:

1. Минимальный: сразу заменить visible labels на русский.
2. Правильный: создать Rust-side localization helper для tray labels.

Для текущей задачи можно сделать минимальный вариант:

- `Start Meeting` -> `Начать встречу` - готово
- `Stop Meeting` -> `Завершить встречу` - готово
- `Mute Microphone` -> `Выключить микрофон` - готово
- `Mute System Audio` -> `Выключить системный звук` - готово
- `Settings` -> `Настройки` - готово
- `Quit NexQ` -> `Выйти из NexQ` - готово
- copy actions тоже перевести - готово

После изменения Rust:

```bash
cd src-tauri
cargo check
cd ..
```

## Шаг 12. Проверить hardcoded строки автоматически - готово

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

Результат:

- поиски `rg -n "\"[A-Z][^\"]{2,}\"" src`, `rg -n "placeholder=\"|aria-label=\"|title=\"" src` и `rg -n "showToast\\(" src` выполнены;
- видимые остатки в `App.tsx`, `AudioPlayer`, `Toast`, `ColorPickerButton`, `DevLogPanel`, `UpdateDialog`, `calllog/*` и `PromptViewer` переведены на i18n-ключи;
- прямые hardcoded `showToast("...")`, `setError("...")` и `setErrorMessage("...")` после проверки не найдены;
- оставшиеся совпадения отфильтрованы как технические строки: enum/id, имена провайдеров и моделей, SVG/path data, console/debug logs, i18n-словари и маркеры парсинга prompt-текста;
- `npx tsc --noEmit` проходит.

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
