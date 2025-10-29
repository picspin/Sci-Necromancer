import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { Settings } from '../types';
import { LocalStorageService } from '../services/databaseService';
import { databaseFallbackService } from '../services/databaseFallbackService';
import { notificationService } from '../lib/utils/notificationService';

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
  saveSettings: (newSettings: Settings) => void;
  databaseService: LocalStorageService;
}

const defaultSettings: Settings = {
  provider: 'google',
  googleApiKey: '',
  openAIApiKey: '',
  model: 'gemini-2.0-flash-exp',
  temperature: 0.7,
  maxTokens: 2048,
  databaseEnabled: false,
  supabaseMCP: {
    enabled: false,
    apiUrl: '',
    apiKey: '',
    connectionStatus: 'disconnected',
    autoSync: true,
  },
};

export const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  updateSettings: () => {},
  saveSettings: () => {},
  databaseService: new LocalStorageService(),
});

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [databaseService] = useState(() => new LocalStorageService());

  useEffect(() => {
    const savedSettings = localStorage.getItem('app-settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...defaultSettings, ...parsed });
      } catch (error) {
        console.error('Failed to parse saved settings:', error);
      }
    }
  }, []);

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('app-settings', JSON.stringify(updated));
      return updated;
    });
  };

  const saveSettings = (newSettings: Settings) => {
    const prevSettings = settings;
    setSettings(newSettings);
    localStorage.setItem('app-settings', JSON.stringify(newSettings));
    
    // Handle database activation changes
    if (prevSettings.databaseEnabled !== newSettings.databaseEnabled) {
      if (newSettings.databaseEnabled) {
        // Database was enabled
        if (newSettings.supabaseMCP?.connectionStatus === 'connected') {
          // TODO: Initialize cloud service when Supabase MCP is implemented
          databaseFallbackService.setCloudService(null, true);
          notificationService.info(
            'Cloud Storage Enabled',
            'Your abstracts will now be synced to the cloud'
          );
        }
      } else {
        // Database was disabled
        databaseFallbackService.setCloudService(null, false);
        notificationService.info(
          'Cloud Storage Disabled',
          'Your abstracts will be stored locally only'
        );
      }
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, saveSettings, databaseService }}>
      {children}
    </SettingsContext.Provider>
  );
};
