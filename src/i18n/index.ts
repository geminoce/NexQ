import { en } from "./en";
import { ru } from "./ru";
import type { TranslationKey, TranslationParams } from "./types";

const dictionaries = {
  en,
  ru,
} as const;

const activeLanguage: keyof typeof dictionaries = "ru";

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
  if (typeof fallback === "string") return interpolate(fallback, params);

  if (typeof console !== "undefined") {
    console.warn(`[i18n] Missing translation key: ${key}`);
  }

  return key;
}

export type { TranslationKey, TranslationParams };
