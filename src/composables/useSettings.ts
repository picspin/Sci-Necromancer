import { ref, computed } from 'vue';
import type { Settings } from '@/types';
import { LocalStorageService } from '@/services/databaseService';
import { CloudSyncedDatabaseService } from '@/services/cloudSyncedDatabaseService';
import { useMembership } from '@/src/composables/useMembership';
import { normalizeBlindReviewSettings } from '@/lib/review/reviewSettings';
import { normalizeCapabilitySettings } from '@/lib/capabilities/capabilityRegistry';

// Local storage service
const STORAGE_KEY = 'app-settings';

const loadSettingsFromStorage = (): Settings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Settings;
      return {
        ...parsed,
        blindReview: normalizeBlindReviewSettings(parsed.blindReview),
        capabilities: normalizeCapabilitySettings(parsed.capabilities),
      };
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
    blindReview: normalizeBlindReviewSettings(),
    capabilities: normalizeCapabilitySettings(),
  };
};

const saveSettingsToStorage = (settings: Settings): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings to localStorage:', error);
  }
};

// Reactive settings store
const settings = ref<Settings>(loadSettingsFromStorage());
const membership = useMembership();
const databaseServiceInstance = new CloudSyncedDatabaseService(new LocalStorageService(), {
  enabled: () => settings.value.databaseEnabled === true && membership.isAuthenticated.value,
  saveCloud: (clientId, payload, expectedUpdatedAt) =>
    membership.memberApi.saveAbstract({
      clientId,
      title: payload.title,
      conference: payload.conference,
      payload,
      expectedUpdatedAt,
    }),
  deleteCloud: (clientId) => membership.memberApi.deleteAbstract(clientId),
  listCloud: async () => (await membership.memberApi.listAbstracts()).abstracts,
});

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
      blindReview: normalizeBlindReviewSettings(),
      capabilities: normalizeCapabilitySettings(),
    };
    saveSettings(defaultSettings);
  };

  return {
    settings: computed(() => settings.value),
    updateSettings,
    saveSettings,
    resetSettings,
    databaseService: databaseServiceInstance,
  };
}
