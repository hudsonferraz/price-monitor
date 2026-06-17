"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  createTranslator,
  type Messages,
  type Translator,
  type TranslationValues,
} from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages/en-US";
import type { AppLocale } from "@/lib/i18n/locales";

interface LocaleContextValue {
  locale: AppLocale;
  t: Translator;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

interface LocaleProviderProps {
  locale: AppLocale;
  messages: Messages;
  children: ReactNode;
}

export function LocaleProvider({ locale, messages, children }: LocaleProviderProps) {
  const value: LocaleContextValue = {
    locale,
    t: createTranslator(messages),
  };

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): AppLocale {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }

  return context.locale;
}

export function useTranslations(): Translator {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useTranslations must be used within LocaleProvider");
  }

  return context.t;
}

export function useTranslationValues(): {
  locale: AppLocale;
  t: (key: MessageKey, values?: TranslationValues) => string;
} {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useTranslationValues must be used within LocaleProvider");
  }

  return context;
}
