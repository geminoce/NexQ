import { useState, useEffect, useCallback, useMemo } from "react";
import { useAIActionsStore } from "../stores/aiActionsStore";
import type { ActionConfig, InstructionPresets } from "../lib/types";
import { t } from "../i18n";
import {
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Trash2,
  Plus,
  MessageSquare,
  Zap,
  Layers,
  Sparkles,
  HelpCircle,
  X,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────

const BUILT_IN_MODES = [
  "Assist",
  "WhatToSay",
  "Shorten",
  "FollowUp",
  "Recap",
  "AskQuestion",
];

function getActionDescriptions(): Record<string, string> {
  return {
    Assist: t("settings.aiActions.actions.descriptions.Assist"),
    WhatToSay: t("settings.aiActions.actions.descriptions.WhatToSay"),
    Shorten: t("settings.aiActions.actions.descriptions.Shorten"),
    FollowUp: t("settings.aiActions.actions.descriptions.FollowUp"),
    Recap: t("settings.aiActions.actions.descriptions.Recap"),
    AskQuestion: t("settings.aiActions.actions.descriptions.AskQuestion"),
  };
}

function getActionNames(): Record<string, string> {
  return {
    Assist: t("settings.aiActions.actions.names.Assist"),
    WhatToSay: t("settings.aiActions.actions.names.WhatToSay"),
    Shorten: t("settings.aiActions.actions.names.Shorten"),
    FollowUp: t("settings.aiActions.actions.names.FollowUp"),
    Recap: t("settings.aiActions.actions.names.Recap"),
    AskQuestion: t("settings.aiActions.actions.names.AskQuestion"),
  };
}

function getToneOptions() {
  return [
    { label: t("settings.aiActions.responseStyle.tones.professional"), value: "Professional" },
    { label: t("settings.aiActions.responseStyle.tones.casual"), value: "Casual" },
    { label: t("settings.aiActions.responseStyle.tones.formal"), value: "Formal" },
    { label: t("settings.aiActions.responseStyle.tones.friendly"), value: "Friendly" },
    { label: t("settings.aiActions.responseStyle.tones.direct"), value: "Direct" },
  ];
}

function getFormatOptions() {
  return [
    { label: t("settings.aiActions.responseStyle.formats.bullets"), value: "bullets" },
    { label: t("settings.aiActions.responseStyle.formats.paragraphs"), value: "paragraphs" },
    { label: t("settings.aiActions.responseStyle.formats.numbered"), value: "numbered" },
    { label: t("settings.aiActions.responseStyle.formats.oneliner"), value: "oneliner" },
  ];
}

function getLengthOptions() {
  return [
    { label: t("settings.aiActions.responseStyle.lengths.brief"), value: "brief" },
    { label: t("settings.aiActions.responseStyle.lengths.standard"), value: "standard" },
    { label: t("settings.aiActions.responseStyle.lengths.detailed"), value: "detailed" },
  ];
}


/** Help content for each setting — shown via HelpButton/HelpPanel toggle */
function getHelp(): Record<string, { title: string; body: string }> {
  return {
    tone: {
      title: t("settings.aiActions.help.tone.title"),
      body: t("settings.aiActions.help.tone.body"),
    },
    format: {
      title: t("settings.aiActions.help.format.title"),
      body: t("settings.aiActions.help.format.body"),
    },
    length: {
      title: t("settings.aiActions.help.length.title"),
      body: t("settings.aiActions.help.length.body"),
    },
    instructions: {
      title: t("settings.aiActions.help.instructions.title"),
      body: t("settings.aiActions.help.instructions.body"),
    },
    autoTrigger: {
      title: t("settings.aiActions.help.autoTrigger.title"),
      body: t("settings.aiActions.help.autoTrigger.body"),
    },
    temperature: {
      title: t("settings.aiActions.help.temperature.title"),
      body: t("settings.aiActions.help.temperature.body"),
    },
    transcriptWindow: {
      title: t("settings.aiActions.help.transcriptWindow.title"),
      body: t("settings.aiActions.help.transcriptWindow.body"),
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────

function secsToMin(secs: number): number {
  return Math.round(secs / 60);
}

function minToSecs(min: number): number {
  return min * 60;
}

function formatWindowDisplay(seconds: number | null): string {
  if (seconds === null) return t("settings.aiActions.actions.default");
  if (seconds === 0) return t("settings.aiActions.actions.all");
  return t("settings.aiActions.actions.minutes", { count: secsToMin(seconds) });
}

/** Section header with icon badge */
function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-primary/80">{title}</h3>
        <p className="text-meta text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

/** Toggleable help icon — matches ContextStrategySettings pattern */
function HelpButton({
  id,
  activeId,
  onToggle,
}: {
  id: string;
  activeId: string | null;
  onToggle: (id: string | null) => void;
}) {
  const isOpen = activeId === id;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle(isOpen ? null : id);
      }}
      className={`inline-flex items-center justify-center rounded-full border transition-colors ${
        isOpen
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border/40 text-muted-foreground/60 hover:border-border/60 hover:text-muted-foreground"
      } h-[18px] w-[18px]`}
      title={t("settings.aiActions.help.showExplanation")}
    >
      {isOpen ? <X className="h-2.5 w-2.5" /> : <HelpCircle className="h-2.5 w-2.5" />}
    </button>
  );
}

/** Expandable help panel — matches ContextStrategySettings pattern */
function HelpPanel({ id }: { id: string }) {
  const content = getHelp()[id];
  if (!content) return null;
  return (
    <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-3 space-y-1">
      <p className="text-xs font-semibold text-primary/80">{content.title}</p>
      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
        {content.body}
      </p>
    </div>
  );
}

/** Small toggle switch (h-5 w-9) */
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
        checked ? "bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// ─── Main Component ──────────────────────────────────────

export function AIActionsSettings() {
  const configs = useAIActionsStore((s) => s.configs);
  const loadConfigs = useAIActionsStore((s) => s.loadConfigs);
  const updateGlobalDefaults = useAIActionsStore((s) => s.updateGlobalDefaults);
  const updateActionConfig = useAIActionsStore((s) => s.updateActionConfig);
  const resetActionPrompt = useAIActionsStore((s) => s.resetActionPrompt);
  const addCustomAction = useAIActionsStore((s) => s.addCustomAction);
  const removeCustomAction = useAIActionsStore((s) => s.removeCustomAction);
  const setInstructionPresets = useAIActionsStore((s) => s.setInstructionPresets);
  const setCustomInstructions = useAIActionsStore((s) => s.setCustomInstructions);

  const [expandedActions, setExpandedActions] = useState<Record<string, boolean>>({});
  const [expandedOverrides, setExpandedOverrides] = useState<Record<string, boolean>>({});
  const [showNewActionForm, setShowNewActionForm] = useState(false);
  const [newActionName, setNewActionName] = useState("");
  const [newActionPrompt, setNewActionPrompt] = useState("");
  const [openHelp, setOpenHelp] = useState<string | null>(null);
  const toneOptions = getToneOptions();
  const formatOptions = getFormatOptions();
  const lengthOptions = getLengthOptions();
  const actionDescriptions = getActionDescriptions();

  useEffect(() => {
    loadConfigs();
  }, []);

  const toggleExpanded = useCallback((mode: string) => {
    setExpandedActions((prev) => ({ ...prev, [mode]: !prev[mode] }));
  }, []);

  const toggleOverride = useCallback((mode: string) => {
    setExpandedOverrides((prev) => ({ ...prev, [mode]: !prev[mode] }));
  }, []);

  const handlePresetToggle = useCallback(
    (category: keyof InstructionPresets, value: string) => {
      const current = configs.instructionPresets[category];
      const newPresets: InstructionPresets = {
        ...configs.instructionPresets,
        [category]: current === value ? null : value,
      };
      setInstructionPresets(newPresets);
    },
    [configs.instructionPresets, setInstructionPresets]
  );

  const handleCustomInstructionsChange = useCallback(
    (text: string) => {
      setCustomInstructions(text);
    },
    [setCustomInstructions]
  );

  const handleGlobalDefaultChange = useCallback(
    (key: string, value: number | boolean) => {
      updateGlobalDefaults({ [key]: value });
    },
    [updateGlobalDefaults]
  );

  const handleActionToggleVisible = useCallback(
    (mode: string, visible: boolean) => {
      updateActionConfig(mode, { visible });
    },
    [updateActionConfig]
  );

  const handleActionPromptChange = useCallback(
    (mode: string, systemPrompt: string) => {
      updateActionConfig(mode, { systemPrompt, isDefaultPrompt: false });
    },
    [updateActionConfig]
  );

  const handleResetPrompt = useCallback(
    (mode: string) => {
      resetActionPrompt(mode);
    },
    [resetActionPrompt]
  );

  const handleContextToggle = useCallback(
    (mode: string, key: string, value: boolean) => {
      updateActionConfig(mode, { [key]: value });
    },
    [updateActionConfig]
  );

  const handleOverrideChange = useCallback(
    (mode: string, key: string, value: number | null) => {
      updateActionConfig(mode, { [key]: value });
    },
    [updateActionConfig]
  );

  const handleAddCustomAction = useCallback(() => {
    if (!newActionName.trim() || !newActionPrompt.trim()) return;
    addCustomAction(newActionName.trim(), newActionPrompt.trim());
    setNewActionName("");
    setNewActionPrompt("");
    setShowNewActionForm(false);
  }, [newActionName, newActionPrompt, addCustomAction]);

  const handleRemoveCustomAction = useCallback(
    (mode: string) => {
      removeCustomAction(mode);
    },
    [removeCustomAction]
  );

  const toggleHelp = useCallback((id: string | null) => {
    setOpenHelp((prev) => (prev === id ? null : id));
  }, []);

  const builtInActions = useMemo(() => {
    return BUILT_IN_MODES.map((mode) => configs.actions[mode]).filter(Boolean);
  }, [configs.actions]);

  const customActions = useMemo(() => {
    return Object.values(configs.actions).filter((a) => !a.isBuiltIn);
  }, [configs.actions]);

  const instructionTokens = useMemo(() => {
    const chars = configs.customInstructions.length;
    return Math.ceil(chars / 4);
  }, [configs.customInstructions]);

  const presetSummary = useMemo(() => {
    const parts: string[] = [];
    const p = configs.instructionPresets;
    if (p.tone) {
      const toneLabel = toneOptions.find((opt) => opt.value === p.tone)?.label ?? p.tone;
      parts.push(t("settings.aiActions.responseStyle.summary.tone", { tone: toneLabel }));
    }
    if (p.format) {
      const fm: Record<string, string> = {
        bullets: t("settings.aiActions.responseStyle.summary.bullets"),
        paragraphs: t("settings.aiActions.responseStyle.summary.paragraphs"),
        numbered: t("settings.aiActions.responseStyle.summary.numbered"),
        oneliner: t("settings.aiActions.responseStyle.summary.oneliner"),
      };
      parts.push(
        fm[p.format] ||
          t("settings.aiActions.responseStyle.summary.formatFallback", { format: p.format })
      );
    }
    if (p.length) {
      const lm: Record<string, string> = {
        brief: t("settings.aiActions.responseStyle.summary.brief"),
        standard: t("settings.aiActions.responseStyle.summary.standard"),
        detailed: t("settings.aiActions.responseStyle.summary.detailed"),
      };
      parts.push(
        lm[p.length] ||
          t("settings.aiActions.responseStyle.summary.lengthFallback", { length: p.length })
      );
    }
    return parts.join(" ");
  }, [configs.instructionPresets, toneOptions]);

  const globalWindowMin = secsToMin(configs.globalDefaults.transcriptWindowSeconds);

  return (
    <div className="space-y-5">
      {/* ═══ Two-column grid: Response Style │ Behavior + Context ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ─── Left Column: Response Style ─── */}
        <div className="rounded-xl border border-border/30 bg-card/50 p-4">
          <SectionHeader
            icon={MessageSquare}
            title={t("settings.aiActions.responseStyle.title")}
            subtitle={t("settings.aiActions.responseStyle.description")}
          />

          <div className="space-y-4">
            {/* Tone */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                {t("settings.aiActions.responseStyle.tone")}
                <HelpButton id="tone" activeId={openHelp} onToggle={toggleHelp} />
              </label>
              {openHelp === "tone" && <HelpPanel id="tone" />}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {toneOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handlePresetToggle("tone", opt.value)}
                    className={`rounded-full px-3 py-1 text-xs font-medium cursor-pointer transition-colors duration-150 ${
                      configs.instructionPresets.tone === opt.value
                        ? "bg-primary/20 text-primary ring-1 ring-primary/20"
                        : "text-muted-foreground hover:bg-accent/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Format */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                {t("settings.aiActions.responseStyle.format")}
                <HelpButton id="format" activeId={openHelp} onToggle={toggleHelp} />
              </label>
              {openHelp === "format" && <HelpPanel id="format" />}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {formatOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handlePresetToggle("format", opt.value)}
                    className={`rounded-full px-3 py-1 text-xs font-medium cursor-pointer transition-colors duration-150 ${
                      configs.instructionPresets.format === opt.value
                        ? "bg-primary/20 text-primary ring-1 ring-primary/20"
                        : "text-muted-foreground hover:bg-accent/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Length */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                {t("settings.aiActions.responseStyle.length")}
                <HelpButton id="length" activeId={openHelp} onToggle={toggleHelp} />
              </label>
              {openHelp === "length" && <HelpPanel id="length" />}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {lengthOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handlePresetToggle("length", opt.value)}
                    className={`rounded-full px-3 py-1 text-xs font-medium cursor-pointer transition-colors duration-150 ${
                      configs.instructionPresets.length === opt.value
                        ? "bg-primary/20 text-primary ring-1 ring-primary/20"
                        : "text-muted-foreground hover:bg-accent/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Active preset summary */}
            {presetSummary && (
              <div className="rounded-lg border border-primary/10 bg-primary/5 px-3 py-2 flex items-center gap-2">
                <span className="text-meta font-semibold text-primary/80 uppercase tracking-wider shrink-0">
                  {t("settings.aiActions.responseStyle.active")}
                </span>
                <span className="text-xs text-foreground/80">{presetSummary}</span>
              </div>
            )}

            <div className="h-px bg-border/20" />

            {/* Additional Instructions */}
            <div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  {t("settings.aiActions.responseStyle.additionalInstructions")}
                  <HelpButton id="instructions" activeId={openHelp} onToggle={toggleHelp} />
                </label>
                <div className="flex items-center gap-3 text-meta text-muted-foreground/70">
                  <span>{t("settings.aiActions.responseStyle.chars", { count: configs.customInstructions.length })}</span>
                  <span>{t("settings.aiActions.responseStyle.tokens", { count: instructionTokens })}</span>
                </div>
              </div>
              {openHelp === "instructions" && <HelpPanel id="instructions" />}
              <textarea
                rows={3}
                value={configs.customInstructions}
                onChange={(e) => handleCustomInstructionsChange(e.target.value)}
                placeholder={t("settings.aiActions.responseStyle.additionalInstructionsPlaceholder")}
                className="mt-2 w-full resize-none rounded-lg border border-border/50 bg-secondary/30 px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
              />
            </div>
          </div>
        </div>

        {/* ─── Right Column: Behavior + Context ─── */}
        <div className="space-y-5">
          {/* AI Behavior */}
          <div className="rounded-xl border border-border/30 bg-card/50 p-4">
            <SectionHeader
              icon={Zap}
              title={t("settings.aiActions.behavior.title")}
              subtitle={t("settings.aiActions.behavior.description")}
            />

            <div className="space-y-4">
              {/* Auto-Trigger */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    {t("settings.aiActions.behavior.autoTrigger")}
                    <HelpButton id="autoTrigger" activeId={openHelp} onToggle={toggleHelp} />
                  </label>
                  <Toggle
                    checked={configs.globalDefaults.autoTrigger}
                    onChange={(v) => handleGlobalDefaultChange("autoTrigger", v)}
                    label={t("settings.aiActions.behavior.toggleAutoTrigger")}
                  />
                </div>
                {openHelp === "autoTrigger" && <HelpPanel id="autoTrigger" />}
              </div>

              <div className="h-px bg-border/20" />

              {/* Temperature */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    {t("settings.aiActions.behavior.temperature")}
                    <HelpButton id="temperature" activeId={openHelp} onToggle={toggleHelp} />
                  </label>
                  <span className="rounded-md bg-secondary/50 px-2 py-0.5 text-xs font-medium tabular-nums text-foreground">
                    {configs.globalDefaults.temperature.toFixed(1)}
                  </span>
                </div>
                {openHelp === "temperature" && <HelpPanel id="temperature" />}
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={configs.globalDefaults.temperature}
                  onChange={(e) =>
                    handleGlobalDefaultChange("temperature", Number(e.target.value))
                  }
                  className="mt-2 w-full cursor-pointer accent-primary"
                />
                <div className="mt-1 flex justify-between text-meta text-muted-foreground/70">
                  <span>{t("settings.aiActions.behavior.precise")}</span>
                  <span>{t("settings.aiActions.behavior.creative")}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Context Window */}
          <div className="rounded-xl border border-border/30 bg-card/50 p-4">
            <SectionHeader
              icon={Layers}
              title={t("settings.aiActions.contextWindow.title")}
              subtitle={t("settings.aiActions.contextWindow.description")}
            />

            <div className="space-y-4">
              {/* Transcript Window */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    {t("settings.aiActions.contextWindow.transcriptWindow")}
                    <HelpButton id="transcriptWindow" activeId={openHelp} onToggle={toggleHelp} />
                  </label>
                  <span className="rounded-md bg-secondary/50 px-2 py-0.5 text-xs font-medium tabular-nums text-foreground">
                    {t("settings.aiActions.actions.minutes", { count: globalWindowMin })}
                  </span>
                </div>
                {openHelp === "transcriptWindow" && <HelpPanel id="transcriptWindow" />}
                <input
                  type="range"
                  min={1}
                  max={30}
                  step={1}
                  value={globalWindowMin}
                  onChange={(e) =>
                    handleGlobalDefaultChange(
                      "transcriptWindowSeconds",
                      minToSecs(Number(e.target.value))
                    )
                  }
                  className="mt-2 w-full cursor-pointer accent-primary"
                />
                <div className="mt-1 flex justify-between text-meta text-muted-foreground/70">
                  <span>{t("settings.aiActions.actions.minutes", { count: 1 })}</span>
                  <span>{t("settings.aiActions.actions.minutes", { count: 30 })}</span>
                </div>
              </div>

              <div className="h-px bg-border/20" />

              {/* RAG Chunks — reference to Context Strategy */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("settings.aiActions.contextWindow.ragChunks")}
                  </label>
                  <span className="text-xs text-muted-foreground/60">
                    {t("settings.aiActions.contextWindow.setInContextStrategy")}
                  </span>
                </div>
                <p className="mt-1 text-meta text-muted-foreground/50">
                  {t("settings.aiActions.contextWindow.ragDescription")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Actions (full width) ═══ */}
      <div className="rounded-xl border border-border/30 bg-card/50 p-4">
        <SectionHeader
          icon={Sparkles}
          title={t("settings.aiActions.actions.title")}
          subtitle={t("settings.aiActions.actions.description")}
        />

        {/* Built-in Actions */}
        <div>
          <h4 className="text-meta font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2">
            {t("settings.aiActions.actions.builtIn", { count: builtInActions.length })}
          </h4>
          <div className="rounded-lg border border-border/20 divide-y divide-border/20 overflow-hidden">
            {builtInActions.map((action) => (
              <ActionCard
                key={action.mode}
                action={action}
                description={actionDescriptions[action.mode]}
                isExpanded={!!expandedActions[action.mode]}
                isOverrideExpanded={!!expandedOverrides[action.mode]}
                onToggleExpand={() => toggleExpanded(action.mode)}
                onToggleOverride={() => toggleOverride(action.mode)}
                onToggleVisible={(v) => handleActionToggleVisible(action.mode, v)}
                onPromptChange={(p) => handleActionPromptChange(action.mode, p)}
                onResetPrompt={() => handleResetPrompt(action.mode)}
                onContextToggle={(k, v) => handleContextToggle(action.mode, k, v)}
                onOverrideChange={(k, v) => handleOverrideChange(action.mode, k, v)}
                showReset={true}
              />
            ))}
          </div>
        </div>

        {/* Custom Actions */}
        <div className="mt-5">
          <h4 className="text-meta font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2">
            {t("settings.aiActions.actions.custom", { count: customActions.length })}
          </h4>

          {customActions.length > 0 && (
            <div className="rounded-lg border border-border/20 divide-y divide-border/20 overflow-hidden">
              {customActions.map((action) => (
                <ActionCard
                  key={action.mode}
                  action={action}
                  isExpanded={!!expandedActions[action.mode]}
                  isOverrideExpanded={!!expandedOverrides[action.mode]}
                  onToggleExpand={() => toggleExpanded(action.mode)}
                  onToggleOverride={() => toggleOverride(action.mode)}
                  onToggleVisible={(v) => handleActionToggleVisible(action.mode, v)}
                  onPromptChange={(p) => handleActionPromptChange(action.mode, p)}
                  onResetPrompt={undefined}
                  onContextToggle={(k, v) => handleContextToggle(action.mode, k, v)}
                  onOverrideChange={(k, v) => handleOverrideChange(action.mode, k, v)}
                  showReset={false}
                  onDelete={() => handleRemoveCustomAction(action.mode)}
                />
              ))}
            </div>
          )}

          {customActions.length === 0 && !showNewActionForm && (
            <p className="py-2 text-center text-meta text-muted-foreground/60">
              {t("settings.aiActions.actions.noCustomActions")}
            </p>
          )}

          {showNewActionForm && (
            <div className="rounded-lg border border-border/40 bg-secondary/20 p-3.5 space-y-2.5">
              <input
                type="text"
                value={newActionName}
                onChange={(e) => setNewActionName(e.target.value)}
                placeholder={t("settings.aiActions.actions.actionNamePlaceholder")}
                className="w-full rounded-lg border border-border/50 bg-secondary/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
              />
              <textarea
                rows={3}
                value={newActionPrompt}
                onChange={(e) => setNewActionPrompt(e.target.value)}
                placeholder={t("settings.aiActions.actions.systemPromptPlaceholder")}
                className="w-full resize-none rounded-lg border border-border/50 bg-secondary/30 px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddCustomAction}
                  disabled={!newActionName.trim() || !newActionPrompt.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="h-3 w-3" />
                  {t("settings.aiActions.actions.add")}
                </button>
                <button
                  onClick={() => {
                    setShowNewActionForm(false);
                    setNewActionName("");
                    setNewActionPrompt("");
                  }}
                  className="rounded-lg border border-border/50 bg-secondary/30 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          )}

          {!showNewActionForm && (
            <button
              onClick={() => setShowNewActionForm(true)}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/50 py-2 text-xs font-medium text-muted-foreground cursor-pointer transition-colors duration-150 hover:border-primary/30 hover:text-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("settings.aiActions.actions.addCustomAction")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Action Card ─────────────────────────────────────────

interface ActionCardProps {
  action: ActionConfig;
  description?: string;
  isExpanded: boolean;
  isOverrideExpanded: boolean;
  onToggleExpand: () => void;
  onToggleOverride: () => void;
  onToggleVisible: (visible: boolean) => void;
  onPromptChange: (prompt: string) => void;
  onResetPrompt: (() => void) | undefined;
  onContextToggle: (key: string, value: boolean) => void;
  onOverrideChange: (key: string, value: number | null) => void;
  showReset: boolean;
  onDelete?: () => void;
}

function ActionCard({
  action,
  description,
  isExpanded,
  isOverrideExpanded,
  onToggleExpand,
  onToggleOverride,
  onToggleVisible,
  onPromptChange,
  onResetPrompt,
  onContextToggle,
  onOverrideChange,
  showReset,
  onDelete,
}: ActionCardProps) {
  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete?.();
    },
    [onDelete]
  );

  const windowDisplayMin =
    action.transcriptWindowSeconds !== null
      ? action.transcriptWindowSeconds === 0
        ? 0
        : secsToMin(action.transcriptWindowSeconds)
      : null;
  const displayName = getActionNames()[action.mode] ?? action.name;

  return (
    <div>
      {/* Compact header row */}
      <button
        onClick={onToggleExpand}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors duration-150 hover:bg-secondary/20"
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground/70 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground/70 shrink-0" />
        )}
        <span className="text-xs font-medium text-foreground shrink-0">
          {displayName}
        </span>
        {description && (
          <span className="hidden sm:inline text-meta text-muted-foreground/60 truncate">
            &mdash; {description}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {onDelete && (
            <button
              onClick={handleDeleteClick}
              className="rounded-md p-1 text-muted-foreground/60 transition-colors duration-150 hover:bg-destructive/10 hover:text-destructive"
              aria-label={t("settings.aiActions.actions.deleteAction", { name: displayName })}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
          <Toggle
            checked={action.visible}
            onChange={(v) => onToggleVisible(v)}
            label={t("settings.aiActions.actions.toggleVisibility", { name: displayName })}
          />
        </div>
      </button>

      {/* Expanded configuration */}
      {isExpanded && (
        <div className="border-t border-border/20 bg-secondary/10 px-3.5 py-3.5 space-y-3.5">
          {/* Purpose */}
          {description && (
            <p className="text-xs text-muted-foreground/80 italic">
              {description}
            </p>
          )}

          {/* System Prompt */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t("settings.aiActions.actions.systemPrompt")}
              </label>
              {showReset && onResetPrompt && (
                <button
                  onClick={onResetPrompt}
                  disabled={action.isDefaultPrompt}
                  className="flex items-center gap-1 text-meta font-medium text-muted-foreground transition-colors duration-150 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="h-3 w-3" />
                  {t("settings.aiActions.actions.reset")}
                </button>
              )}
            </div>
            <textarea
              rows={3}
              value={action.systemPrompt}
              onChange={(e) => onPromptChange(e.target.value)}
              className="w-full resize-none rounded-lg border border-border/50 bg-secondary/30 px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
            />
          </div>

          {/* Context Sources — two-column grid */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {t("settings.aiActions.actions.contextSources")}
            </label>
            <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {[
                { key: "includeTranscript", label: t("settings.aiActions.actions.sources.transcript"), checked: action.includeTranscript },
                { key: "includeRagChunks", label: t("settings.aiActions.actions.sources.ragChunks"), checked: action.includeRagChunks },
                { key: "includeCustomInstructions", label: t("settings.aiActions.actions.sources.customInstructions"), checked: action.includeCustomInstructions },
                { key: "includeDetectedQuestion", label: t("settings.aiActions.actions.sources.detectedQuestion"), checked: action.includeDetectedQuestion },
              ].map(({ key, label, checked }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onContextToggle(key, e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-border/50 accent-primary"
                  />
                  <span className="text-xs text-foreground">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Override Defaults (Collapsible) */}
          <div>
            <button
              onClick={onToggleOverride}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              {isOverrideExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {t("settings.aiActions.actions.overrideDefaults")}
            </button>

            {isOverrideExpanded && (
              <div className="mt-2.5 space-y-3 rounded-lg border border-border/30 bg-secondary/10 p-3">
                {/* Transcript Window Override */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-meta font-medium text-muted-foreground">
                      {t("settings.aiActions.actions.transcriptWindow")}
                    </label>
                    <span className="rounded bg-secondary/50 px-1.5 py-0.5 text-meta font-medium tabular-nums text-foreground">
                      {formatWindowDisplay(action.transcriptWindowSeconds)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={action.transcriptWindowSeconds !== null}
                        onChange={(e) =>
                          onOverrideChange(
                            "transcriptWindowSeconds",
                            e.target.checked ? 120 : null
                          )
                        }
                        className="h-3 w-3 rounded border-border/50 accent-primary"
                      />
                      <span className="text-meta text-muted-foreground">{t("settings.aiActions.actions.override")}</span>
                    </label>
                    {action.transcriptWindowSeconds !== null && (
                      <input
                        type="range"
                        min={0}
                        max={30}
                        step={1}
                        value={windowDisplayMin ?? 2}
                        onChange={(e) => {
                          const min = Number(e.target.value);
                          onOverrideChange(
                            "transcriptWindowSeconds",
                            min === 0 ? 0 : minToSecs(min)
                          );
                        }}
                        className="flex-1 cursor-pointer accent-primary"
                      />
                    )}
                  </div>
                  {action.transcriptWindowSeconds !== null && (
                    <div className="mt-1 flex justify-between text-meta text-muted-foreground/60">
                      <span>{t("settings.aiActions.actions.all")}</span>
                      <span>{t("settings.aiActions.actions.minutes", { count: 30 })}</span>
                    </div>
                  )}
                </div>

                {/* RAG Top-K Override */}
                <div className="flex items-center justify-between">
                  <label className="text-meta font-medium text-muted-foreground">
                    {t("settings.aiActions.actions.ragTopK")}
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={action.ragTopK !== null}
                        onChange={(e) =>
                          onOverrideChange("ragTopK", e.target.checked ? 5 : null)
                        }
                        className="h-3 w-3 rounded border-border/50 accent-primary"
                      />
                      <span className="text-meta text-muted-foreground">{t("settings.aiActions.actions.override")}</span>
                    </label>
                    {action.ragTopK !== null && (
                      <select
                        value={action.ragTopK}
                        onChange={(e) =>
                          onOverrideChange("ragTopK", Number(e.target.value))
                        }
                        className="rounded border border-border/50 bg-secondary/30 px-2 py-1 text-meta text-foreground focus:border-primary/50 focus:outline-none"
                      >
                        {[3, 5, 7, 10, 15, 20].map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Temperature Override */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-meta font-medium text-muted-foreground">
                      {t("settings.aiActions.actions.temperature")}
                    </label>
                    <span className="rounded bg-secondary/50 px-1.5 py-0.5 text-meta font-medium tabular-nums text-foreground">
                      {action.temperature === null
                        ? t("settings.aiActions.actions.default")
                        : action.temperature.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={action.temperature !== null}
                        onChange={(e) =>
                          onOverrideChange("temperature", e.target.checked ? 0.3 : null)
                        }
                        className="h-3 w-3 rounded border-border/50 accent-primary"
                      />
                      <span className="text-meta text-muted-foreground">{t("settings.aiActions.actions.override")}</span>
                    </label>
                    {action.temperature !== null && (
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.1}
                        value={action.temperature}
                        onChange={(e) =>
                          onOverrideChange("temperature", Number(e.target.value))
                        }
                        className="flex-1 cursor-pointer accent-primary"
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
