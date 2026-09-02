'use client';

import React, { createContext, useContext, useState } from 'react';
import { translations } from '../lib/i18n';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [locale] = useState('en-GB');

  const t = (key) => {
    const dict = translations['en-GB'] || {};
    return dict[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ locale, t }}>
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
