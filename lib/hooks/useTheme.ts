import { useState, useEffect } from 'react';

export type ThemeMode = 'normal' | 'high-contrast';

interface ThemeSettings {
  mode: ThemeMode;
  fontSize: 'normal' | 'large' | 'x-large';
  reducedMotion: boolean;
}

const THEME_STORAGE_KEY = 'sci-necromancer-theme';

const defaultTheme: ThemeSettings = {
  mode: 'normal',
  fontSize: 'normal',
  reducedMotion: false,
};

/**
 * Hook for managing theme settings including high contrast mode
 */
export const useTheme = () => {
  const [theme, setTheme] = useState<ThemeSettings>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved) {
      try {
        return { ...defaultTheme, ...JSON.parse(saved) };
      } catch {
        return defaultTheme;
      }
    }
    
    // Check system preferences
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    return {
      ...defaultTheme,
      mode: prefersHighContrast ? 'high-contrast' : 'normal',
      reducedMotion: prefersReducedMotion,
    };
  });

  useEffect(() => {
    // Save to localStorage
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));

    // Apply theme to document
    const root = document.documentElement;
    
    // High contrast mode
    if (theme.mode === 'high-contrast') {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    // Font size
    root.classList.remove('font-large', 'font-x-large');
    if (theme.fontSize === 'large') {
      root.classList.add('font-large');
    } else if (theme.fontSize === 'x-large') {
      root.classList.add('font-x-large');
    }

    // Reduced motion
    if (theme.reducedMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }
  }, [theme]);

  const toggleHighContrast = () => {
    setTheme(prev => ({
      ...prev,
      mode: prev.mode === 'high-contrast' ? 'normal' : 'high-contrast',
    }));
  };

  const setFontSize = (size: ThemeSettings['fontSize']) => {
    setTheme(prev => ({ ...prev, fontSize: size }));
  };

  const toggleReducedMotion = () => {
    setTheme(prev => ({
      ...prev,
      reducedMotion: !prev.reducedMotion,
    }));
  };

  const resetTheme = () => {
    setTheme(defaultTheme);
  };

  return {
    theme,
    toggleHighContrast,
    setFontSize,
    toggleReducedMotion,
    resetTheme,
    isHighContrast: theme.mode === 'high-contrast',
  };
};
