import { useCallback } from "react";
import { useConfigStore } from "../stores/configStore";
import { FolderOpen, Globe, Sun, Moon, Monitor } from "lucide-react";
import type { ThemeMode } from "../lib/types";
import type { UiLanguage } from "../i18n";
import { t } from "../i18n";

export function GeneralSettings() {
  const theme = useConfigStore((s) => s.theme);
  const setTheme = useConfigStore((s) => s.setTheme);
  const uiLanguage = useConfigStore((s) => s.uiLanguage);
  const setUiLanguage = useConfigStore((s) => s.setUiLanguage);
  const autoSummary = useConfigStore((s) => s.autoSummary);
  const setAutoSummary = useConfigStore((s) => s.setAutoSummary);
  const startOnLogin = useConfigStore((s) => s.startOnLogin);
  const setStartOnLogin = useConfigStore((s) => s.setStartOnLogin);
  const dataDirectory = useConfigStore((s) => s.dataDirectory);

  const handleChangeDataDir = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ directory: true, title: t("settings.general.selectDataDirectory") });
      if (selected && typeof selected === "string") {
        useConfigStore.getState().setDataDirectory(selected);
      }
    } catch (err) {
      console.error("Failed to open directory picker:", err);
    }
  }, []);

  const themeOptions: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { value: "dark", label: t("settings.general.themes.dark"), icon: <Moon className="h-3.5 w-3.5" /> },
    { value: "light", label: t("settings.general.themes.light"), icon: <Sun className="h-3.5 w-3.5" /> },
    {
      value: "system",
      label: t("settings.general.themes.system"),
      icon: <Monitor className="h-3.5 w-3.5" />,
    },
  ];
  const languageOptions: { value: UiLanguage; label: string }[] = [
    { value: "en", label: t("settings.general.languages.en") },
    { value: "ru", label: t("settings.general.languages.ru") },
  ];

  return (
    <div className="space-y-6">
      {/* UI Language */}
      <div className="rounded-xl border border-border/30 bg-card/50 p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <label className="text-sm font-medium text-foreground">{t("settings.general.uiLanguage")}</label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("settings.general.uiLanguageDescription")}
            </p>
          </div>
          <div className="flex rounded-lg border border-border/50 bg-secondary/30 p-0.5">
            {languageOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setUiLanguage(opt.value)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer ${
                  uiLanguage === opt.value
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 active:scale-95"
                }`}
              >
                <Globe className="h-3.5 w-3.5" />
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Theme Toggle */}
      <div className="rounded-xl border border-border/30 bg-card/50 p-5">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-foreground">{t("settings.general.theme")}</label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("settings.general.themeDescription")}
            </p>
          </div>
          <div className="flex rounded-lg border border-border/50 bg-secondary/30 p-0.5">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer ${
                  theme === opt.value
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 active:scale-95"
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Toggle Options */}
      <div className="rounded-xl border border-border/30 bg-card/50 p-5 space-y-5">
        <h3 className="text-sm font-semibold text-primary/80">{t("settings.general.behavior")}</h3>

        {/* Auto-Summary Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-foreground">
              {t("settings.general.autoSummary")}
            </label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("settings.general.autoSummaryDescription")}
            </p>
          </div>
          <button
            onClick={() => setAutoSummary(!autoSummary)}
            role="switch"
            aria-checked={autoSummary}
            aria-label={t("settings.general.toggleAutoSummary")}
            className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-all duration-200 ${
              autoSummary ? "bg-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]" : "bg-muted"
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-200 ${
                autoSummary ? "translate-x-5 scale-[1.05]" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="h-px bg-border/20" />

        {/* Start on Login Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-foreground">
              {t("settings.general.startOnLogin")}
            </label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("settings.general.startOnLoginDescription")}
            </p>
          </div>
          <button
            onClick={() => setStartOnLogin(!startOnLogin)}
            role="switch"
            aria-checked={startOnLogin}
            aria-label={t("settings.general.toggleStartOnLogin")}
            className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-all duration-200 ${
              startOnLogin ? "bg-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]" : "bg-muted"
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-200 ${
                startOnLogin ? "translate-x-5 scale-[1.05]" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Moved notice */}
      <div className="rounded-xl border border-info/20 bg-info/5 px-5 py-3">
        <p className="text-xs text-info/80">
          {t("settings.general.movedNotice", { tab: t("settings.tabs.aiActions") })}
        </p>
      </div>

      {/* Data Directory */}
      <div className="rounded-xl border border-border/30 bg-card/50 p-5">
        <div className="mb-3">
          <label className="text-sm font-medium text-foreground">
            {t("settings.general.dataDirectory")}
          </label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("settings.general.dataDirectoryDescription")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-lg border border-border/50 bg-secondary/30 px-3.5 py-2.5">
            <p className="truncate text-xs text-muted-foreground">
              {dataDirectory || t("settings.general.defaultDataDirectory")}
            </p>
          </div>
          <button
            onClick={handleChangeDataDir}
            className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-secondary/30 px-3.5 py-2.5 text-xs font-medium text-muted-foreground transition-all duration-150 hover:bg-secondary hover:text-foreground hover:-translate-y-px active:translate-y-px active:scale-[0.97] cursor-pointer"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            {t("settings.general.changeDataDirectory")}
          </button>
        </div>
      </div>
    </div>
  );
}
