import { en } from "./en";

type Dictionary = typeof en;
type Primitive = string | number | boolean | null | undefined;

export type TranslationParams = Record<string, Primitive>;

export type TranslationShape<T = Dictionary> = {
  [K in keyof T]: T[K] extends string ? string : TranslationShape<T[K]>;
};

export type TranslationKey<T = Dictionary> = T extends string
  ? never
  : {
      [K in Extract<keyof T, string>]: T[K] extends string
        ? K
        : `${K}.${TranslationKey<T[K]>}`;
    }[Extract<keyof T, string>];
