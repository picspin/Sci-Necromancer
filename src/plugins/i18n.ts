import { createI18n } from 'vue-i18n';
import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Load translations dynamically (same approach as React config)
const loadTranslations = async () => {
  try {
    const [enResponse, zhResponse] = await Promise.all([
      fetch('/locales/en/translation.json'),
      fetch('/locales/zh/translation.json'),
    ]);

    const enTranslations = await enResponse.json();
    const zhTranslations = await zhResponse.json();

    return {
      en: { translation: enTranslations },
      zh: { translation: zhTranslations },
    };
  } catch (error) {
    console.warn('Failed to load translations, using fallback', error);
    return {
      en: { translation: {} },
      zh: { translation: {} },
    };
  }
};

// Initialize with empty messages first
export const i18n = createI18n({
  legacy: false, // Use Composition API mode
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en: { translation: {} },
    zh: { translation: {} },
  },
});

// Initialize i18next and load translations
(async () => {
  const resources = await loadTranslations();

  await i18next.use(LanguageDetector).init({
    resources,
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
  });

  // Update Vue I18n messages after loading
  i18n.global.setLocaleMessage('en', resources.en.translation);
  i18n.global.setLocaleMessage('zh', resources.zh.translation);
  i18n.global.locale.value = (i18next.language || 'en') as any;
})();

// Sync i18next language changes with Vue I18n
i18next.on('languageChanged', (lng) => {
  i18n.global.locale.value = lng as any;
});

// Export i18next for direct access if needed
export { i18next };
