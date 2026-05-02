import { useState, useEffect, useCallback } from "react";
import { useConfigStore } from "../stores/configStore";
import { showToast } from "../stores/toastStore";
import {
  getLLMProviders,
  setLLMProvider,
  listModels,
  setActiveModel,
  testLLMConnection,
  storeApiKey,
  getApiKey,
  hasApiKey,
  listOpenRouterModels,
} from "../lib/ipc";
import type { LLMProviderType, ModelInfo, OpenRouterModel } from "../lib/types";
import { OpenRouterModelCatalog } from "./openrouter/OpenRouterModelCatalog";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  Wifi,
  Server,
  Cloud,
  Settings2,
  Zap,
} from "lucide-react";
import { t } from "../i18n";

type ConnectionStatus = "idle" | "testing" | "success" | "error";

const PROVIDER_DISPLAY: Record<
  LLMProviderType,
  { label: string; description: string; requiresKey: boolean; isLocal: boolean }
> = {
  ollama: { label: "Ollama", description: t("settings.llm.providers.descriptions.ollama"), requiresKey: false, isLocal: true },
  lm_studio: { label: "LM Studio", description: t("settings.llm.providers.descriptions.lmStudio"), requiresKey: false, isLocal: true },
  openai: { label: "OpenAI", description: t("settings.llm.providers.descriptions.openai"), requiresKey: true, isLocal: false },
  anthropic: { label: "Anthropic", description: t("settings.llm.providers.descriptions.anthropic"), requiresKey: true, isLocal: false },
  groq: { label: "Groq", description: t("settings.llm.providers.descriptions.groq"), requiresKey: true, isLocal: false },
  gemini: { label: "Google Gemini", description: t("settings.llm.providers.descriptions.gemini"), requiresKey: true, isLocal: false },
  openrouter: { label: "OpenRouter", description: t("settings.llm.providers.descriptions.openrouter"), requiresKey: true, isLocal: false },
  custom: { label: "Custom", description: t("settings.llm.providers.descriptions.custom"), requiresKey: false, isLocal: false },
};

const ALL_PROVIDERS: LLMProviderType[] = [
  "ollama", "lm_studio", "openai", "anthropic", "groq", "gemini", "openrouter", "custom",
];

// Filter out known embedding-only models
const EMBEDDING_ONLY_PATTERNS = [
  "all-minilm", "mxbai-embed", "nomic-embed", "bge-",
  "text-embedding", "snowflake-arctic-embed", "jina-embeddings",
];

function filterChatModels(models: ModelInfo[]): ModelInfo[] {
  return models.filter(
    (m) => !EMBEDDING_ONLY_PATTERNS.some((p) => m.id.toLowerCase().includes(p))
  );
}

// ── Badge state logic ──
// Uses verifiedCloudProviders (persisted after successful test) for accurate readiness.
type BadgeVariant = "ready" | "has-key" | "no-key" | "local" | "not-configured";
interface BadgeState {
  text: string;
  variant: BadgeVariant;
}

function getBadgeState(
  providerType: LLMProviderType,
  verifiedProviders: string[],
  keyExists: boolean,
): BadgeState {
  const info = PROVIDER_DISPLAY[providerType];

  // Verified providers (test passed) → Ready
  if (verifiedProviders.includes(providerType)) {
    return { text: t("settings.llm.badges.ready"), variant: "ready" };
  }

  // Local providers — not verified yet
  if (info.isLocal) {
    return { text: t("settings.llm.badges.local"), variant: "local" };
  }

  // Cloud providers
  if (info.requiresKey) {
    if (keyExists) {
      return { text: t("settings.llm.badges.hasKey"), variant: "has-key" };
    }
    return { text: t("settings.llm.badges.noKey"), variant: "no-key" };
  }

  // Custom — not configured
  return { text: t("settings.llm.badges.configure"), variant: "not-configured" };
}

const BADGE_STYLES: Record<BadgeVariant, string> = {
  "ready": "bg-success/10 text-success border-success/20",
  "has-key": "bg-info/10 text-info border-info/20",
  "no-key": "bg-destructive/10 text-destructive border-destructive/20",
  "local": "bg-info/10 text-info border-info/20",
  "not-configured": "bg-muted text-muted-foreground border-border/30",
};

const DOT_STYLES: Record<BadgeVariant, string> = {
  "ready": "bg-success",
  "has-key": "bg-info",
  "no-key": "bg-destructive",
  "local": "bg-info",
  "not-configured": "bg-muted-foreground/30",
};

// ══════════════════════════════════════════════════════════════

export function LLMSettings() {
  const llmProvider = useConfigStore((s) => s.llmProvider);
  const llmModel = useConfigStore((s) => s.llmModel);
  const setConfigProvider = useConfigStore((s) => s.setLLMProvider);
  const setConfigModel = useConfigStore((s) => s.setLLMModel);
  const verifiedCloudProviders = useConfigStore((s) => s.verifiedCloudProviders);
  const setVerifiedCloudProviders = useConfigStore((s) => s.setVerifiedCloudProviders);

  const [selectedProvider, setSelectedProvider] = useState<LLMProviderType>(llmProvider);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModel[]>([]);
  const [selectedModel, setSelectedModel] = useState(llmModel);
  const [apiKey, setApiKeyValue] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [connectionMessage, setConnectionMessage] = useState("");
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState("");
  const [keyStatusMap, setKeyStatusMap] = useState<Record<string, boolean>>({});

  // Custom provider fields
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [customAuthType, setCustomAuthType] = useState<"none" | "bearer" | "api_key">("none");
  const [customAuthValue, setCustomAuthValue] = useState("");

  // Check which providers have stored API keys (for badge display)
  useEffect(() => {
    async function checkAllKeys() {
      const cloudProviders = ["openai", "anthropic", "groq", "gemini", "openrouter"];
      const status: Record<string, boolean> = {};
      for (const p of cloudProviders) {
        try { status[p] = await hasApiKey(p); } catch { status[p] = false; }
      }
      setKeyStatusMap(status);
    }
    checkAllKeys();
  }, []);

  // Load API key when provider changes
  useEffect(() => {
    const info = PROVIDER_DISPLAY[selectedProvider];
    if (info?.requiresKey) {
      getApiKey(selectedProvider)
        .then((key) => setApiKeyValue(key || ""))
        .catch(() => setApiKeyValue(""));
    } else {
      setApiKeyValue("");
    }
    setConnectionStatus("idle");
    setConnectionMessage("");
    setModels([]);
    setOpenRouterModels([]);
    setModelsError("");
  }, [selectedProvider]);

  // Build the provider config JSON for backend calls
  const buildProviderConfig = useCallback(() => {
    const config: Record<string, unknown> = { provider_type: selectedProvider };
    if (apiKey) config.api_key = apiKey;
    if (selectedProvider === "custom") {
      if (customBaseUrl) config.base_url = customBaseUrl;
      if (customAuthType !== "none") {
        config.auth_type = customAuthType;
        config.auth_value = customAuthValue;
      }
    }
    return JSON.stringify(config);
  }, [selectedProvider, apiKey, customBaseUrl, customAuthType, customAuthValue]);

  const handleProviderChange = (provider: LLMProviderType) => {
    setSelectedProvider(provider);
    setSelectedModel("");
    setModels([]);
    setOpenRouterModels([]);
    setConnectionStatus("idle");
    setConnectionMessage("");
    setModelsError("");
  };

  const handleSaveApiKey = async () => {
    if (!apiKey) return;
    try {
      await storeApiKey(selectedProvider, apiKey);
      setKeyStatusMap((prev) => ({ ...prev, [selectedProvider]: true }));
    } catch {
      showToast(t("settings.llm.apiKey.saveFailed"), "error");
    }
  };

  // Test connection — on success, add to verifiedCloudProviders
  const handleTestConnection = async () => {
    setConnectionStatus("testing");
    setConnectionMessage("");
    try {
      if (apiKey) await storeApiKey(selectedProvider, apiKey).catch(() => {});
      const configJson = buildProviderConfig();
      const success = await testLLMConnection(configJson);
      if (success) {
        setConnectionStatus("success");
        setConnectionMessage(t("settings.llm.connection.connected"));
        await setLLMProvider(configJson).catch(() => {});
        setConfigProvider(selectedProvider);
        // Mark as verified
        if (!verifiedCloudProviders.includes(selectedProvider)) {
          setVerifiedCloudProviders([...verifiedCloudProviders, selectedProvider]);
        }
        setKeyStatusMap((prev) => ({ ...prev, [selectedProvider]: true }));
      } else {
        setConnectionStatus("error");
        setConnectionMessage(t("settings.llm.connection.failed"));
      }
    } catch (err) {
      setConnectionStatus("error");
      setConnectionMessage(err instanceof Error ? err.message : t("settings.llm.connection.failed"));
    }
  };

  const handleLoadModels = async () => {
    setModelsLoading(true);
    setModelsError("");
    setModels([]);
    // Don't clear openRouterModels here — keep showing existing catalog during refresh
    try {
      if (apiKey) await storeApiKey(selectedProvider, apiKey).catch(() => {});

      if (selectedProvider === "openrouter") {
        // Set provider on backend + configStore first
        const configJson = buildProviderConfig();
        await setLLMProvider(configJson).catch(() => {});
        setConfigProvider(selectedProvider);
        // Use enriched OpenRouter endpoint
        const orModels = await listOpenRouterModels(true);
        setOpenRouterModels(orModels);
        if (orModels.length === 0) {
          setModelsError(t("settings.llm.models.noTextModels"));
        }
      } else {
        // Use generic model listing for other providers
        const configJson = buildProviderConfig();
        await setLLMProvider(configJson).catch(() => {});
        setConfigProvider(selectedProvider);
        const modelList = await listModels(configJson);
        const chatModels = filterChatModels(modelList);
        setModels(chatModels);
        if (chatModels.length === 0) {
          setModelsError(
            modelList.length > 0
              ? t("settings.llm.models.noChatModels")
              : t("settings.llm.models.noModels")
          );
        }
      }
    } catch (err) {
      setModelsError(err instanceof Error ? err.message : t("settings.llm.models.loadFailed"));
    } finally {
      setModelsLoading(false);
    }
  };

  const handleModelSelect = async (modelId: string) => {
    setSelectedModel(modelId);
    setConfigModel(modelId);
    try { await setActiveModel(selectedProvider, modelId); } catch {}
  };

  const info = PROVIDER_DISPLAY[selectedProvider];
  const requiresApiKey = info?.requiresKey ?? false;
  const isLocal = info?.isLocal ?? false;
  const isCustom = selectedProvider === "custom";

  return (
    <div className="space-y-6">
      {/* Active Provider + Model Banner */}
      <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-5 py-3.5">
        <Zap className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {t("settings.llm.active.label", {
              provider: PROVIDER_DISPLAY[llmProvider]?.label || llmProvider,
              model: llmModel ? ` / ${llmModel}` : t("settings.llm.active.noModelSelected"),
            })}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {llmModel
              ? t("settings.llm.active.usingProvider")
              : t("settings.llm.active.setupPrompt")}
          </p>
        </div>
      </div>

      {/* Provider Selection */}
      <div className="rounded-xl border border-border/30 bg-card/50 p-5">
        <h3 className="mb-3 text-sm font-semibold text-primary/80">{t("settings.llm.providers.title")}</h3>
        <div className="grid grid-cols-4 gap-2.5">
          {ALL_PROVIDERS.map((pType) => {
            const display = PROVIDER_DISPLAY[pType];
            const isSelected = selectedProvider === pType;
            const isActive = llmProvider === pType;
            const badge = getBadgeState(pType, verifiedCloudProviders, keyStatusMap[pType] ?? false);
            return (
              <button
                key={pType}
                onClick={() => handleProviderChange(pType)}
                aria-pressed={isSelected}
                className={`relative flex flex-col items-start rounded-xl border p-3 text-left transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border/50 hover:border-border hover:bg-accent/50"
                }`}
              >
                {/* Status badge */}
                <div className="absolute -top-1 -right-1">
                  <div
                    className={`h-2.5 w-2.5 rounded-full ring-2 ring-card ${
                      isActive && badge.variant === "ready" ? DOT_STYLES["ready"] : DOT_STYLES[badge.variant]
                    }`}
                    title={isActive ? t("settings.llm.badges.activeTitle", { status: badge.text }) : badge.text}
                    aria-hidden="true"
                  />
                </div>
                <div className="flex w-full items-center gap-1.5">
                  {display.isLocal ? (
                    <Server className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : pType === "custom" ? (
                    <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <Cloud className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className="text-xs font-medium truncate">{display.label}</span>
                </div>
                <span className="mt-0.5 text-meta text-muted-foreground line-clamp-1">
                  {display.description}
                </span>
                {/* Badge label */}
                <span className={`mt-1.5 inline-flex items-center rounded-full border px-1.5 py-0.5 text-meta font-medium ${BADGE_STYLES[badge.variant]}`}>
                  {badge.text}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* API Key Input (for cloud providers) */}
      {requiresApiKey && (
        <div className="rounded-xl border border-border/30 bg-card/50 p-5">
          <h3 className="mb-3 text-sm font-semibold text-primary/80">{t("settings.llm.apiKey.title")}</h3>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKeyValue(e.target.value)}
                onBlur={handleSaveApiKey}
                placeholder={t("settings.llm.apiKey.placeholder", {
                  provider: PROVIDER_DISPLAY[selectedProvider]?.label || selectedProvider,
                })}
                maxLength={256}
                className="w-full rounded-lg border border-border/50 bg-background px-3.5 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                title={showApiKey ? t("settings.llm.apiKey.hide") : t("settings.llm.apiKey.show")}
                aria-label={showApiKey ? t("settings.llm.apiKey.hideAria") : t("settings.llm.apiKey.showAria")}
                aria-pressed={showApiKey}
              >
                {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t("settings.llm.apiKey.storedSecurely")}
          </p>
        </div>
      )}

      {/* Custom Provider Config */}
      {isCustom && (
        <div className="space-y-4 rounded-xl border border-border/30 bg-card/50 p-5">
          <h3 className="text-sm font-semibold text-primary/80">{t("settings.llm.custom.title")}</h3>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">{t("settings.llm.custom.baseUrl")}</label>
            <input
              type="text"
              value={customBaseUrl}
              onChange={(e) => setCustomBaseUrl(e.target.value)}
              placeholder="http://localhost:8080/v1"
              maxLength={512}
              className="w-full rounded-lg border border-border/50 bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-foreground">{t("settings.llm.custom.authType")}</label>
              <select
                value={customAuthType}
                onChange={(e) => setCustomAuthType(e.target.value as "none" | "bearer" | "api_key")}
                className="w-full rounded-lg border border-border/50 bg-background px-3.5 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
              >
                <option value="none">{t("settings.llm.custom.authTypes.none")}</option>
                <option value="bearer">{t("settings.llm.custom.authTypes.bearer")}</option>
                <option value="api_key">{t("settings.llm.custom.authTypes.apiKey")}</option>
              </select>
            </div>
            {customAuthType !== "none" && (
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-medium text-foreground">
                  {customAuthType === "bearer" ? t("settings.llm.custom.token") : t("settings.llm.custom.apiKey")}
                </label>
                <input
                  type="password"
                  value={customAuthValue}
                  onChange={(e) => setCustomAuthValue(e.target.value)}
                  placeholder={customAuthType === "bearer"
                    ? t("settings.llm.custom.bearerPlaceholder")
                    : t("settings.llm.custom.apiKeyPlaceholder")}
                  maxLength={256}
                  className="w-full rounded-lg border border-border/50 bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Local Provider Status */}
      {isLocal && (
        <div className="flex items-center gap-3 rounded-xl border border-border/30 bg-accent/20 px-4 py-3">
          <Server className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">
            {selectedProvider === "ollama"
              ? t("settings.llm.localStatus.ollama")
              : t("settings.llm.localStatus.lmStudio")}
          </span>
        </div>
      )}

      {/* Connection Test & Model Loading */}
      <div className="rounded-xl border border-border/30 bg-card/50 p-5">
        <h3 className="mb-3 text-sm font-semibold text-primary/80">{t("settings.llm.connection.title")}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTestConnection}
            disabled={connectionStatus === "testing" || (requiresApiKey && !apiKey) || (isCustom && !customBaseUrl)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-background px-4 py-2 text-sm font-medium text-foreground transition-all duration-150 hover:bg-accent hover:-translate-y-px active:translate-y-px active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:scale-100 cursor-pointer"
          >
            {connectionStatus === "testing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
            {t("settings.llm.connection.test")}
          </button>
          <button
            onClick={handleLoadModels}
            disabled={modelsLoading || (requiresApiKey && !apiKey) || (isCustom && !customBaseUrl)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-background px-4 py-2 text-sm font-medium text-foreground transition-all duration-150 hover:bg-accent hover:-translate-y-px active:translate-y-px active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:scale-100 cursor-pointer"
          >
            {modelsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {t("settings.llm.connection.loadModels")}
          </button>
          {connectionStatus === "success" && (
            <div className="flex items-center gap-1 text-success">
              <CheckCircle className="h-3.5 w-3.5" />
              <span className="text-xs">{connectionMessage}</span>
            </div>
          )}
          {connectionStatus === "error" && (
            <div className="flex items-center gap-1 text-destructive">
              <XCircle className="h-3.5 w-3.5" />
              <span className="text-xs truncate max-w-[200px]">{connectionMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* Model Selection */}
      <div className="rounded-xl border border-border/30 bg-card/50 p-5">
        <h3 className="mb-3 text-sm font-semibold text-primary/80">{t("settings.llm.models.title")}</h3>
        {selectedProvider === "openrouter" && openRouterModels.length > 0 ? (
          <OpenRouterModelCatalog models={openRouterModels} />
        ) : models.length > 0 ? (
          <select
            value={selectedModel}
            onChange={(e) => handleModelSelect(e.target.value)}
            className="w-full rounded-lg border border-border/50 bg-background px-3.5 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 cursor-pointer"
          >
            <option value="">{t("settings.llm.models.select")}</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}{m.context_window ? ` (${t("settings.llm.models.contextWindow", { size: Math.round(m.context_window / 1000) })})` : ""}
              </option>
            ))}
          </select>
        ) : (
          <div className="rounded-lg border border-border/30 bg-accent/20 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {modelsError || (modelsLoading ? t("settings.llm.models.loading") : t("settings.llm.models.loadPrompt"))}
            </p>
          </div>
        )}
      </div>

      {/* Make Active button — only when different from active AND provider is ready */}
      {selectedProvider !== llmProvider && (
        <button
          onClick={async () => {
            try {
              if (apiKey) await storeApiKey(selectedProvider, apiKey).catch(() => {});
              const configJson = buildProviderConfig();
              await setLLMProvider(configJson);
              setConfigProvider(selectedProvider);
              if (!verifiedCloudProviders.includes(selectedProvider)) {
                setVerifiedCloudProviders([...verifiedCloudProviders, selectedProvider]);
              }
              if (selectedModel) {
                await setActiveModel(selectedProvider, selectedModel).catch(() => {});
                setConfigModel(selectedModel);
              }
            } catch {}
          }}
          className="w-full rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium text-primary transition-all duration-150 hover:bg-primary/10 hover:-translate-y-px active:translate-y-px active:scale-[0.99] cursor-pointer"
        >
          {t("settings.llm.actions.setActiveProvider", {
            provider: PROVIDER_DISPLAY[selectedProvider]?.label || selectedProvider,
          })}
        </button>
      )}
    </div>
  );
}
