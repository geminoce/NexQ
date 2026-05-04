// Translation Settings — provider selector with API key management, language config, and behavior toggles.
// Follows the STT/LLM settings pattern: provider grid, API key input, test connection, make active.

import { useState, useEffect, useCallback } from "react";
import { useTranslationStore } from "../stores/translationStore";
import { useConfigStore } from "../stores/configStore";
import {
  setTranslationProvider,
  testTranslationConnection,
  getTranslationLanguages,
  storeApiKey,
  getApiKey,
  hasApiKey,
} from "../lib/ipc";
import type { TranslationProviderType, TranslationLanguage, TranslationConnectionStatus } from "../lib/types";
import {
  Globe,
  Cloud,
  Server,
  Layers,
  Brain,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Loader2,
  Wifi,
  Zap,
  Info,
} from "lucide-react";
import { OpusMtModelManager } from "./OpusMtModelManager";
import { listOpusMtModels } from "../lib/ipc";
import type { OpusMtModelStatus } from "../lib/types";
import { t } from "../i18n";

// ── Provider definitions ──

interface ProviderOption {
  value: TranslationProviderType;
  label: string;
  description: string;
  requiresApiKey: boolean;
  isLocal: boolean;
  credentialKey: string;
  needsRegion?: boolean;
  helpUrl?: string;
  helpLabel?: string;
}

const LOCAL_PROVIDERS: ProviderOption[] = [
  {
    value: "opus-mt",
    label: "OPUS-MT",
    description: t("settings.translation.providers.descriptions.opusMt"),
    requiresApiKey: false,
    isLocal: true,
    credentialKey: "",
  },
  {
    value: "llm",
    label: "LLM Translation",
    description: t("settings.translation.providers.descriptions.llm"),
    requiresApiKey: false,
    isLocal: true,
    credentialKey: "",
  },
];

const CLOUD_PROVIDERS: ProviderOption[] = [
  {
    value: "microsoft",
    label: "Microsoft Translator",
    description: t("settings.translation.providers.descriptions.microsoft"),
    requiresApiKey: true,
    isLocal: false,
    credentialKey: "translation_microsoft",
    needsRegion: true,
    helpUrl: "https://learn.microsoft.com/en-us/azure/cognitive-services/translator/quickstart-text-rest-api",
    helpLabel: t("settings.translation.providers.helpFreeKey"),
  },
  {
    value: "google",
    label: "Google Translate",
    description: t("settings.translation.providers.descriptions.google"),
    requiresApiKey: true,
    isLocal: false,
    credentialKey: "translation_google",
    helpUrl: "https://cloud.google.com/translate/docs/setup",
    helpLabel: t("settings.translation.providers.helpFreeKey"),
  },
  {
    value: "deepl",
    label: "DeepL",
    description: t("settings.translation.providers.descriptions.deepl"),
    requiresApiKey: true,
    isLocal: false,
    credentialKey: "translation_deepl",
    helpUrl: "https://www.deepl.com/pro-api",
    helpLabel: t("settings.translation.providers.helpFreeKey"),
  },
];

const ALL_PROVIDERS: ProviderOption[] = [...LOCAL_PROVIDERS, ...CLOUD_PROVIDERS];

// ── Languages (comprehensive default list) ──

const DEFAULT_TARGET_LANGUAGES = [
  { code: "af", name: "Afrikaans" },
  { code: "ar", name: "Arabic" },
  { code: "bn", name: "Bengali" },
  { code: "bg", name: "Bulgarian" },
  { code: "zh", name: "Chinese (Simplified)" },
  { code: "zh-TW", name: "Chinese (Traditional)" },
  { code: "cs", name: "Czech" },
  { code: "da", name: "Danish" },
  { code: "nl", name: "Dutch" },
  { code: "en", name: "English" },
  { code: "et", name: "Estonian" },
  { code: "fa", name: "Farsi (Persian)" },
  { code: "fi", name: "Finnish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "el", name: "Greek" },
  { code: "he", name: "Hebrew" },
  { code: "hi", name: "Hindi" },
  { code: "hu", name: "Hungarian" },
  { code: "id", name: "Indonesian" },
  { code: "it", name: "Italian" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ms", name: "Malay" },
  { code: "no", name: "Norwegian" },
  { code: "pl", name: "Polish" },
  { code: "pt", name: "Portuguese" },
  { code: "ro", name: "Romanian" },
  { code: "ru", name: "Russian" },
  { code: "sk", name: "Slovak" },
  { code: "sl", name: "Slovenian" },
  { code: "es", name: "Spanish" },
  { code: "sv", name: "Swedish" },
  { code: "th", name: "Thai" },
  { code: "tr", name: "Turkish" },
  { code: "uk", name: "Ukrainian" },
  { code: "ur", name: "Urdu" },
  { code: "vi", name: "Vietnamese" },
];

// ── Azure Regions ──

const AZURE_REGIONS = [
  "global",
  "eastus",
  "eastus2",
  "westus",
  "westus2",
  "centralus",
  "northeurope",
  "westeurope",
  "southeastasia",
  "eastasia",
  "japaneast",
  "australiaeast",
  "brazilsouth",
  "canadacentral",
  "uksouth",
];

// ── Badge logic ──

type BadgeVariant = "ready" | "available" | "no-key";
interface BadgeState { text: string; variant: BadgeVariant }

const BADGE_STYLES: Record<BadgeVariant, string> = {
  "ready": "bg-success/20 text-success border-success/20",
  "available": "bg-info/20 text-info border-info/20",
  "no-key": "bg-muted text-muted-foreground border-border/30",
};

// Status dot colors derived from badge variant
const DOT_COLORS: Record<BadgeVariant, string> = {
  "ready": "bg-success",
  "available": "bg-info",
  "no-key": "bg-muted-foreground/40",
};

type ConnectionStatus = "idle" | "testing" | "success" | "error";

// ══════════════════════════════════════════════════════════════

function getLanguageDisplayName(code: string, fallback: string): string {
  switch (code) {
    case "af": return t("settings.translation.language.names.af");
    case "ar": return t("settings.translation.language.names.ar");
    case "bn": return t("settings.translation.language.names.bn");
    case "bg": return t("settings.translation.language.names.bg");
    case "zh": return t("settings.translation.language.names.zh");
    case "zh-TW": return t("settings.translation.language.names.zhTW");
    case "cs": return t("settings.translation.language.names.cs");
    case "da": return t("settings.translation.language.names.da");
    case "nl": return t("settings.translation.language.names.nl");
    case "en": return t("settings.translation.language.names.en");
    case "et": return t("settings.translation.language.names.et");
    case "fa": return t("settings.translation.language.names.fa");
    case "fi": return t("settings.translation.language.names.fi");
    case "fr": return t("settings.translation.language.names.fr");
    case "de": return t("settings.translation.language.names.de");
    case "el": return t("settings.translation.language.names.el");
    case "he": return t("settings.translation.language.names.he");
    case "hi": return t("settings.translation.language.names.hi");
    case "hu": return t("settings.translation.language.names.hu");
    case "id": return t("settings.translation.language.names.id");
    case "it": return t("settings.translation.language.names.it");
    case "ja": return t("settings.translation.language.names.ja");
    case "ko": return t("settings.translation.language.names.ko");
    case "ms": return t("settings.translation.language.names.ms");
    case "no": return t("settings.translation.language.names.no");
    case "pl": return t("settings.translation.language.names.pl");
    case "pt": return t("settings.translation.language.names.pt");
    case "ro": return t("settings.translation.language.names.ro");
    case "ru": return t("settings.translation.language.names.ru");
    case "sk": return t("settings.translation.language.names.sk");
    case "sl": return t("settings.translation.language.names.sl");
    case "es": return t("settings.translation.language.names.es");
    case "sv": return t("settings.translation.language.names.sv");
    case "th": return t("settings.translation.language.names.th");
    case "tr": return t("settings.translation.language.names.tr");
    case "uk": return t("settings.translation.language.names.uk");
    case "ur": return t("settings.translation.language.names.ur");
    case "vi": return t("settings.translation.language.names.vi");
    default: return fallback;
  }
}

export function TranslationSettings() {
  const provider = useTranslationStore((s) => s.provider);
  const setStoreProvider = useTranslationStore((s) => s.setProvider);
  const targetLang = useTranslationStore((s) => s.targetLang);
  const setTargetLang = useTranslationStore((s) => s.setTargetLang);
  const sourceLang = useTranslationStore((s) => s.sourceLang);
  const setSourceLang = useTranslationStore((s) => s.setSourceLang);
  const displayMode = useTranslationStore((s) => s.displayMode);
  const setDisplayMode = useTranslationStore((s) => s.setDisplayMode);
  const autoTranslateEnabled = useTranslationStore((s) => s.autoTranslateEnabled);
  const setAutoTranslateEnabled = useTranslationStore((s) => s.setAutoTranslateEnabled);
  const selectionToolbarEnabled = useTranslationStore((s) => s.selectionToolbarEnabled);
  const setSelectionToolbarEnabled = useTranslationStore((s) => s.setSelectionToolbarEnabled);
  const cacheEnabled = useTranslationStore((s) => s.cacheEnabled);
  const setCacheEnabled = useTranslationStore((s) => s.setCacheEnabled);
  const showPostMeetingTranslation = useConfigStore((s) => s.showPostMeetingTranslation);
  const setShowPostMeetingTranslation = useConfigStore((s) => s.setShowPostMeetingTranslation);

  const [selectedProvider, setSelectedProvider] = useState<TranslationProviderType>(provider);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [keyDirty, setKeyDirty] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [responseMs, setResponseMs] = useState<number | null>(null);
  const [azureRegion, setAzureRegion] = useState("global");
  const [keyStatusMap, setKeyStatusMap] = useState<Record<string, boolean>>({});
  const [availableLanguages, setAvailableLanguages] = useState<TranslationLanguage[]>([]);
  const [testedProviders, setTestedProviders] = useState<Set<string>>(new Set());
  const [opusMtModels, setOpusMtModels] = useState<OpusMtModelStatus[]>([]);

  const currentProviderOption = ALL_PROVIDERS.find((p) => p.value === selectedProvider);

  // ── Load OPUS-MT model status for badge display + language filtering ──
  // Refreshes when the active provider changes (e.g., after activating a new model)

  const refreshOpusMtModels = useCallback((fresh?: OpusMtModelStatus[]) => {
    const apply = (models: OpusMtModelStatus[]) => {
      setOpusMtModels(models);
      // When OPUS-MT is active, sync targetLang to the active model's target
      if (provider === "opus-mt") {
        const active = models.find((m) => m.is_active);
        if (active && targetLang !== active.definition.target_lang) {
          setTargetLang(active.definition.target_lang);
          setSourceLang(active.definition.source_lang);
        }
      }
    };
    if (fresh) {
      apply(fresh);
    } else {
      listOpusMtModels().then(apply).catch(() => {});
    }
  }, [provider, targetLang, setTargetLang, setSourceLang]);

  useEffect(() => {
    refreshOpusMtModels();
  }, [provider, refreshOpusMtModels]);

  const opusMtDownloadedCount = opusMtModels.filter((m) => m.is_downloaded).length;
  const opusMtHasActive = opusMtModels.some((m) => m.is_active);

  // ── Check which cloud providers have stored keys (for badge display) ──

  useEffect(() => {
    async function checkAllKeys() {
      const status: Record<string, boolean> = {};
      for (const p of CLOUD_PROVIDERS) {
        try { status[p.credentialKey] = await hasApiKey(p.credentialKey); } catch { status[p.credentialKey] = false; }
      }
      setKeyStatusMap(status);
    }
    checkAllKeys();
  }, []);

  // ── Fetch languages from active provider on initial load ──

  useEffect(() => {
    async function fetchLanguages() {
      try {
        const langs = await getTranslationLanguages();
        if (langs.length > 0) setAvailableLanguages(langs);
      } catch { /* fallback to defaults */ }
    }
    fetchLanguages();
  }, []);

  // ── Load key when provider changes ──

  useEffect(() => {
    const loadKeyForProvider = async () => {
      setApiKey("");
      setShowApiKey(false);
      setHasStoredKey(false);
      setKeyDirty(false);
      setConnectionStatus("idle");
      setStatusMessage("");
      setResponseMs(null);

      if (!currentProviderOption?.requiresApiKey) return;

      const credKey = currentProviderOption.credentialKey;
      if (!credKey) return;

      try {
        const keyExists = await hasApiKey(credKey);
        setHasStoredKey(keyExists);
        if (keyExists) {
          const stored = await getApiKey(credKey);
          if (stored) setApiKey(stored);
        }
      } catch (e) {
        console.warn("Failed to load translation API key:", e);
      }

      if (currentProviderOption.needsRegion) {
        try {
          const regionExists = await hasApiKey("translation_microsoft_region");
          if (regionExists) {
            const stored = await getApiKey("translation_microsoft_region");
            if (stored) setAzureRegion(stored);
          }
        } catch (e) {
          console.warn("Failed to load Azure region:", e);
        }
      }
    };
    loadKeyForProvider();
  }, [selectedProvider, currentProviderOption?.credentialKey, currentProviderOption?.requiresApiKey, currentProviderOption?.needsRegion]);

  // ── Badge state ──

  function getBadgeState(p: ProviderOption): BadgeState {
    if (p.isLocal) {
      if (p.value === "llm") {
        return { text: t("settings.translation.badges.available"), variant: "available" };
      }
      // OPUS-MT — dynamic badge based on model presence
      if (p.value === "opus-mt") {
        if (opusMtHasActive) return { text: t("settings.translation.badges.ready"), variant: "ready" };
        if (opusMtDownloadedCount > 0) return { text: t("settings.translation.badges.models", { count: opusMtDownloadedCount }), variant: "available" };
        return { text: t("settings.translation.badges.noModels"), variant: "no-key" };
      }
      return { text: t("settings.translation.badges.notReady"), variant: "no-key" };
    }
    // Cloud providers
    if (testedProviders.has(p.value)) return { text: t("settings.translation.badges.ready"), variant: "ready" };
    if (keyStatusMap[p.credentialKey]) return { text: t("settings.translation.badges.hasKey"), variant: "available" };
    return { text: t("settings.translation.badges.noKey"), variant: "no-key" };
  }

  // ── Handlers ──

  const handleProviderSelect = (prov: TranslationProviderType) => {
    setSelectedProvider(prov);
    setConnectionStatus("idle");
    setStatusMessage("");
    setResponseMs(null);
  };

  const handleSaveAndTest = useCallback(async () => {
    if (!currentProviderOption?.requiresApiKey) return;
    if (!apiKey.trim()) return;

    setConnectionStatus("testing");
    setStatusMessage(t("settings.translation.connection.testingConnection"));
    setResponseMs(null);

    try {
      // Store the key in CredentialManager
      await storeApiKey(currentProviderOption.credentialKey, apiKey.trim());

      // Store region for Microsoft
      if (currentProviderOption.needsRegion && azureRegion.trim()) {
        await storeApiKey("translation_microsoft_region", azureRegion.trim());
      }

      // Temporarily set this provider on backend to test it
      const previousProvider = provider; // the currently active provider
      await setTranslationProvider(
        selectedProvider,
        currentProviderOption.needsRegion ? azureRegion : undefined
      );

      // Test the connection
      const result: TranslationConnectionStatus = await testTranslationConnection(selectedProvider);

      if (result.connected) {
        // Test passed — keep this provider active on backend
        setHasStoredKey(true);
        setKeyDirty(false);
        setConnectionStatus("success");
        setResponseMs(result.response_ms);
        setStatusMessage(
          t("settings.translation.connection.connectedWithAvailable", {
            count: result.language_count,
            ms: result.response_ms,
          })
        );
        setKeyStatusMap((prev) => ({ ...prev, [currentProviderOption.credentialKey]: true }));
        setTestedProviders((prev) => new Set(prev).add(selectedProvider));

        // Load available languages
        try {
          const langs = await getTranslationLanguages();
          if (langs.length > 0) setAvailableLanguages(langs);
        } catch { /* ignore — fallback to defaults */ }

        // Restore previous active provider on backend (don't change active yet — user must click Make Active)
        if (previousProvider && previousProvider !== selectedProvider) {
          await setTranslationProvider(previousProvider).catch(() => {});
        }
      } else {
        // Test failed — restore previous provider on backend
        if (previousProvider) {
          await setTranslationProvider(previousProvider).catch(() => {});
        }
        setConnectionStatus("error");
        setStatusMessage(result.error || t("settings.translation.connection.failed"));
      }
    } catch (e) {
      setConnectionStatus("error");
      setStatusMessage(typeof e === "string" ? e : e instanceof Error ? e.message : String(e));
    }
  }, [apiKey, azureRegion, selectedProvider, currentProviderOption, setStoreProvider]);

  const handleTestLocal = useCallback(async () => {

    setConnectionStatus("testing");
    setStatusMessage(t("settings.translation.connection.testing"));
    setResponseMs(null);

    try {
      await setTranslationProvider(selectedProvider);
      const result = await testTranslationConnection(selectedProvider);

      if (result.connected) {
        setConnectionStatus("success");
        setResponseMs(result.response_ms);
        setStatusMessage(
          t("settings.translation.connection.connectedWithCount", {
            count: result.language_count,
            ms: result.response_ms,
          })
        );
        setTestedProviders((prev) => new Set(prev).add(selectedProvider));
        setStoreProvider(selectedProvider);
      } else {
        setConnectionStatus("error");
        setStatusMessage(result.error || t("settings.translation.connection.failed"));
      }
    } catch (e) {
      setConnectionStatus("error");
      setStatusMessage(e instanceof Error ? e.message : t("settings.translation.connection.testFailed"));
    }
  }, [selectedProvider, setStoreProvider]);

  const handleMakeActive = useCallback(async () => {
    try {
      if (currentProviderOption?.requiresApiKey && apiKey) {
        await storeApiKey(currentProviderOption.credentialKey, apiKey).catch(() => {});
      }
      await setTranslationProvider(
        selectedProvider,
        currentProviderOption?.needsRegion ? azureRegion : undefined
      );
      setStoreProvider(selectedProvider);
    } catch { /* ignore */ }
  }, [selectedProvider, apiKey, azureRegion, currentProviderOption, setStoreProvider]);

  // ── Language list for dropdowns ──
  // Always use the comprehensive default list as the base.
  // If the provider returned additional languages not in the defaults, merge them in.

  const languageOptions = (() => {
    // When OPUS-MT is active, only show the active model's target language
    if (provider === "opus-mt" && opusMtModels.length > 0) {
      const activeModel = opusMtModels.find((m) => m.is_active);
      if (activeModel) {
        const code = activeModel.definition.target_lang;
        const match = DEFAULT_TARGET_LANGUAGES.find((l) => l.code === code);
        return match ? [match] : [{ code, name: activeModel.definition.target_name }];
      }
    }

    const base = [...DEFAULT_TARGET_LANGUAGES];
    if (availableLanguages.length > 0) {
      const existingCodes = new Set(base.map((l) => l.code));
      for (const pl of availableLanguages) {
        if (!existingCodes.has(pl.code)) {
          base.push({ code: pl.code, name: pl.name });
        }
      }
    }
    return base.sort((a, b) => a.name.localeCompare(b.name));
  })();

  const isCloud = currentProviderOption?.requiresApiKey ?? false;
  const isOpusMt = selectedProvider === "opus-mt";
  const isLlm = selectedProvider === "llm";

  // ── "Make Active" gating logic ──
  // Cloud: ONLY after successful test in this session. OPUS-MT: when model is active. LLM: always.
  const canMakeActive = (() => {
    if (selectedProvider === provider) return false; // already active
    if (isOpusMt) return opusMtHasActive;
    if (isCloud) return testedProviders.has(selectedProvider) && !keyDirty;
    if (isLlm) return true;
    return false;
  })();

  return (
    <div className="space-y-5">
      {/* ── Active Provider Banner (full-width above grid) ── */}
      <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-5 py-3.5">
        <Globe className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {t("settings.translation.active.label", {
              provider: ALL_PROVIDERS.find((p) => p.value === provider)?.label || provider,
              language: getLanguageDisplayName(
                targetLang,
                DEFAULT_TARGET_LANGUAGES.find((l) => l.code === targetLang)?.name || targetLang,
              ),
            })}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("settings.translation.active.description")}
          </p>
        </div>
        {connectionStatus === "success" && selectedProvider === provider && (
          <div className="flex items-center gap-1 text-success shrink-0">
            <CheckCircle className="h-3.5 w-3.5" />
            <span className="text-xs">{t("settings.translation.active.connected")}</span>
          </div>
        )}
      </div>

      {/* ── Two-column grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ═══ LEFT COLUMN: Provider-specific ═══ */}
        <div className="space-y-5">
          {/* ── Provider Selection Grid ── */}
          <div className="rounded-xl border border-border/30 bg-card/50 overflow-hidden">
            {/* Local & Offline */}
            <div className="px-5 pt-4 pb-3 border-b border-border/20 bg-muted/10">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-5 w-5 items-center justify-center rounded bg-success/10">
                  <Server className="h-3 w-3 text-success" />
                </div>
                <span className="text-xs font-semibold text-foreground">{t("settings.translation.providers.localTitle")}</span>
                <span className="ml-auto text-meta text-muted-foreground/60 font-medium uppercase tracking-wider">
                  {t("settings.translation.providers.localMeta")}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {LOCAL_PROVIDERS.map((p) => (
                  <ProviderCard
                    key={p.value}
                    provider={p}
                    isSelected={selectedProvider === p.value}
                    isActive={provider === p.value}
                    badge={getBadgeState(p)}
                    onClick={() => handleProviderSelect(p.value)}
                  />
                ))}
              </div>
            </div>

            {/* Cloud Providers */}
            <div className="px-5 pt-4 pb-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-5 w-5 items-center justify-center rounded bg-info/10">
                  <Cloud className="h-3 w-3 text-info" />
                </div>
                <span className="text-xs font-semibold text-foreground">{t("settings.translation.providers.cloudTitle")}</span>
                <span className="ml-auto text-meta text-muted-foreground/60 font-medium uppercase tracking-wider">
                  {t("settings.translation.providers.cloudMeta")}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {CLOUD_PROVIDERS.map((p) => (
                  <ProviderCard
                    key={p.value}
                    provider={p}
                    isSelected={selectedProvider === p.value}
                    isActive={provider === p.value}
                    badge={getBadgeState(p)}
                    onClick={() => handleProviderSelect(p.value)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* ── API Key Configuration (cloud providers only) ── */}
          {isCloud && (
            <div className="rounded-xl border border-border/30 bg-card/50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-primary/80">{t("settings.translation.apiKey.title")}</h3>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setKeyDirty(true);
                      setConnectionStatus("idle");
                      setStatusMessage("");
                    }}
                    placeholder={
                      hasStoredKey && !keyDirty
                        ? t("settings.translation.apiKey.storedPlaceholder")
                        : t("settings.translation.apiKey.enterPlaceholder", {
                          provider: currentProviderOption?.label || selectedProvider,
                        })
                    }
                    maxLength={256}
                    className="w-full rounded-lg border border-border/50 bg-background px-3.5 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                  />
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                    type="button"
                    aria-label={showApiKey ? t("settings.translation.apiKey.hide") : t("settings.translation.apiKey.show")}
                    aria-pressed={showApiKey}
                  >
                    {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {/* State 1: Key is new or changed → Save & Test */}
                {keyDirty && apiKey.trim() && (
                  <button
                    onClick={handleSaveAndTest}
                    disabled={connectionStatus === "testing"}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  >
                    {connectionStatus === "testing" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wifi className="h-3.5 w-3.5" />
                    )}
                    {t("settings.translation.apiKey.saveAndTest")}
                  </button>
                )}

                {/* State 2: Key stored, not yet tested this session → Test Connection */}
                {hasStoredKey && !keyDirty && !testedProviders.has(selectedProvider) && (
                  <button
                    onClick={handleSaveAndTest}
                    disabled={connectionStatus === "testing"}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  >
                    {connectionStatus === "testing" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wifi className="h-3.5 w-3.5" />
                    )}
                    {t("settings.translation.apiKey.testConnection")}
                  </button>
                )}

                {/* Clear stored key */}
                {hasStoredKey && !keyDirty && (
                  <button
                    onClick={async () => {
                      if (!currentProviderOption) return;
                      try {
                        const { deleteApiKey } = await import("../lib/ipc");
                        await deleteApiKey(currentProviderOption.credentialKey);
                        setHasStoredKey(false);
                        setApiKey("");
                        setConnectionStatus("idle");
                        setStatusMessage("");
                        setTestedProviders((prev) => {
                          const next = new Set(prev);
                          next.delete(selectedProvider);
                          return next;
                        });
                        setKeyStatusMap((prev) => ({ ...prev, [currentProviderOption.credentialKey]: false }));
                      } catch { /* ignore */ }
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                    title={t("settings.translation.apiKey.removeStored")}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    {t("settings.translation.apiKey.clear")}
                  </button>
                )}
              </div>

              {/* Help link */}
              {currentProviderOption?.helpUrl && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  <a
                    href={currentProviderOption.helpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary/70 hover:text-primary underline-offset-2 hover:underline"
                  >
                    {currentProviderOption.helpLabel || t("settings.translation.providers.helpFreeKey")} &rarr;
                  </a>
                </p>
              )}

              {/* Azure Region dropdown (Microsoft only) */}
              {currentProviderOption?.needsRegion && (
                <div className="mt-3">
                  <label className="mb-1.5 block text-xs font-medium text-foreground">{t("settings.translation.region.title")}</label>
                  <select
                    value={azureRegion}
                    onChange={(e) => setAzureRegion(e.target.value)}
                    className="w-full rounded-lg border border-border/50 bg-background px-3.5 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 cursor-pointer"
                  >
                    {AZURE_REGIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("settings.translation.region.help")}
                  </p>
                </div>
              )}

              {/* Status feedback */}
              <div className="mt-2 min-h-[18px]">
                {connectionStatus === "success" && (
                  <div className="flex items-center gap-1.5 text-xs text-success">
                    <CheckCircle className="h-3 w-3" />
                    {statusMessage}
                  </div>
                )}
                {connectionStatus === "error" && (
                  <div className="flex items-center gap-1.5 text-xs text-destructive">
                    <XCircle className="h-3 w-3" />
                    {statusMessage}
                  </div>
                )}
                {connectionStatus === "idle" && hasStoredKey && !keyDirty && (
                  <p className="text-xs text-success/70">
                    {t("settings.translation.apiKey.storedSecurely")}
                  </p>
                )}
                {connectionStatus === "idle" && !hasStoredKey && (
                  <p className="text-xs text-muted-foreground">
                    {t("settings.translation.apiKey.enterAndSave")}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── OPUS-MT Model Manager ── */}
          {isOpusMt && <OpusMtModelManager onModelsChanged={refreshOpusMtModels} />}

          {/* ── LLM local provider — Test Connection ── */}
          {isLlm && (
            <div className="rounded-xl border border-border/30 bg-card/50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-primary/80">{t("settings.translation.connection.title")}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTestLocal}
                  disabled={connectionStatus === "testing"}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-background px-4 py-2 text-sm font-medium text-foreground transition-all duration-150 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                  {connectionStatus === "testing" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Wifi className="h-3.5 w-3.5" />
                  )}
                  {t("settings.translation.connection.test")}
                </button>

                {canMakeActive && (
                  <button
                    onClick={handleMakeActive}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 cursor-pointer"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    {t("settings.translation.connection.makeActive")}
                  </button>
                )}

                {connectionStatus === "success" && (
                  <div className="flex items-center gap-1 text-success">
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span className="text-xs">{statusMessage}</span>
                  </div>
                )}
                {connectionStatus === "error" && (
                  <div className="flex items-center gap-1 text-destructive">
                    <XCircle className="h-3.5 w-3.5" />
                    <span className="text-xs">{statusMessage}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Make Active — full-width at bottom of left column */}
          {canMakeActive && (
            <button
              onClick={handleMakeActive}
              className="w-full rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium text-primary transition-all duration-150 hover:bg-primary/10 hover:-translate-y-px active:translate-y-px active:scale-[0.99] cursor-pointer"
            >
              {t("settings.translation.actions.setActiveProvider", {
                provider: currentProviderOption?.label || selectedProvider,
              })}
            </button>
          )}
        </div>

        {/* ═══ RIGHT COLUMN: Common settings ═══ */}
        <div className="space-y-5">
          {/* ── Language Settings ── */}
          <div className="rounded-xl border border-border/30 bg-card/50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-primary/80">{t("settings.translation.language.title")}</h3>

            {/* Banner: activate provider to see its languages */}
            {selectedProvider !== provider && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-info/20 bg-info/5 px-3 py-2">
                <Info className="h-3.5 w-3.5 text-info shrink-0" />
                <p className="text-xs text-muted-foreground">
                  {t("settings.translation.language.activateNotice", {
                    provider: currentProviderOption?.label || selectedProvider,
                  })}
                </p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">{t("settings.translation.language.target")}</label>
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="w-full rounded-lg border border-border/50 bg-background px-3.5 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 cursor-pointer"
                >
                  {languageOptions.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {getLanguageDisplayName(lang.code, lang.name)}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("settings.translation.language.targetHelp")}
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">{t("settings.translation.language.source")}</label>
                <select
                  value={sourceLang}
                  onChange={(e) => setSourceLang(e.target.value)}
                  className="w-full rounded-lg border border-border/50 bg-background px-3.5 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 cursor-pointer"
                >
                  <option value="auto">{t("settings.translation.language.autoDetect")}</option>
                  {languageOptions.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {getLanguageDisplayName(lang.code, lang.name)}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("settings.translation.language.sourceHelp")}
                </p>
              </div>
            </div>
          </div>

          {/* ── Behavior Toggles ── */}
          <div className="rounded-xl border border-border/30 bg-card/50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-primary/80">{t("settings.translation.behavior.title")}</h3>
            <div className="space-y-4">
              {/* Select-to-translate toolbar */}
              <ToggleRow
                label={t("settings.translation.behavior.selectionToolbar.label")}
                description={t("settings.translation.behavior.selectionToolbar.description")}
                checked={selectionToolbarEnabled}
                onChange={setSelectionToolbarEnabled}
              />

              {/* Show translations in post-meeting */}
              <ToggleRow
                label={t("settings.translation.behavior.postMeeting.label")}
                description={t("settings.translation.behavior.postMeeting.description")}
                checked={showPostMeetingTranslation}
                onChange={setShowPostMeetingTranslation}
              />

              {/* Cache translations */}
              <ToggleRow
                label={t("settings.translation.behavior.cache.label")}
                description={t("settings.translation.behavior.cache.description")}
                checked={cacheEnabled}
                onChange={setCacheEnabled}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Provider Card ──

function ProviderCard({
  provider,
  isSelected,
  isActive,
  badge,
  onClick,
}: {
  provider: ProviderOption;
  isSelected: boolean;
  isActive: boolean;
  badge: BadgeState;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={isSelected}
      className={`relative flex min-h-[90px] flex-col items-start rounded-xl border p-2.5 text-left transition-all duration-150 cursor-pointer ${
        isSelected
          ? "border-primary bg-primary/10 ring-1 ring-primary/20 shadow-sm"
          : "border-border/40 bg-card/30 hover:border-border/70 hover:bg-accent/60"
      }`}
    >
      {/* Status dot — color reflects actual badge state */}
      {isActive && (
        <div className="absolute -top-1 -right-1">
          <div
            className={`h-2.5 w-2.5 rounded-full ring-2 ring-card ${DOT_COLORS[badge.variant]}`}
            title={t("settings.translation.badges.activeTitle", { status: badge.text })}
            aria-hidden="true"
          />
        </div>
      )}
      <div className="mb-1 flex w-full items-start gap-1.5">
          <ProviderIcon value={provider.value} isSelected={isSelected} />
          <span className={`min-w-0 text-xs font-medium leading-tight ${isSelected ? "text-primary" : "text-foreground"}`}>
            {provider.label}
          </span>
      </div>
      <span className="text-meta text-muted-foreground/70 line-clamp-1 leading-tight">
        {provider.description}
      </span>
      <span
        className={`mt-auto inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[8px] font-semibold leading-none tracking-wide ${BADGE_STYLES[badge.variant]}`}
      >
        {badge.text}
      </span>
    </button>
  );
}

// ── Provider icon helper ──

function ProviderIcon({ value, isSelected }: { value: TranslationProviderType; isSelected?: boolean }) {
  const cls = `h-3.5 w-3.5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`;
  switch (value) {
    case "opus-mt":
      return <Layers className={cls} />;
    case "llm":
      return <Brain className={cls} />;
    case "microsoft":
      return <Cloud className={cls} />;
    case "google":
      return <Globe className={cls} />;
    case "deepl":
      return <Cloud className={cls} />;
    default:
      return <Server className={cls} />;
  }
}

// ── Toggle Row ──

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
          checked ? "bg-primary" : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? "translate-x-[18px]" : "translate-x-[3px]"
          }`}
        />
      </button>
    </div>
  );
}
