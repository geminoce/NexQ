import {
  Github,
  FileText,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { NEXQ_VERSION, NEXQ_BUILD_DATE, NEXQ_DEVELOPER } from "../lib/version";
import { useUpdater } from "../hooks/useUpdater";
import { open } from "@tauri-apps/plugin-shell";
import { t } from "../i18n";

const GITHUB_URL = "https://github.com/VahidAlizadeh/NexQ";

function timeSince(ms: number): string {
  const secs = Math.floor((Date.now() - ms) / 1000);
  if (secs < 60) return t("settings.about.time.justNow");
  if (secs < 3600) return t("settings.about.time.minutesAgo", { count: Math.floor(secs / 60) });
  return t("settings.about.time.hoursAgo", { count: Math.floor(secs / 3600) });
}

function formatBuildDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function AboutSettings() {
  const {
    checkStatus,
    lastChecked,
    availableUpdate,
    checkError,
    downloadStatus,
    performCheck,
    startDownload,
  } = useUpdater();

  // Derive update dot color and label
  const isChecking = checkStatus === "checking";
  const isAvailable = checkStatus === "available" && availableUpdate;
  const isError = checkStatus === "error";
  const isUpToDate =
    checkStatus === "up-to-date" || checkStatus === "idle";

  return (
    <div className="space-y-6">
      {/* App Identity Card */}
      <div className="rounded-xl border border-border/30 bg-card/50 p-6">
        <div className="flex items-start gap-5">
          <img src="/nexq-icon.png" alt="NexQ" className="h-14 w-14 shrink-0 rounded-2xl" />
          <div>
            <h3 className="text-lg font-bold text-foreground">NexQ</h3>
            <p className="text-xs text-muted-foreground">
              v{NEXQ_VERSION}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("settings.about.tagline")}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-secondary/50 px-3 py-1 text-meta font-medium text-muted-foreground">
                Tauri 2
              </span>
              <span className="inline-flex items-center rounded-full bg-secondary/50 px-3 py-1 text-meta font-medium text-muted-foreground">
                React + Rust
              </span>
              <span className="inline-flex items-center rounded-full bg-secondary/50 px-3 py-1 text-meta font-medium text-muted-foreground">
                Windows x64
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Meta Grid (2x2) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border/30 bg-card/50 p-4">
          <p className="text-meta text-muted-foreground/60">{t("settings.about.buildDate")}</p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {formatBuildDate(NEXQ_BUILD_DATE)}
          </p>
        </div>
        <div className="rounded-xl border border-border/30 bg-card/50 p-4">
          <p className="text-meta text-muted-foreground/60">{t("settings.about.developer")}</p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {NEXQ_DEVELOPER}
          </p>
        </div>
        <div className="rounded-xl border border-border/30 bg-card/50 p-4">
          <p className="text-meta text-muted-foreground/60">{t("settings.about.architecture")}</p>
          <p className="mt-1 text-sm font-medium text-foreground">x86_64</p>
        </div>
        <div className="rounded-xl border border-border/30 bg-card/50 p-4">
          <p className="text-meta text-muted-foreground/60">{t("settings.about.license")}</p>
          <p className="mt-1 text-sm font-medium text-foreground">MIT</p>
        </div>
      </div>

      {/* Update Check Row */}
      <div className="rounded-xl border border-border/30 bg-card/50 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Status dot */}
            <span
              className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                isChecking
                  ? "animate-pulse bg-amber-400"
                  : isAvailable
                    ? "bg-blue-500"
                    : isError
                      ? "bg-red-500"
                      : "bg-emerald-500"
              }`}
            />
            <div>
              <p className="text-sm font-medium text-foreground">
                {isChecking
                  ? t("settings.about.update.checking")
                  : isAvailable
                    ? t("settings.about.update.available", { version: availableUpdate.version })
                    : isError
                      ? t("settings.about.update.failed")
                      : t("settings.about.update.upToDate")}
              </p>
              <p className="text-meta text-muted-foreground/60">
                {isChecking
                  ? t("settings.about.update.connecting")
                  : isError && checkError
                    ? checkError
                    : isAvailable && availableUpdate.date
                      ? t("settings.about.update.released", { time: timeSince(new Date(availableUpdate.date).getTime()) })
                      : lastChecked
                        ? t("settings.about.update.lastChecked", { time: timeSince(lastChecked) })
                        : t("settings.about.update.notChecked")}
              </p>
            </div>
          </div>

          {/* Action button */}
          {isAvailable ? (
            <button
              onClick={startDownload}
              disabled={downloadStatus === "downloading"}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {downloadStatus === "downloading"
                ? t("settings.about.update.downloading")
                : t("settings.about.update.updateNow")}
            </button>
          ) : (
            <button
              onClick={() => performCheck({ ignoreSkipped: true })}
              disabled={isChecking}
              className="rounded-lg border border-border/40 bg-secondary/50 px-4 py-2 text-xs font-medium text-foreground/80 transition-colors hover:bg-secondary disabled:opacity-50"
            >
              {t("settings.about.update.checkForUpdates")}
            </button>
          )}
        </div>
      </div>

      {/* Quick Links Row */}
      <div className="grid grid-cols-4 gap-3">
        <button
          onClick={() => open(GITHUB_URL)}
          className="flex flex-col items-center gap-2 rounded-xl border border-border/30 bg-card/50 p-4 transition-colors hover:bg-secondary/30"
        >
          <Github className="h-4 w-4 text-muted-foreground" />
          <span className="text-meta font-medium text-muted-foreground">
            GitHub
          </span>
        </button>
        <button
          onClick={() => open(`${GITHUB_URL}/blob/main/CHANGELOG.md`)}
          className="flex flex-col items-center gap-2 rounded-xl border border-border/30 bg-card/50 p-4 transition-colors hover:bg-secondary/30"
        >
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-meta font-medium text-muted-foreground">
            {t("settings.about.links.changelog")}
          </span>
        </button>
        <button
          onClick={() => open(`${GITHUB_URL}/issues/new/choose`)}
          className="flex flex-col items-center gap-2 rounded-xl border border-border/30 bg-card/50 p-4 transition-colors hover:bg-secondary/30"
        >
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
          <span className="text-meta font-medium text-muted-foreground">
            {t("settings.about.links.reportIssue")}
          </span>
        </button>
        <button
          onClick={() => open(`${GITHUB_URL}/wiki`)}
          className="flex flex-col items-center gap-2 rounded-xl border border-border/30 bg-card/50 p-4 transition-colors hover:bg-secondary/30"
        >
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
          <span className="text-meta font-medium text-muted-foreground">
            {t("settings.about.links.documentation")}
          </span>
        </button>
      </div>

      {/* Footer */}
      <div className="rounded-xl border border-border/30 bg-card/50 p-5">
        <p className="text-xs text-muted-foreground/60 leading-relaxed">
          {t("settings.about.footer")}
        </p>
      </div>
    </div>
  );
}
