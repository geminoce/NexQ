# План upgrade STT: Parakeet TDT v3 и русская GigaAM в NexQ audio pipeline

## Цель

Сделать real-time распознавание русской речи для локальных NeMo transducer моделей, не ломая текущую архитектуру NexQ.

Целевые модели:

- `parakeet-tdt-0.6b-v3-int8`
- `sherpa-onnx-nemo-transducer-giga-am-v2-russian-2025-04-19`
- `gigaam-v3-e2e-rnnt` внутри того же provider `GigaAM Russian`, как вторая модель

Главное решение:

- не запускать `sherpa-onnx-vad-microphone-simulated-streaming-asr.exe` как microphone CLI;
- не отдавать захват микрофона/системного звука стороннему процессу;
- оставить главным источником звука существующий `AudioCaptureManager`;
- реализовать новый `STTProvider`, который принимает `AudioChunk` через `feed_audio()`.

## Источники

- NeMo transducer models: https://k2-fsa.github.io/sherpa/onnx/pretrained_models/offline-transducer/nemo-transducer-models.html
- GigaAM v2 Russian: https://k2-fsa.github.io/sherpa/onnx/pretrained_models/offline-transducer/nemo-transducer-models.html#sherpa-onnx-nemo-transducer-giga-am-v2-russian-2025-04-19-russian
- GigaAM upstream: https://github.com/salute-developers/GigaAM
- GigaAM v3 sherpa-onnx candidate: https://huggingface.co/Smirnov75/GigaAM-v3-sherpa-onnx
- Rust crate `sherpa-onnx`: https://docs.rs/sherpa-onnx/latest/sherpa_onnx/

## Текущий статус выполнения

- Шаг 1 выполнен: текущее состояние проверено, предыдущий offline batch routing не используется.
- Шаг 2 выполнен: `sherpa-onnx` добавлен в shared-режиме, `cargo check` и `cargo build` проходят на Windows.
- Важно: default static режим `sherpa-onnx` конфликтовал с `whisper-rs` по MSVC runtime (`MT_StaticRelease` vs `MD_DynamicRelease`), поэтому используется `default-features = false, features = ["shared"]`.
- Шаг 3 выполнен: создан skeleton provider `SherpaNemoTransducerSTT`.
- Шаг 4 выполнен: provider использует `discover_model_files`.
- Шаг 5 частично выполнен: добавлено создание `OfflineRecognizer` и decode одного PCM buffer через `nemo_transducer`.
- Шаг 6 частично выполнен: добавлена MVP simulated streaming логика поверх `AudioChunk` и `chunk.is_speech`.
- Шаг 7 выполнен для Parakeet: `parakeet_tdt` transducer routing переключён с `OrtStreamingSTT` на `SherpaNemoTransducerSTT`.
- Ручной тест Parakeet TDT v3 выполнен: русская речь транскрибируется, скорость приемлемая.
- Шаг 8 выполнен: добавлен отдельный provider/engine/model `gigaam_russian` для GigaAM v2 Russian.
- Текущая проверка: `cargo check` и `npx tsc --noEmit` проходят.
- Ручной тест GigaAM v2 Russian выполнен: русская речь транскрибируется, но модель отдаёт текст без пунктуации.
- Шаг 8.1 выполнен технически: добавлена свежая GigaAM v3 e2e RNNT от Smirnov75 как вторая модель внутри `GigaAM Russian`, добавлена multi-file загрузка и расширен model discovery.
- Исправлен sync STT Settings -> live Meeting Audio: выбор `GigaAM Russian`/активация GigaAM v3 больше не должны оставлять live meeting на старом `Parakeet TDT`.
- Исправлено сохранение custom Context Strategy/RAG config: настройки теперь пишутся в plugin-store и после перезапуска синхронизируются обратно в Rust backend.
- Следующий шаг: скачать GigaAM v3 punct RNNT из Settings и проверить русскую речь с пунктуацией.

## Что уже есть в NexQ

### Audio pipeline

Файлы:

- `src-tauri/src/audio/mod.rs`
- `src-tauri/src/commands/audio_commands.rs`

Текущий поток:

1. `AudioCaptureManager` захватывает mic/system/room audio.
2. Audio loop получает `AudioChunk`.
3. Для каждого chunk применяется VAD/уровни/recording.
4. Затем chunk отправляется в выбранный STT provider через:
   - `provider.feed_audio(chunk).await`

Это правильная точка интеграции. Её сохраняем.

### STT provider interface

Файл:

- `src-tauri/src/stt/provider.rs`

Интерфейс:

- `start_stream(result_tx)`
- `feed_audio(AudioChunk)`
- `stop_stream()`
- `set_language(language)`

Новый provider должен полностью вписаться в этот интерфейс.

### Existing sherpa sidecar

Файл:

- `src-tauri/src/stt/sherpa_sidecar.rs`

Важная идея уже есть:

- процесс запускается отдельно;
- PCM пишется в stdin;
- JSON читается из stdout;
- результаты превращаются в `TranscriptResult`.

Этот файл можно использовать как образец, но не копировать бездумно.

## Почему не `OrtStreamingSTT`

Файл:

- `src-tauri/src/stt/ort_streaming.rs`

Текущий `OrtStreamingSTT` делает самодельный loop:

1. fbank features
2. encoder
3. decoder
4. joiner
5. greedy argmax
6. ручная сборка token ids

Для Parakeet TDT v3 / GigaAM RNNT этого недостаточно.

Проблемы, которые уже видели:

- joiner dimension errors;
- `Skipping out-of-vocabulary token id 8194`;
- `tokens=0`;
- русская речь не превращается в текст.

Вывод:

- дальше не чиним Parakeet/GigaAM через `OrtStreamingSTT`;
- `OrtStreamingSTT` оставить для моделей, для которых он реально подходит;
- NeMo TDT/RNNT модели увести в отдельный provider.

## Почему не microphone CLI

В документации sherpa есть:

- `sherpa-onnx-vad-microphone-simulated-streaming-asr`

Но этот binary сам читает микрофон.

Для NexQ это плохо:

- обходит выбранный в NexQ audio device;
- не работает нормально с `Them`/system loopback;
- ломает mute gate;
- ломает recording/mixing;
- ломает единый timestamp/segment pipeline;
- не вписывается в `feed_audio(AudioChunk)`.

Вывод:

- microphone CLI можно использовать только как внешний reference/test;
- в продуктовую интеграцию его не встраиваем.

## Правильная архитектура

Создать новый provider:

- `SherpaNemoTransducerSTT`

Файл:

- `src-tauri/src/stt/sherpa_nemo_transducer.rs`

Provider должен принимать PCM из NexQ:

- `AudioChunk.pcm_data: Vec<i16>`
- sample rate ожидаем 16 kHz mono
- source/speaker остаётся на уровне текущего per-party routing

Внутри provider:

1. получает chunks через `feed_audio`;
2. конвертирует `i16` в `f32` `[-1.0, 1.0]`;
3. буферизует речь;
4. делает VAD/endpointing;
5. декодирует текущий speech segment;
6. отправляет `TranscriptResult`.

## Выбор runtime

### Вариант A: Rust crate `sherpa-onnx` (предпочтительно)

Добавить зависимость:

- `sherpa-onnx`

Плюсы:

- остаёмся внутри Rust;
- не нужен отдельный процесс;
- не нужен stdin/stdout protocol;
- можно использовать `OfflineRecognizer`, `OnlineRecognizer`, `VoiceActivityDetector`;
- проще отлаживать ownership/state.

Минусы:

- может увеличить время сборки;
- build script может скачать native libs;
- нужно проверить совместимость с Windows/MSVC и Tauri packaging.

Первый spike должен ответить:

- собирается ли `sherpa-onnx` в текущем `src-tauri`;
- работает ли example config для `nemo_transducer`;
- можно ли использовать `VoiceActivityDetector` или проще сначала оставить NexQ VAD.

### Вариант B: sidecar, принимающий PCM через stdin

Если Rust crate окажется тяжёлым или конфликтным:

- сделать/найти sherpa binary, который принимает PCM через stdin;
- переиспользовать архитектуру `sherpa_sidecar.rs`;
- читать JSON из stdout;
- не использовать microphone binary.

Плюсы:

- меньше связывания с native libs в Cargo;
- sidecar проще обновлять отдельно.

Минусы:

- нужен подходящий binary/protocol;
- надо паковать binary;
- сложнее debug и lifecycle.

## Simulated streaming логика

Для NeMo transducer моделей из документации используется offline transducer recognizer, но real-time достигается через VAD и короткие сегменты.

Минимальный MVP:

1. Использовать текущий NexQ `VoiceActivityDetector`.
2. Когда `chunk.is_speech == true`, добавлять PCM в текущий speech buffer.
3. Если речь продолжается, каждые `800-1200 ms` делать interim decode текущего buffer.
4. Если наступила тишина дольше pause threshold, сделать final decode всего buffer.
5. Очистить buffer.

Поведение:

- interim results отправлять как `is_final=false`;
- final segment отправлять как `is_final=true`;
- не отдавать в модель чистую тишину;
- ограничить максимальную длину segment buffer, например `20-30 sec`.

Следующий этап:

- заменить/дополнить NexQ energy VAD на `silero_vad.onnx`, если нужна лучшая сегментация.

## Модель Parakeet TDT v3

Текущий registry:

- engine: `parakeet_tdt`
- model id: `parakeet-tdt-0.6b-v3-int8`
- files:
  - `encoder.int8.onnx`
  - `decoder.int8.onnx`
  - `joiner.int8.onnx`
  - `tokens.txt`

Что меняем:

- при обнаружении transducer files больше не создавать `OrtStreamingSTT`;
- создавать `SherpaNemoTransducerSTT`;
- language `ru-RU` передавать в metadata результата, но модель сама multilingual/autodetect.

## Модель GigaAM v2 Russian

Добавить отдельную модель в registry.

Рекомендуемый вариант:

- engine: `gigaam_russian`
- provider id: `gigaam_russian`
- model id: `giga-am-v2-russian-2025-04-19`

Параметры:

- display name: `GigaAM v2 Russian (RNNT)`
- archive: `sherpa-onnx-nemo-transducer-giga-am-v2-russian-2025-04-19.tar.bz2`
- download URL: `https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-transducer-giga-am-v2-russian-2025-04-19.tar.bz2`
- filename: `sherpa-onnx-nemo-transducer-giga-am-v2-russian-2025-04-19`
- files:
  - `encoder.int8.onnx`
  - `decoder.onnx`
  - `joiner.onnx`
  - `tokens.txt`

Важно:

- проверить license GigaAM перед PR;
- если license не подходит для upstream, держать модель как optional/local experimental.

## Модель GigaAM v3 e2e RNNT

Цель:

- получить русскую транскрипцию сразу с пунктуацией и нормализацией текста;
- не добавлять новый верхнеуровневый STT provider;
- показать модель как второй вариант внутри `GigaAM Russian` в блоке STT Providers, по аналогии с двумя моделями у `Parakeet TDT`.

Почему это нужно:

- текущий GigaAM v2 Russian работает, но отдаёт текст без точек и запятых;
- upstream GigaAM указывает, что `v3_e2e_ctc` и `v3_e2e_rnnt` поддерживают punctuation и text normalization;
- значит лучше сначала проверить v3 e2e модель, а не чинить пунктуацию LLM-постобработкой.

Кандидат:

- HuggingFace: `Smirnov75/GigaAM-v3-sherpa-onnx`
- вариант: `e2e_rnnt`, sherpa-onnx compatible, свежие файлы около 2 месяцев назад
- ожидаемые файлы:
  - `gigaam_v3_e2e_rnnt_encoder_int8.onnx`
  - `gigaam_v3_e2e_rnnt_decoder.onnx`
  - `gigaam_v3_e2e_rnnt_joint.onnx`
  - `gigaam_v3_e2e_rnnt_tokens.txt`

Важно:

- это не официальный k2-fsa release archive, поэтому перед PR нужно отдельно проверить license/source/качество артефактов;
- модель лежит на HuggingFace как несколько файлов, поэтому добавлена поддержка multi-file download;
- `model_discovery.rs` расширен:
  - `joiner` или `joint`;
  - `tokens.txt` или `*_tokens.txt`;
  - `encoder`/`decoder` с любым prefix.

Желаемая UX-модель:

- Provider в UI остаётся один: `GigaAM Russian`.
- Внутри его блока моделей появляются:
  - `GigaAM v2 Russian (RNNT)`
  - `GigaAM v3 e2e RNNT (punctuation)`
- Default пока оставить v2, пока v3 не пройдёт ручной тест.
- После успешного теста можно сделать v3 default для русского языка.

## Последовательный план работ

### Шаг 1. Зафиксировать текущее состояние

- Проверить `git status`.
- Убедиться, что предыдущий offline batch routing откатан.
- Не трогать unrelated localization/RAG/LLM/audio capture.

### Шаг 2. Spike `sherpa-onnx` crate

Цель:

- понять, можно ли использовать `sherpa-onnx` прямо из Rust backend.

Действия:

- добавить dependency в `src-tauri/Cargo.toml`;
- сделать минимальный compile-only тест или временный модуль без подключения UI;
- проверить `cargo check`.

Критерий успеха:

- проект собирается на Windows;
- crate доступен;
- нет конфликтов с Tauri build.

Если не собирается:

- откатить dependency;
- перейти к sidecar strategy.

### Шаг 3. Создать skeleton provider

Файл:

- `src-tauri/src/stt/sherpa_nemo_transducer.rs`

Реализовать:

- struct `SherpaNemoTransducerSTT`;
- `new(model_dir, provider_type)`;
- `set_app_handle`;
- `STTProvider` trait;
- пока без реального decode можно логировать lifecycle.

Проверка:

- `cargo check`

### Шаг 4. Подключить model discovery

Использовать:

- `discover_model_files(model_dir)`

Provider должен найти:

- encoder;
- decoder;
- joiner;
- tokens.

Добавить debug logs:

- model dir;
- file names;
- provider type;
- language.

### Шаг 5. Реализовать decode одного speech buffer

Для crate strategy:

- создать `OfflineRecognizer` с `OfflineTransducerModelConfig`;
- использовать `model_type = nemo_transducer`;
- создать stream;
- `accept_waveform(16000, samples)`;
- `decode`;
- получить text/result.

Для sidecar strategy:

- передавать short WAV/PCM buffer в sidecar;
- парсить JSON output.

Критерий:

- локальный test buffer из WAV или накопленного PCM возвращает русский текст.

### Шаг 6. Реализовать simulated streaming поверх NexQ chunks

В provider:

- хранить `speech_buffer: Vec<f32>`;
- хранить `last_interim_at`;
- хранить `segment_counter`;
- на speech chunks добавлять samples;
- на паузе делать final decode;
- по таймеру делать interim decode.

Минимальные параметры:

- interim interval: `1000 ms`;
- min decode audio: `800 ms`;
- max segment: `30 sec`;
- final silence: брать из `chunk.is_speech` или локального счётчика тишины.

### Шаг 7. Подключить Parakeet routing

Файл:

- `src-tauri/src/commands/audio_commands.rs`

В ветке `STTProviderType::ParakeetTdt`:

- если `discover_model_files(model_dir)` успешен:
  - создать `SherpaNemoTransducerSTT`;
  - не создавать `OrtStreamingSTT`;
- если только offline CTC model:
  - оставить текущий fallback на `SherpaOfflineSTT`.

В логах должно быть:

- `Parakeet TDT using SherpaNemoTransducerSTT`

И не должно быть:

- `[ort_streaming]` для `parakeet-tdt-0.6b-v3-int8`.

### Шаг 8. Добавить GigaAM provider/model

Файлы:

- `src-tauri/src/stt/provider.rs`
- `src-tauri/src/stt/local_engines/model_registry.rs`
- `src-tauri/src/commands/audio_commands.rs`
- `src/lib/types.ts`
- `src/settings/STTSettings.tsx`
- `src/settings/MeetingAudioSettings.tsx`
- `src/i18n/en.ts`
- `src/i18n/ru.ts`

Изменения:

- добавить `STTProviderType::GigaAmRussian`;
- добавить engine/model registry;
- добавить UI option;
- добавить default local model id;
- routing вести в тот же `SherpaNemoTransducerSTT`.

### Шаг 8.1. Добавить GigaAM v3 e2e RNNT как вторую модель

Файлы:

- `src-tauri/src/stt/local_engines/model_registry.rs`
- `src-tauri/src/stt/local_engines/model_discovery.rs`
- `src-tauri/src/commands/audio_commands.rs`
- `src/stores/configStore.ts`
- `src/settings/STTSettings.tsx`
- `src/settings/MeetingAudioSettings.tsx`
- `src/components/ServiceStatusBar.tsx`
- `src/i18n/en.ts`
- `src/i18n/ru.ts`

Изменения:

- не добавлять новый `STTProviderType`;
- оставить provider/engine id `gigaam_russian`;
- добавить вторую model definition в `GIGAAM_RUSSIAN_MODELS`;
- model id: `gigaam-v3-e2e-rnnt-punct`;
- display name: `GigaAM v3 e2e RNNT (punctuation)`;
- routing оставить через `STTProviderType::GigaAmRussian` и `SherpaNemoTransducerSTT`;
- обновить guard в `audio_commands.rs`, чтобы `local_model_id` с `gigaam-v3` не сбрасывался на v2;
- расширить discovery под `joint` и `*_tokens.txt`;
- проверить, что model selector внутри `GigaAM Russian` показывает обе модели.
- добавить multi-file download для модели, потому что HuggingFace хранит её не одним `.tar.bz2`, а набором ONNX/tokens файлов.

Проверка:

- скачать/подложить GigaAM v3 e2e RNNT;
- выбрать `GigaAM Russian` -> `GigaAM v3 e2e RNNT (punctuation)`;
- Settings -> STT -> Language -> Russian;
- start meeting;
- говорить по-русски.

Ожидается:

- provider создаётся как `GigaAM Russian using SherpaNemoTransducerSTT`;
- текст приходит с точками/запятыми или заметно лучшей нормализацией;
- если v3 работает стабильно, рассмотреть смену default model для `gigaam_russian` с v2 на v3.

### Шаг 9. Проверить язык STT

Убедиться:

- `sttLanguage` сохраняется;
- `get_stt_language(state)` возвращает `ru-RU`;
- provider получает language;
- transcript result содержит `language: Some("ru-RU")` или `ru`.

Важно:

- для Parakeet v3 язык может быть autodetect;
- для GigaAM модель русская, поэтому UI должен ясно показывать, что она для Russian.

### Шаг 10. Логирование и диагностика

Добавить debug logs:

- provider created;
- model files found;
- decode buffer duration;
- interim/final result text length;
- empty result;
- errors from sherpa runtime.

Логи должны помогать отличить:

- нет audio chunks;
- VAD считает всё тишиной;
- модель не загружена;
- decode вернул empty text;
- provider не тот.

### Шаг 11. Проверка сборки

Запустить:

```powershell
cargo check
npx tsc --noEmit
```

Если добавлен `sherpa-onnx` crate:

- проверить чистую сборку после удаления target не обязательно, но желательно перед PR.

### Шаг 12. Ручной тест

Команда:

```powershell
npm run tauri dev -- --no-dev-server-wait
```

Тест Parakeet:

1. Settings -> STT -> Language -> Russian.
2. Provider -> Parakeet TDT.
3. Model -> `parakeet-tdt-0.6b-v3-int8`.
4. Start meeting.
5. Говорить по-русски.

Ожидается:

- нет `[ort_streaming]`;
- есть logs `SherpaNemoTransducerSTT`;
- появляются русские transcript segments.

Тест GigaAM:

1. Скачать GigaAM v2 Russian или GigaAM v3 e2e RNNT.
2. Выбрать provider `GigaAM Russian` и нужную модель внутри него.
3. Start meeting.
4. Говорить по-русски.

Ожидается:

- русская транскрипция;
- более стабильное качество на русском, чем Parakeet.
- для GigaAM v3 e2e RNNT ожидается пунктуация/нормализация текста.

### Шаг 13. Обновить план/документацию по результатам

После spike:

- записать, выбран ли crate или sidecar;
- записать найденные ограничения;
- обновить этот файл перед следующими изменениями.

### Шаг 14. Commit только после ручного теста

Commit делать только когда:

- `cargo check` проходит;
- `npx tsc --noEmit` проходит;
- ручной тест даёт русскую транскрипцию;
- в логах нет старого `OrtStreamingSTT` для Parakeet/GigaAM.

## Риски

- `sherpa-onnx` crate может усложнить сборку или packaging.
- Offline transducer decode на каждом interim buffer может быть тяжелее, чем true online streaming.
- Energy VAD NexQ может хуже сегментировать русскую речь, чем Silero VAD.
- GigaAM license нужно проверить перед upstream PR.
- GigaAM v3 sherpa-onnx artifact может быть неофициальным; перед PR нужно проверить provenance/license.
- Для GigaAM v3 может понадобиться multi-file download или упаковка модели в archive.
- Parakeet v3 multilingual может распознавать русский хуже, чем специализированная GigaAM.

## Текущее решение по направлению

Идём так:

1. Сохраняем NexQ audio pipeline.
2. Не используем microphone CLI в продуктовой интеграции.
3. Не продолжаем чинить Parakeet/GigaAM через `OrtStreamingSTT`.
4. Делаем новый provider `SherpaNemoTransducerSTT`.
5. Сначала пробуем Rust crate `sherpa-onnx`.
6. Если crate не подходит, делаем stdin sidecar.
7. Parakeet v3 и GigaAM используют один новый provider.
