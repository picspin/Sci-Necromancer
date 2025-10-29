import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SvgIcon } from './SvgIcon';
// import { getMemeTranslation } from '../lib/i18n'; // Will be used later for meme translations

const LanguageSelector: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  
  const currentLanguage = i18n.language || 'en';
  
  const languages = [
    { code: 'en', name: t('common.english'), flag: '🇺🇸' },
    { code: 'zh', name: t('common.chinese'), flag: '🇨🇳' }
  ];
  
  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
    localStorage.setItem('i18nextLng', languageCode);
    setIsOpen(false);
  };
  
  const currentLang = languages.find(lang => lang.code === currentLanguage) || languages[0];
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-base-300 text-text-secondary hover:text-text-primary rounded-lg hover:bg-base-300/80 transition-colors"
        title={t('header.language_toggle')}
        aria-label={t('header.language_toggle')}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <SvgIcon type="language" className="h-5 w-5" />
        <span className="hidden sm:inline flex items-center gap-1">
          <span>{currentLang.flag}</span>
          <span>{currentLang.code.toUpperCase()}</span>
        </span>
      </button>
      
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-40 bg-base-200 border border-base-300 rounded-md shadow-lg py-1 z-50 animate-fade-in">
            {languages.map((language) => (
              <button
                key={language.code}
                onClick={() => handleLanguageChange(language.code)}
                className={`block w-full text-left px-4 py-2 text-sm transition-colors hover:bg-base-300 flex items-center gap-2 ${
                  currentLanguage === language.code 
                    ? 'text-brand-primary bg-brand-primary/10' 
                    : 'text-text-primary'
                }`}
                role="menuitem"
              >
                <span>{language.flag}</span>
                <span>{language.name}</span>
                {currentLanguage === language.code && (
                  <SvgIcon type="check" className="h-4 w-4 ml-auto" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default LanguageSelector;