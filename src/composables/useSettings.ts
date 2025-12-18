import { ref, computed } from 'vue';
import type { Settings } from '@/types';

// Local storage service
const STORAGE_KEY = 'app-settings';

const loadSettingsFromStorage = (): Settings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load settings from localStorage:', error);
  }

  // Default settings
  return {
    provider: 'google',
    temperature: 0.7,
    maxTokens: 4000,
    databaseEnabled: false,
  };
};

const saveSettingsToStorage = (settings: Settings): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings to localStorage:', error);
  }
};

// Local storage service implementation
const LocalStorageServiceImpl = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error(`Failed to get item '${key}' from localStorage:`, error);
      return null;
    }
  },

  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error(`Failed to set item '${key}' in localStorage:`, error);
    }
  },

  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Failed to remove item '${key}' from localStorage:`, error);
    }
  },

  clear: (): void => {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  },
};

// Reactive settings store
const settings = ref<Settings>(loadSettingsFromStorage());

// Database service instance
const databaseService = LocalStorageServiceImpl;

export function useSettings() {
  const updateSettings = (updates: Partial<Settings>): void => {
    settings.value = { ...settings.value, ...updates };
    saveSettingsToStorage(settings.value);
  };

  const saveSettings = (newSettings: Settings): void => {
    settings.value = newSettings;
    saveSettingsToStorage(newSettings);
  };

  const resetSettings = (): void => {
    const defaultSettings: Settings = {
      provider: 'google',
      temperature: 0.7,
      maxTokens: 4000,
      databaseEnabled: false,
    };
    saveSettings(defaultSettings);
  };

  return {
    settings: computed(() => settings.value),
    updateSettings,
    saveSettings,
    resetSettings,
    databaseService,
  };
}

// Export LocalStorageService for external use
export const LocalStorageService = LocalStorageServiceImpl;
