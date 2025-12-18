import { ref, watch, computed, onMounted } from 'vue';

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

const loadInitialTheme = (): ThemeSettings => {
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
};

const theme = ref<ThemeSettings>(loadInitialTheme());

const applyThemeToDOM = (themeSettings: ThemeSettings) => {
  const root = document.documentElement;

  // High contrast mode
  if (themeSettings.mode === 'high-contrast') {
    root.classList.add('high-contrast');
  } else {
    root.classList.remove('high-contrast');
  }

  // Font size
  root.classList.remove('font-large', 'font-x-large');
  if (themeSettings.fontSize === 'large') {
    root.classList.add('font-large');
  } else if (themeSettings.fontSize === 'x-large') {
    root.classList.add('font-x-large');
  }

  // Reduced motion
  if (themeSettings.reducedMotion) {
    root.classList.add('reduce-motion');
  } else {
    root.classList.remove('reduce-motion');
  }
};

export function useTheme() {
  onMounted(() => {
    // Apply theme on mount
    applyThemeToDOM(theme.value);
  });

  // Watch for theme changes and apply to DOM
  watch(
    theme,
    (newTheme) => {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(newTheme));
      applyThemeToDOM(newTheme);
    },
    { deep: true }
  );

  const isHighContrast = computed(() => theme.value.mode === 'high-contrast');

  const toggleHighContrast = () => {
    theme.value = {
      ...theme.value,
      mode: theme.value.mode === 'high-contrast' ? 'normal' : 'high-contrast',
    };
  };

  const setFontSize = (size: ThemeSettings['fontSize']) => {
    theme.value = { ...theme.value, fontSize: size };
  };

  const toggleReducedMotion = () => {
    theme.value = {
      ...theme.value,
      reducedMotion: !theme.value.reducedMotion,
    };
  };

  const resetTheme = () => {
    theme.value = { ...defaultTheme };
  };

  return {
    theme: computed(() => theme.value),
    toggleHighContrast,
    setFontSize,
    toggleReducedMotion,
    resetTheme,
    isHighContrast,
  };
}
