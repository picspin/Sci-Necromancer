import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { Settings } from '../types';

const defaultSettings: Settings = {
  provider: 'google',
  openAITextModel: 'gpt-4o',
  openAIVisionModel: 'gpt-4o',
  databaseUrl: '',
};

export const SettingsContext = createContext<{
  settings: Settings;
  saveSettings: (newSettings: Settings) => void;
}>({
  settings: defaultSettings,
  saveSettings: () => {},
});

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('app-settings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error("Failed to load settings from localStorage", error);
    }
  }, []);

  const saveSettings = (newSettings: Settings) => {
    try {
      localStorage.setItem('app-settings', JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error("Failed to save settings to localStorage", error);
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, saveSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};
