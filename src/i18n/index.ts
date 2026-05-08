import { en } from "./en";
import { ru } from "./ru";
import type { TranslationKey, TranslationParams } from "./types";

const dictionaries = {
  en,
  ru,
} as const;

export type UiLanguage = keyof typeof dictionaries;

let activeLanguage: UiLanguage = "en";
const warnedMissingKeys = new Set<string>();

export function setActiveLanguage(language: UiLanguage): void {
  activeLanguage = language;
}

function warnMissingKey(message: string, key: string): void {
  const isDev = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true;
  if (!isDev || warnedMissingKeys.has(key)) return;
  warnedMissingKeys.add(key);
  console.warn(message);
}

function readPath(source: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((current, segment) => {
    if (current && typeof current === "object" && segment in current) {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, source);
}

function interpolate(value: string, params?: TranslationParams): string {
  if (!params) return value;

  return value.replace(/\{(\w+)\}/g, (match, name) => {
    const replacement = params[name];
    return replacement === null || replacement === undefined ? match : String(replacement);
  });
}

export function t(key: TranslationKey, params?: TranslationParams): string {
  const localized = readPath(dictionaries[activeLanguage], key);
  const fallback = readPath(dictionaries.en, key);

  if (typeof localized === "string") return interpolate(localized, params);
  if (typeof fallback === "string") {
    warnMissingKey(`[i18n] Missing ${activeLanguage} translation key, using en fallback: ${key}`, `${activeLanguage}:${key}`);
    return interpolate(fallback, params);
  }

  warnMissingKey(`[i18n] Missing translation key: ${key}`, `missing:${key}`);
  return key;
}

export type { TranslationKey, TranslationParams };
