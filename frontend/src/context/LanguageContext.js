'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../lib/i18n';

const LanguageContext = createContext(null);

export const SUPPORTED_LANGUAGES = [
  { code: 'en-GB', label: 'English (UK)', flag: '🇬🇧' },
  { code: 'ta', label: 'தமிழ்', flag: '🇮🇳' },
  { code: 'hi', label: 'हिंदी', flag: '🇮🇳' },
];

export function LanguageProvider({ children }) {
  const [locale, setLocaleState] = useState('en-GB');

  useEffect(() => {
    const saved = localStorage.getItem('fairshake_locale');
    if (saved && translations[saved]) {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = (newLocale) => {
    if (translations[newLocale]) {
      setLocaleState(newLocale);
      localStorage.setItem('fairshake_locale', newLocale);
    }
  };

  const t = (key) => {
    const dict = translations[locale] || translations['en-GB'];
    return dict[key] || translations['en-GB'][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
