import { useTranslation } from 'react-i18next';
import { getMemeTranslation } from '../i18n';

/**
 * Custom hook that extends useTranslation with meme translation support
 */
export const useTranslationWithMemes = () => {
  const { t, i18n, ...rest } = useTranslation();
  
  /**
   * Translation function that checks for meme translations first
   */
  const tm = (key: string, options?: any) => {
    // For creative/playful terms, check meme translations first
    const memeTranslation = getMemeTranslation(key, t);
    if (memeTranslation !== t(key)) {
      return memeTranslation;
    }
    
    // Fall back to regular translation
    return t(key, options);
  };
  
  return {
    t,
    tm, // Translation with memes
    i18n,
    ...rest
  };
};