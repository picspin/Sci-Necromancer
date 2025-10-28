import React, { useState, useContext, useEffect } from 'react';
import Modal from './Modal';
import { SettingsContext } from '../context/SettingsContext';
import { AIProvider } from '../types';
import { SvgIcon } from './SvgIcon';

interface ModelManagerProps {
  onClose: () => void;
}

const ModelManager: React.FC<ModelManagerProps> = ({ onClose }) => {
  const { settings, saveSettings } = useContext(SettingsContext);
  const [localSettings, setLocalSettings] = useState(settings);
  const [validationStatus, setValidationStatus] = useState<{
    apiKey?: 'valid' | 'invalid' | 'validating';
    baseUrl?: 'valid' | 'invalid' | 'validating';
  }>({});
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = () => {
    saveSettings(localSettings);
    onClose();
  };

  const handleProviderChange = (provider: AIProvider) => {
    setLocalSettings(prev => ({ ...prev, provider }));
    setValidationStatus({});
    setAvailableModels([]);
  };

  const validateApiKey = async () => {
    if (!localSettings.openAIApiKey) return;
    
    setValidationStatus(prev => ({ ...prev, apiKey: 'validating' }));
    
    try {
      // Simple validation - just check if key format is correct
      if (localSettings.openAIApiKey.startsWith('sk-') || localSettings.openAIApiKey.length > 20) {
        setValidationStatus(prev => ({ ...prev, apiKey: 'valid' }));
        // Auto-load models if base URL is set
        if (localSettings.openAIBaseUrl) {
          await loadModels();
        }
      } else {
        setValidationStatus(prev => ({ ...prev, apiKey: 'invalid' }));
      }
    } catch (error) {
      setValidationStatus(prev => ({ ...prev, apiKey: 'invalid' }));
    }
  };

  const loadModels = async () => {
    if (!localSettings.openAIBaseUrl || !localSettings.openAIApiKey) return;
    
    setIsLoadingModels(true);
    try {
      // Mock model loading - in real implementation, fetch from API
      const models = [
        'gpt-4o',
        'gpt-4-turbo',
        'gpt-3.5-turbo',
        'claude-3-opus',
        'claude-3-sonnet',
        'qwen-plus',
        'dall-e-3',
        'stable-diffusion-xl'
      ];
      setAvailableModels(models);
      setValidationStatus(prev => ({ ...prev, baseUrl: 'valid' }));
    } catch (error) {
      setValidationStatus(prev => ({ ...prev, baseUrl: 'invalid' }));
    } finally {
      setIsLoadingModels(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Model Manager" size="lg">
      <div className="space-y-6">
        {/* Provider Selection */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-text-primary">Provider</label>
          <div className="flex gap-3">
            <ProviderButton
              label="Google AI"
              isActive={localSettings.provider === 'google'}
              onClick={() => handleProviderChange('google')}
            />
            <ProviderButton
              label="OpenAI Compatible"
              isActive={localSettings.provider === 'openai'}
              onClick={() => handleProviderChange('openai')}
            />
          </div>
        </div>

        {/* Google AI Configuration */}
        {localSettings.provider === 'google' && (
          <div className="space-y-4 p-4 bg-base-100 rounded-lg">
            <InputWithValidation
              label="API Key"
              id="google-api-key"
              type="password"
              value={localSettings.googleApiKey || ''}
              onChange={(e) => setLocalSettings(prev => ({...prev, googleApiKey: e.target.value}))}
              placeholder="AIza..."
              status={validationStatus.apiKey}
              helpText="Get your API key from Google AI Studio"
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ModelSelectWithLoad
                label="Text Model"
                id="google-text-model"
                value={localSettings.model || 'gemini-2.5-flash'}
                onChange={(e) => setLocalSettings(prev => ({...prev, model: e.target.value}))}
                models={['gemini-2.5-flash', 'gemini-2.5-pro']}
                onLoadModels={() => {}}
                isLoading={false}
                placeholder="gemini-2.5-flash"
              />
              
              <ModelSelectWithLoad
                label="Image Model"
                id="google-image-model"
                value={localSettings.openAIImageModel || 'imagen-3.0-generate-001'}
                onChange={(e) => setLocalSettings(prev => ({...prev, openAIImageModel: e.target.value}))}
                models={['imagen-3.0-generate-001', 'imagen-3.0-fast-generate-001']}
                onLoadModels={() => {}}
                isLoading={false}
                placeholder="imagen-3.0-generate-001"
              />
            </div>
          </div>
        )}

        {/* OpenAI Compatible Configuration */}
        {localSettings.provider === 'openai' && (
          <div className="space-y-4 p-4 bg-base-100 rounded-lg">
            <InputWithValidation
              label="API Key"
              id="openai-api-key"
              type="password"
              value={localSettings.openAIApiKey || ''}
              onChange={(e) => setLocalSettings(prev => ({...prev, openAIApiKey: e.target.value}))}
              onBlur={validateApiKey}
              placeholder="sk-... or provider-specific key"
              status={validationStatus.apiKey}
            />
            
            <InputWithValidation
              label="Base URL"
              id="openai-base-url"
              value={localSettings.openAIBaseUrl || ''}
              onChange={(e) => setLocalSettings(prev => ({...prev, openAIBaseUrl: e.target.value}))}
              placeholder="https://api.openai.com/v1"
              status={validationStatus.baseUrl}
              helpText="Support OpenAI API based Providers"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ModelSelectWithLoad
                label="Text Model"
                id="text-model"
                value={localSettings.openAITextModel || ''}
                onChange={(e) => setLocalSettings(prev => ({...prev, openAITextModel: e.target.value}))}
                models={availableModels}
                onLoadModels={loadModels}
                isLoading={isLoadingModels}
                placeholder="gpt-4o"
              />
              
              <ModelSelectWithLoad
                label="Image Model"
                id="image-model"
                value={localSettings.openAIImageModel || ''}
                onChange={(e) => setLocalSettings(prev => ({...prev, openAIImageModel: e.target.value}))}
                models={availableModels}
                onLoadModels={loadModels}
                isLoading={isLoadingModels}
                placeholder="dall-e-3"
              />
            </div>
          </div>
        )}

        {/* Supabase Configuration */}
        <div className="space-y-3 p-4 bg-base-100 rounded-lg">
          <h3 className="text-sm font-semibold text-text-primary">Database (Optional)</h3>
          <InputWithValidation
            label="Supabase URL"
            id="supabase-url"
            value={localSettings.databaseUrl || ''}
            onChange={(e) => setLocalSettings(prev => ({...prev, databaseUrl: e.target.value}))}
            placeholder="https://xyz.supabase.co"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-base-300">
          <button 
            onClick={onClose} 
            className="px-4 py-2 rounded-md text-text-secondary hover:bg-base-300 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            className="px-4 py-2 rounded-md bg-brand-primary hover:bg-brand-secondary text-white font-semibold transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </Modal>
  );
};

// Sub-components
const ProviderButton: React.FC<{label: string, isActive: boolean, onClick: () => void}> = ({ label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
      isActive 
        ? 'bg-brand-primary text-white shadow-md' 
        : 'bg-base-200 text-text-secondary hover:bg-base-300'
    }`}
  >
    {label}
  </button>
);

const InputWithValidation: React.FC<{
  label: string;
  id: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  placeholder?: string;
  status?: 'valid' | 'invalid' | 'validating';
  helpText?: string;
}> = ({ label, id, type = 'text', value, onChange, onBlur, placeholder, status, helpText }) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-text-secondary mb-1">{label}</label>
    <div className="relative">
      <input 
        type={type}
        id={id}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        className="w-full p-2 pr-10 bg-base-200 border border-base-300 rounded-md text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
      />
      {status && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          {status === 'validating' && <SvgIcon type="loader" className="h-4 w-4 animate-spin text-brand-primary" />}
          {status === 'valid' && <span className="text-green-500 text-lg">✓</span>}
          {status === 'invalid' && <span className="text-red-500 text-lg">✗</span>}
        </div>
      )}
    </div>
    {helpText && <p className="text-xs text-text-secondary mt-1">{helpText}</p>}
  </div>
);

const ModelSelect: React.FC<{
  label: string;
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  models: string[];
  isLoading: boolean;
  placeholder: string;
}> = ({ label, id, value, onChange, models, isLoading, placeholder }) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-text-secondary mb-1">{label}</label>
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={onChange}
        disabled={isLoading}
        className="w-full p-2 bg-base-200 border border-base-300 rounded-md text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none transition appearance-none"
      >
        <option value="">{placeholder}</option>
        {models.map(model => (
          <option key={model} value={model}>{model}</option>
        ))}
      </select>
      {isLoading && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <SvgIcon type="loader" className="h-4 w-4 animate-spin text-brand-primary" />
        </div>
      )}
    </div>
  </div>
);

export default ModelManager;