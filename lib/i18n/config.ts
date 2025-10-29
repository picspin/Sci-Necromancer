import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Load translations dynamically
const loadTranslations = async () => {
  try {
    const [enResponse, zhResponse] = await Promise.all([
      fetch('/locales/en/translation.json'),
      fetch('/locales/zh/translation.json')
    ]);
    
    const enTranslations = await enResponse.json();
    const zhTranslations = await zhResponse.json();
    
    return {
      en: { translation: enTranslations },
      zh: { translation: zhTranslations }
    };
  } catch (error) {
    console.warn('Failed to load translations, using fallback', error);
    return {
      en: { translation: {} },
      zh: { translation: {} }
    };
  }
};

// Initialize i18n and return a promise
export const initI18n = async (): Promise<typeof i18n> => {
  const resources = await loadTranslations();
  
  await i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: 'en',
      debug: false,
      
      detection: {
        order: ['localStorage', 'navigator', 'htmlTag'],
        caches: ['localStorage'],
      },

      interpolation: {
        escapeValue: false, // React already escapes values
      },

      react: {
        useSuspense: false,
      },
    });
    
  return i18n;
};

export default i18n;