import { en } from "./en";
import type { TranslationShape } from "./types";

export const ru: TranslationShape<typeof en> = {
  common: {
    back: "Назад",
    retry: "Повторить",
  },
  settings: {
    title: "Настройки",
    navigation: "Навигация по настройкам",
    runSetupWizard: "Запустить мастер настройки",
    runSetupWizardAction: "Запустить мастер настройки",
    close: "Закрыть настройки",
    closeEsc: "Закрыть (Esc)",
    backToLauncher: "Назад к главному экрану",
    backToLauncherAction: "Назад к главному экрану",
    groups: {
      meeting: "Встреча",
      providers: "Провайдеры",
      intelligence: "Интеллект",
      system: "Система",
    },
    tabs: {
      meetingAudio: "Аудио и устройства",
      llm: "LLM-провайдеры",
      stt: "STT-провайдеры",
      translation: "Перевод",
      aiActions: "AI-действия",
      contextStrategy: "Стратегия контекста",
      scenarios: "AI-сценарии",
      noisePresets: "Шумовые пресеты",
      confidence: "Уверенность",
      hotkeys: "Горячие клавиши",
      general: "Общие",
      about: "О программе",
    },
  },
  errors: {
    boundaryTitle: "Что-то пошло не так",
    boundaryMessage: "Произошла непредвиденная ошибка.",
  },
};
