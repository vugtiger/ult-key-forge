import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { translations, languages } from "@/lib/translations";

interface TranslationContextType {
  currentLang: string;
  setLanguage: (lang: string) => void;
  t: (key: string) => string;
  languages: typeof languages;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export const TranslationProvider = ({ children }: { children: ReactNode }) => {
  const [currentLang, setCurrentLang] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("preferredLanguage") || "en";
    }
    return "en";
  });

  useEffect(() => {
    localStorage.setItem("preferredLanguage", currentLang);
    document.documentElement.lang = currentLang;
  }, [currentLang]);

  const setLanguage = (lang: string) => {
    setCurrentLang(lang);
  };

  const t = (key: string): string => {
    const langTranslations = translations[currentLang] || translations["en"];
    return langTranslations[key] || translations["en"][key] || key;
  };

  return (
    <TranslationContext.Provider value={{ currentLang, setLanguage, t, languages }}>
      {children}
    </TranslationContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error("useTranslation must be used within a TranslationProvider");
  }
  return context;
};
