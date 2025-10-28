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
      // Simple validation - just check if key has reasonable length
      if (localSettings.openAIApiKey.length > 10) {
        setValidationStatus(prev => ({ ...prev, apiKey: 'valid' }));
      } else {
        setValidationStatus(prev => ({ ...prev, apiKey: 'invalid' }));
      }
    } catch (error) {
      setValidationStatus(prev => ({ ...prev, apiKey: 'invalid' }));
    }
  };

  const loadOpenAIModels = async () => {
    if (!localSettings.openAIBaseUrl || !localSettings.openAIApiKey) {
      alert('Please enter API Key and Base URL first');
      return;
    }
    
    setIsLoadingModels(true);
    try {
      // Normalize base URL (remove trailing slash)
      const baseUrl = localSettings.openAIBaseUrl.replace(/\/$/, '');
      
      // Fetch models from OpenAI-compatible API
      const response = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localSettings.openAIApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Extract model IDs from the response
      // OpenAI API format: { "data": [{ "id": "model-name", ... }, ...] }
      if (data.data && Array.isArray(data.data)) {
        const modelIds = data.data.map((model: any) => model.id);
        setAvailableModels(modelIds);
        setValidationStatus(prev => ({ ...prev, baseUrl: 'valid' }));
      } else {
        throw new Error('Invalid response format from API');
      }
    } catch (error) {
      console.error('Error loading models:', error);
      setValidationStatus(prev => ({ ...prev, baseUrl: 'invalid' }));
      alert(`Failed to load models: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const loadGoogleModels = async () => {
    if (!localSettings.googleApiKey) {
      alert('Please enter Google API Key first');
      return;
    }
    
    setIsLoadingModels(true);
    try {
      // Google AI uses REST API: https://generativelanguage.googleapis.com/v1beta/models
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${localSettings.googleApiKey}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Extract model names from the response
      // Google AI format: { "models": [{ "name": "models/gemini-...", ... }, ...] }
      if (data.models && Array.isArray(data.models)) {
        const modelIds = data.models
          .map((model: any) => {
            // Extract model ID from "models/gemini-2.5-flash" format
            const name = model.name || '';
            return name.replace('models/', '');
          })
          .filter((id: string) => id.length > 0);
        
        setAvailableModels(modelIds);
        setValidationStatus(prev => ({ ...prev, apiKey: 'valid' }));
      } else {
        throw new Error('Invalid response format from API');
      }
    } catch (error) {
      console.error('Error loading Google models:', error);
      setValidationStatus(prev => ({ ...prev, apiKey: 'invalid' }));
      alert(`Failed to load models: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
                value={localSettings.model || ''}
                onChange={(e) => setLocalSettings(prev => ({...prev, model: e.target.value}))}
                models={availableModels.length > 0 ? availableModels : ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash', 'gemini-1.5-pro']}
                onLoadModels={loadGoogleModels}
                isLoading={isLoadingModels}
                placeholder="gemini-2.5-flash"
              />
              
              <ModelSelectWithLoad
                label="Image Model"
                id="google-image-model"
                value={localSettings.openAIImageModel || ''}
                onChange={(e) => setLocalSettings(prev => ({...prev, openAIImageModel: e.target.value}))}
                models={availableModels.length > 0 ? availableModels.filter(m => m.includes('imagen')) : ['imagen-3.0-generate-001', 'imagen-3.0-fast-generate-001']}
                onLoadModels={loadGoogleModels}
                isLoading={isLoadingModels}
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

const ModelSelectWithLoad: React.FC<{
  label: string;
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  models: string[];
  onLoadModels: () => void;
  isLoading: boolean;
  placeholder: string;
}> = ({ label, id, value, onChange, models, onLoadModels, isLoading, placeholder }) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-text-secondary mb-1">{label}</label>
    <div className="flex gap-2">
      <div className="relative flex-1">
        <select
          id={id}
          value={value}
          onChange={onChange}
          disabled={isLoading}
          className="w-full p-2 bg-base-200 border border-base-300 rounded-md text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
        >
          <option value="">{placeholder}</option>
          {models.map(model => (
            <option key={model} value={model}>{model}</option>
          ))}
        </select>
      </div>
      <button
        onClick={onLoadModels}
        disabled={isLoading}
        className="px-3 py-2 bg-base-300 hover:bg-base-300/80 text-text-secondary rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Load models from provider"
      >
        {isLoading ? (
          <SvgIcon type="loader" className="h-4 w-4 animate-spin" />
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        )}
      </button>
    </div>
  </div>
);

export default ModelManager;