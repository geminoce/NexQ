import { useEffect, useCallback, useRef, useState } from "react";
import { X } from "lucide-react";
import type { ActionConfig } from "../lib/types";
import { t } from "../i18n";

interface PromptPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  actionConfig: ActionConfig;
  composedInstructions: string;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function PromptPreviewDialog({
  isOpen,
  onClose,
  actionConfig,
  composedInstructions,
}: PromptPreviewDialogProps) {
  const [isVisible, setIsVisible] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Animate in when opened
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => onClose(), 150);
  }, [onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) {
        handleClose();
      }
    },
    [handleClose]
  );

  if (!isOpen) return null;

  // Build the simulated user message sections
  const userMessageSections: string[] = [];

  if (actionConfig.includeRagChunks || actionConfig.includeCustomInstructions) {
    const parts: string[] = [];
    if (actionConfig.includeCustomInstructions && composedInstructions) {
      parts.push(composedInstructions);
    }
    if (actionConfig.includeRagChunks) {
      const topK = actionConfig.ragTopK ?? "default";
      parts.push(
        t("settings.aiActions.promptPreview.topRelevantChunks", { count: topK })
      );
    }
    userMessageSections.push(
      `## ${t("settings.aiActions.promptPreview.referenceMaterials")}\n${parts.join("\n\n")}`
    );
  }

  if (actionConfig.includeTranscript) {
    const windowSeconds = actionConfig.transcriptWindowSeconds;
    const windowLabel = windowSeconds
      ? t("settings.aiActions.promptPreview.lastSeconds", { seconds: windowSeconds })
      : t("settings.aiActions.promptPreview.globalDefaultWindow");
    userMessageSections.push(
      `## ${t("settings.aiActions.promptPreview.meetingTranscript")}\n${t("settings.aiActions.promptPreview.transcriptSegments", { window: windowLabel })}`
    );
  }

  if (actionConfig.includeDetectedQuestion) {
    userMessageSections.push(
      `## ${t("settings.aiActions.promptPreview.detectedQuestion")}\n${t("settings.aiActions.promptPreview.detectedQuestionPlaceholder")}`
    );
  }

  // Mode-specific instruction
  const modeInstructions: Record<string, string> = {
    Assist: t("settings.aiActions.promptPreview.modeInstructions.Assist"),
    WhatToSay: t("settings.aiActions.promptPreview.modeInstructions.WhatToSay"),
    Shorten: t("settings.aiActions.promptPreview.modeInstructions.Shorten"),
    FollowUp: t("settings.aiActions.promptPreview.modeInstructions.FollowUp"),
    Recap: t("settings.aiActions.promptPreview.modeInstructions.Recap"),
    AskQuestion: t("settings.aiActions.promptPreview.modeInstructions.AskQuestion"),
  };

  const modeInstruction =
    modeInstructions[actionConfig.mode] ??
    t("settings.aiActions.promptPreview.modeInstructionFallback", { mode: actionConfig.mode });
  userMessageSections.push(modeInstruction);

  const userMessage = userMessageSections.join("\n\n");
  const systemPrompt = actionConfig.systemPrompt;

  const systemTokens = estimateTokens(systemPrompt);
  const userTokens = estimateTokens(userMessage);
  const totalTokens = systemTokens + userTokens;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-150 ${
        isVisible
          ? "bg-black/60 backdrop-blur-sm"
          : "bg-black/0 backdrop-blur-none"
      }`}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("settings.aiActions.promptPreview.ariaLabel")}
        className={`w-full max-w-[600px] max-h-[80vh] flex flex-col rounded-xl border border-border/50 bg-card shadow-2xl transition-all duration-150 ${
          isVisible
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-2"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/30 px-5 py-3.5">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t("settings.aiActions.promptPreview.title")}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {actionConfig.name} &mdash; {t("settings.aiActions.promptPreview.mode", { mode: actionConfig.mode })}
            </p>
          </div>
          <button
            autoFocus
            onClick={handleClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
            title={t("settings.aiActions.promptPreview.close")}
            aria-label={t("settings.aiActions.promptPreview.closeAria")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* System Prompt Section */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">
              {t("settings.aiActions.promptPreview.systemPrompt")}
            </h3>
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
              <pre className="font-mono text-xs text-foreground whitespace-pre-wrap break-words">
                {systemPrompt || t("settings.aiActions.promptPreview.empty")}
              </pre>
            </div>
            <p className="text-meta text-muted-foreground mt-1.5">
              {t("settings.aiActions.promptPreview.tokens", { count: systemTokens.toLocaleString() })}
              {actionConfig.isDefaultPrompt && (
                <span className="ml-2 text-muted-foreground/70">
                  {t("settings.aiActions.promptPreview.defaultPrompt")}
                </span>
              )}
            </p>
          </div>

          {/* User Message Section */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">
              {t("settings.aiActions.promptPreview.userMessage")}
            </h3>
            <div className="rounded-lg border border-border/30 bg-muted/30 p-3">
              <pre className="font-mono text-xs text-foreground whitespace-pre-wrap break-words">
                {userMessage}
              </pre>
            </div>
            <p className="text-meta text-muted-foreground mt-1.5">
              {t("settings.aiActions.promptPreview.tokens", { count: userTokens.toLocaleString() })}
            </p>
          </div>

          {/* Included Sections Summary */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">
              {t("settings.aiActions.promptPreview.includedSections")}
            </h3>
            <div className="grid grid-cols-2 gap-1.5">
              <SectionBadge
                label={t("settings.aiActions.actions.sources.transcript")}
                active={actionConfig.includeTranscript}
                detail={
                  actionConfig.includeTranscript
                    ? actionConfig.transcriptWindowSeconds
                      ? t("settings.aiActions.promptPreview.secondsWindow", { count: actionConfig.transcriptWindowSeconds })
                      : t("settings.aiActions.promptPreview.defaultWindow")
                    : undefined
                }
              />
              <SectionBadge
                label={t("settings.aiActions.actions.sources.ragChunks")}
                active={actionConfig.includeRagChunks}
                detail={
                  actionConfig.includeRagChunks
                    ? t("settings.aiActions.promptPreview.topK", { count: actionConfig.ragTopK ?? t("settings.aiActions.actions.default") })
                    : undefined
                }
              />
              <SectionBadge
                label={t("settings.aiActions.actions.sources.customInstructions")}
                active={actionConfig.includeCustomInstructions}
              />
              <SectionBadge
                label={t("settings.aiActions.actions.sources.detectedQuestion")}
                active={actionConfig.includeDetectedQuestion}
              />
            </div>
          </div>

          {/* Token Estimate */}
          <div className="rounded-lg border border-border/30 bg-muted/20 px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t("settings.aiActions.promptPreview.estimatedTotalTokens")}
            </span>
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {t("settings.aiActions.promptPreview.tokens", { count: totalTokens.toLocaleString() })}
            </span>
          </div>

          {/* Parameters */}
          {actionConfig.temperature !== null && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">
                {t("settings.aiActions.promptPreview.parameters")}
              </h3>
              <div className="flex gap-3">
                <div className="rounded-md border border-border/30 bg-muted/20 px-3 py-1.5">
                  <span className="text-meta text-muted-foreground">
                    {t("settings.aiActions.promptPreview.temperature")}
                  </span>
                  <p className="text-xs font-medium text-foreground">
                    {actionConfig.temperature}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionBadge({
  label,
  active,
  detail,
}: {
  label: string;
  active: boolean;
  detail?: string;
}) {
  return (
    <div
      className={`rounded-md border px-2.5 py-1.5 text-xs ${
        active
          ? "border-primary/30 bg-primary/5 text-foreground"
          : "border-border/20 bg-muted/10 text-muted-foreground/70 line-through"
      }`}
    >
      {label}
      {active && detail && (
        <span className="ml-1.5 text-meta text-muted-foreground">
          ({detail})
        </span>
      )}
    </div>
  );
}
