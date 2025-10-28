import React, { useState, useContext } from 'react';
import Modal from './Modal';
import { SettingsContext } from '../context/SettingsContext';
import { AIProvider } from '../types';

interface ModelManagerProps {
  onClose: () => void;
}

const ModelManager: React.FC<ModelManagerProps> = ({ onClose }) => {
  const { settings, saveSettings } = useContext(SettingsContext);
  const [localSettings, setLocalSettings] = useState(settings);

  const handleSave = () => {
    saveSettings(localSettings);
    onClose();
  };

  const handleProviderChange = (provider: AIProvider) => {
    setLocalSettings(prev => ({ ...prev, provider }));
  };

  return (
    <Modal onClose={onClose}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Model Manager</h2>
          <p className="text-text-secondary mt-1">Configure your backend AI provider and other settings.</p>
        </div>

        <div className="space-y-4">
          <h3 className="text-md font-semibold text-text-primary">AI Provider</h3>
          <div className="grid grid-cols-2 gap-4">
            <ProviderButton
              label="Google AI"
              isActive={localSettings.provider === 'google'}
              onClick={() => handleProviderChange('google')}
            />
            <ProviderButton
              label="OpenAI"
              isActive={localSettings.provider === 'openai'}
              onClick={() => handleProviderChange('openai')}
            />
          </div>
          <div className="text-xs text-text-secondary p-2 bg-base-100 rounded-md">
            {localSettings.provider === 'google' 
                ? "Uses the API key provided by the environment. No configuration needed."
                : "OpenAI integration is currently a placeholder and will not work without further development."
            }
          </div>
        </div>
        
        <div className={`space-y-4 transition-opacity duration-300 ${localSettings.provider === 'openai' ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
             <h3 className="text-md font-semibold text-text-primary">OpenAI Configuration</h3>
             <Input
                label="Text Model"
                id="openai-text-model"
                value={localSettings.openAITextModel}
                onChange={(e) => setLocalSettings(prev => ({...prev, openAITextModel: e.target.value}))}
                placeholder="e.g., gpt-4o"
             />
             <Input
                label="Vision-Language Model"
                id="openai-vision-model"
                value={localSettings.openAIVisionModel}
                onChange={(e) => setLocalSettings(prev => ({...prev, openAIVisionModel: e.target.value}))}
                placeholder="e.g., gpt-4o"
             />
        </div>

        <div className="space-y-4">
             <h3 className="text-md font-semibold text-text-primary">Database (Optional)</h3>
             <Input
                label="Database URL"
                id="db-url"
                value={localSettings.databaseUrl}
                onChange={(e) => setLocalSettings(prev => ({...prev, databaseUrl: e.target.value}))}
                placeholder="e.g., https://xyz.supabase.co"
             />
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t border-base-300">
          <button onClick={onClose} className="px-4 py-2 rounded-md text-text-secondary hover:bg-base-300 transition-colors">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 rounded-md bg-brand-primary hover:bg-brand-secondary text-white font-semibold transition-colors">Save Settings</button>
        </div>
      </div>
    </Modal>
  );
};

const ProviderButton: React.FC<{label: string, isActive: boolean, onClick: () => void}> = ({ label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full p-4 rounded-lg border-2 transition-all duration-200 ${
            isActive ? 'bg-brand-primary/20 border-brand-primary text-brand-primary' : 'bg-base-100 border-base-300 hover:border-base-300/50'
        }`}
    >
        <span className="font-semibold">{label}</span>
    </button>
);

const Input: React.FC<{label: string, id: string, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, placeholder?: string}> = ({label, id, value, onChange, placeholder}) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-text-secondary mb-2">{label}</label>
        <input 
            type="text"
            id={id}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full p-3 bg-base-100 border border-base-300 rounded-md focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
        />
    </div>
)

export default ModelManager;