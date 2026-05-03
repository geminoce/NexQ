// Sherpa-ONNX NeMo transducer STT provider.
//
// This provider keeps NexQ's existing audio pipeline intact: audio is still
// captured by AudioCaptureManager and delivered as AudioChunk via feed_audio().
// The sherpa-onnx runtime will be used only for decoding buffered PCM.

use async_trait::async_trait;
use std::path::PathBuf;
use std::time::Instant;
use tauri::AppHandle;
use tokio::sync::mpsc;

use crate::audio::AudioChunk;
use crate::stt::local_engines::model_discovery::ModelFiles;
use crate::stt::provider::{STTProvider, STTProviderType, TranscriptResult};

const SAMPLE_RATE: usize = 16_000;
const MIN_DECODE_SAMPLES: usize = SAMPLE_RATE * 800 / 1000;
const INTERIM_INTERVAL_MS: u128 = 1_000;
const FINAL_SILENCE_SAMPLES: usize = SAMPLE_RATE * 700 / 1000;
const MAX_SEGMENT_SAMPLES: usize = SAMPLE_RATE * 30;

pub struct SherpaNemoTransducerSTT {
    model_dir: PathBuf,
    provider_type: STTProviderType,
    language: String,
    is_streaming: bool,
    recognizer: Option<sherpa_onnx::OfflineRecognizer>,
    speech_buffer: Vec<f32>,
    silence_samples: usize,
    last_interim_at: Option<Instant>,
    segment_counter: u64,
    result_tx: Option<mpsc::Sender<TranscriptResult>>,
    app_handle: Option<AppHandle>,
}

impl SherpaNemoTransducerSTT {
    pub fn new(model_dir: PathBuf, provider_type: STTProviderType) -> Self {
        Self {
            model_dir,
            provider_type,
            language: "en".to_string(),
            is_streaming: false,
            recognizer: None,
            speech_buffer: Vec::new(),
            silence_samples: 0,
            last_interim_at: None,
            segment_counter: 0,
            result_tx: None,
            app_handle: None,
        }
    }

    pub fn set_app_handle(&mut self, handle: AppHandle) {
        self.app_handle = Some(handle);
    }

    fn debug(&self, level: &str, message: &str) {
        match level {
            "error" => log::error!("[sherpa_nemo_transducer] {}", message),
            "warn" => log::warn!("[sherpa_nemo_transducer] {}", message),
            _ => log::info!("[sherpa_nemo_transducer] {}", message),
        }

        if let Some(ref handle) = self.app_handle {
            crate::stt::emit_stt_debug(handle, level, "sherpa_nemo_transducer", message);
        }
    }

    fn create_recognizer(files: &ModelFiles) -> Result<sherpa_onnx::OfflineRecognizer, String> {
        use sherpa_onnx::{
            OfflineRecognizer, OfflineRecognizerConfig, OfflineTransducerModelConfig,
        };

        let mut config = OfflineRecognizerConfig::default();
        config.model_config.transducer = OfflineTransducerModelConfig {
            encoder: Some(files.encoder.to_string_lossy().to_string()),
            decoder: Some(files.decoder.to_string_lossy().to_string()),
            joiner: Some(files.joiner.to_string_lossy().to_string()),
        };
        config.model_config.tokens = Some(files.tokens.to_string_lossy().to_string());
        config.model_config.model_type = Some("nemo_transducer".to_string());
        config.model_config.provider = Some("cpu".to_string());
        config.model_config.num_threads = 4;
        config.decoding_method = Some("greedy_search".to_string());

        OfflineRecognizer::create(&config)
            .ok_or_else(|| "Failed to create sherpa-onnx OfflineRecognizer".to_string())
    }

    fn decode_samples(&self, samples: &[f32]) -> Result<String, String> {
        let recognizer = self
            .recognizer
            .as_ref()
            .ok_or_else(|| "Recognizer is not initialized".to_string())?;

        if samples.is_empty() {
            return Ok(String::new());
        }

        let stream = recognizer.create_stream();
        stream.accept_waveform(16_000, samples);
        recognizer.decode(&stream);

        let result = stream
            .get_result()
            .ok_or_else(|| "sherpa-onnx returned no result".to_string())?;

        Ok(result.text.trim().to_string())
    }

    fn epoch_ms() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
    }

    fn maybe_emit_result(&mut self, text: String, is_final: bool) {
        if text.is_empty() {
            return;
        }

        let Some(ref tx) = self.result_tx else {
            return;
        };

        let segment_id = format!("sherpa_nemo_{}", self.segment_counter);
        let result = TranscriptResult {
            text: text.clone(),
            is_final,
            confidence: if is_final { 0.92 } else { 0.80 },
            timestamp_ms: Self::epoch_ms(),
            speaker: None,
            language: Some(self.language.clone()),
            segment_id: Some(segment_id),
        };

        if let Err(e) = tx.try_send(result) {
            self.debug("error", &format!("Failed to send transcript result: {}", e));
            return;
        }

        self.debug(
            "info",
            &format!(
                "{} transcript emitted ({} chars)",
                if is_final { "Final" } else { "Interim" },
                text.chars().count()
            ),
        );

        if is_final {
            self.segment_counter += 1;
        }
    }

    fn decode_buffer(&self) -> Result<String, String> {
        self.decode_samples(&self.speech_buffer)
    }

    fn reset_segment(&mut self) {
        self.speech_buffer.clear();
        self.silence_samples = 0;
        self.last_interim_at = None;
    }
}

#[async_trait]
impl STTProvider for SherpaNemoTransducerSTT {
    fn provider_name(&self) -> &str {
        "Sherpa-ONNX NeMo Transducer"
    }

    fn provider_type(&self) -> STTProviderType {
        self.provider_type.clone()
    }

    async fn start_stream(
        &mut self,
        result_tx: mpsc::Sender<TranscriptResult>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if self.is_streaming {
            return Err("Stream already active".into());
        }

        let files = crate::stt::local_engines::model_discovery::discover_model_files(&self.model_dir)
            .map_err(|e| format!("Model discovery failed in {}: {}", self.model_dir.display(), e))?;

        self.debug(
            "info",
            &format!(
                "Starting with model_dir={}, encoder={}, decoder={}, joiner={}, tokens={}, lang={}",
                self.model_dir.display(),
                files.encoder.file_name().unwrap_or_default().to_string_lossy(),
                files.decoder.file_name().unwrap_or_default().to_string_lossy(),
                files.joiner.file_name().unwrap_or_default().to_string_lossy(),
                files.tokens.file_name().unwrap_or_default().to_string_lossy(),
                self.language
            ),
        );

        let recognizer = Self::create_recognizer(&files)?;

        self.result_tx = Some(result_tx);
        self.recognizer = Some(recognizer);
        self.is_streaming = true;
        Ok(())
    }

    async fn feed_audio(
        &mut self,
        chunk: AudioChunk,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if !self.is_streaming || chunk.pcm_data.is_empty() {
            return Ok(());
        }

        let samples: Vec<f32> = chunk
            .pcm_data
            .iter()
            .map(|sample| *sample as f32 / 32768.0)
            .collect();

        if chunk.is_speech {
            self.silence_samples = 0;
            self.speech_buffer.extend(samples);

            if self.speech_buffer.len() >= MIN_DECODE_SAMPLES {
                let should_emit_interim = self
                    .last_interim_at
                    .map(|last| last.elapsed().as_millis() >= INTERIM_INTERVAL_MS)
                    .unwrap_or(true);

                if should_emit_interim {
                    match self.decode_buffer() {
                        Ok(text) => self.maybe_emit_result(text, false),
                        Err(e) => self.debug("warn", &format!("Interim decode failed: {}", e)),
                    }
                    self.last_interim_at = Some(Instant::now());
                }
            }

            if self.speech_buffer.len() >= MAX_SEGMENT_SAMPLES {
                match self.decode_buffer() {
                    Ok(text) => self.maybe_emit_result(text, true),
                    Err(e) => self.debug("warn", &format!("Max-segment decode failed: {}", e)),
                }
                self.reset_segment();
            }
        } else if !self.speech_buffer.is_empty() {
            self.silence_samples += samples.len();
            if self.silence_samples >= FINAL_SILENCE_SAMPLES
                && self.speech_buffer.len() >= MIN_DECODE_SAMPLES
            {
                match self.decode_buffer() {
                    Ok(text) => self.maybe_emit_result(text, true),
                    Err(e) => self.debug("warn", &format!("Final decode failed: {}", e)),
                }
                self.reset_segment();
            }
        }

        Ok(())
    }

    async fn stop_stream(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if !self.is_streaming {
            return Ok(());
        }

        self.debug("info", "Stopping stream");
        if !self.speech_buffer.is_empty() && self.speech_buffer.len() >= MIN_DECODE_SAMPLES {
            match self.decode_buffer() {
                Ok(text) => self.maybe_emit_result(text, true),
                Err(e) => self.debug("warn", &format!("Stop flush decode failed: {}", e)),
            }
        }
        self.reset_segment();
        self.result_tx = None;
        self.recognizer = None;
        self.is_streaming = false;
        Ok(())
    }

    async fn test_connection(&self) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        crate::stt::local_engines::model_discovery::discover_model_files(&self.model_dir)
            .map(|_| true)
            .map_err(|e| format!("Model files not found: {}", e).into())
    }

    fn set_language(&mut self, language: &str) {
        self.language = language.to_string();
        log::info!("SherpaNemoTransducerSTT: Language set to {}", self.language);
    }
}
