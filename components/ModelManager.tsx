import React, { useState, useContext, useEffect } from 'react';
import Modal from './Modal';
import { SettingsContext } from '../context/SettingsContext';
import { AIProvider, SupabaseMCPConfig } from '../types';
import { SvgIcon } from './SvgIcon';
import SupabaseMCPConfigComponent from './SupabaseMCPConfig';

interface ModelManagerProps {
  onClose: () => void;
}

type ConfigPanel = 'providers' | 'mcp-tools';

const ModelManager: React.FC<ModelManagerProps> = ({ onClose }) => {
  const { settings, saveSettings } = useContext(SettingsContext);
  const [localSettings, setLocalSettings] = useState(settings);
  const [activePanel, setActivePanel] = useState<ConfigPanel>('providers');
  const [showAddMCPModal, setShowAddMCPModal] = useState(false);
  const [newMCPJson, setNewMCPJson] = useState('');
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

  const handleSupabaseMCPChange = (mcpConfig: SupabaseMCPConfig) => {
    setLocalSettings(prev => ({
      ...prev,
      supabaseMCP: mcpConfig,
    }));
  };

  const handleDatabaseEnabledChange = (enabled: boolean) => {
    setLocalSettings(prev => ({
      ...prev,
      databaseEnabled: enabled,
      supabaseMCP: prev.supabaseMCP ? {
        ...prev.supabaseMCP,
        enabled: enabled,
      } : {
        enabled: enabled,
        apiUrl: '',
        apiKey: '',
        connectionStatus: 'disconnected',
        autoSync: true,
      },
    }));
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

  const handleAddMCPTool = () => {
    try {
      const parsed = JSON.parse(newMCPJson);
      // Validate required fields
      if (!parsed.name || !parsed.enabled === undefined) {
        alert('MCP tool must have "name" and "enabled" fields');
        return;
      }
      
      setLocalSettings(prev => ({
        ...prev,
        mcpConfig: {
          ...prev.mcpConfig,
          [parsed.name]: parsed
        }
      }));
      
      setNewMCPJson('');
      setShowAddMCPModal(false);
    } catch (error) {
      alert('Invalid JSON format');
    }
  };

  return (
    <Modal onClose={onClose} title="Model Manager" size="lg">
      <div className="space-y-6">
        {/* Panel Navigation */}
        <div className="flex gap-2 border-b border-base-300">
          <button
            onClick={() => setActivePanel('providers')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activePanel === 'providers'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            AI Providers
          </button>
          <button
            onClick={() => setActivePanel('mcp-tools')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activePanel === 'mcp-tools'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            MCP Tools
          </button>
        </div>

        {/* AI Providers Panel */}
        {activePanel === 'providers' && (
          <>
            {/* Provider Selection */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-text-primary">AI Provider</label>
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <ModelSelectWithLoad
                label="Text Model"
                id="text-model"
                value={localSettings.openAITextModel || ''}
                onChange={(e) => setLocalSettings(prev => ({...prev, openAITextModel: e.target.value}))}
                models={availableModels.length > 0 ? availableModels : (localSettings.openAITextModel ? [localSettings.openAITextModel] : [])}
                onLoadModels={loadOpenAIModels}
                isLoading={isLoadingModels}
                placeholder="Enter model name or click refresh"
              />
              
              <ModelSelectWithLoad
                label="Vision Model"
                id="vision-model"
                value={localSettings.openAIVisionModel || ''}
                onChange={(e) => setLocalSettings(prev => ({...prev, openAIVisionModel: e.target.value}))}
                models={availableModels.length > 0 ? availableModels : (localSettings.openAIVisionModel ? [localSettings.openAIVisionModel] : [])}
                onLoadModels={loadOpenAIModels}
                isLoading={isLoadingModels}
                placeholder="gpt-4o, gpt-4-vision-preview, Qwen2-VL"
                helpText="For analyzing uploaded images"
              />
              
              <ModelSelectWithLoad
                label="Image Model"
                id="image-model"
                value={localSettings.openAIImageModel || ''}
                onChange={(e) => setLocalSettings(prev => ({...prev, openAIImageModel: e.target.value}))}
                models={availableModels.length > 0 ? availableModels : (localSettings.openAIImageModel ? [localSettings.openAIImageModel] : [])}
                onLoadModels={loadOpenAIModels}
                isLoading={isLoadingModels}
                placeholder="dall-e-3, Qwen-Image-Edit, gpt-5"
                helpText="For generating/editing images"
              />
            </div>
            </div>
            )}
          </>
        )}

        {/* MCP Tools Panel */}
        {activePanel === 'mcp-tools' && (
          <div className="space-y-4">
            {/* Header with Add Button */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-secondary">
                Configure Model Context Protocol (MCP) tools for extended functionality
              </p>
              <button
                onClick={() => setShowAddMCPModal(true)}
                className="px-3 py-1.5 text-xs bg-brand-primary hover:bg-brand-secondary text-white rounded-md transition-colors flex items-center gap-1"
              >
                <span className="text-lg leading-none">+</span>
                Add Tool
              </button>
            </div>

            {/* Supabase MCP */}
            <div className="p-4 bg-base-100 rounded-lg">
              <SupabaseMCPConfigComponent
                config={localSettings.supabaseMCP || {
                  enabled: false,
                  apiUrl: '',
                  apiKey: '',
                  connectionStatus: 'disconnected',
                  autoSync: true,
                }}
                onChange={handleSupabaseMCPChange}
                databaseEnabled={localSettings.databaseEnabled || false}
                onDatabaseEnabledChange={handleDatabaseEnabledChange}
              />
            </div>

            {/* Image Generation MCP */}
            <div className="p-4 bg-base-100 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-medium text-text-primary">Image Generation</h4>
                  <p className="text-xs text-text-secondary mt-0.5">Generate images via MCP tool calls</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.mcpConfig?.imageGeneration?.enabled || false}
                    onChange={(e) => setLocalSettings(prev => ({
                      ...prev,
                      mcpConfig: {
                        ...prev.mcpConfig,
                        imageGeneration: {
                          ...prev.mcpConfig?.imageGeneration,
                          enabled: e.target.checked,
                          baseUrl: prev.mcpConfig?.imageGeneration?.baseUrl || 'https://chat.int.bayer.com/api/v2',
                          model: prev.mcpConfig?.imageGeneration?.model || '',
                          customConfig: prev.mcpConfig?.imageGeneration?.customConfig || '',
                        }
                      }
                    }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-base-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
                </label>
              </div>

              {localSettings.mcpConfig?.imageGeneration?.enabled && (
                <div className="space-y-3 pt-3 border-t border-base-300">
                  <InputWithValidation
                    label="Base URL"
                    id="mcp-image-base-url"
                    value={localSettings.mcpConfig?.imageGeneration?.baseUrl || ''}
                    onChange={(e) => setLocalSettings(prev => ({
                      ...prev,
                      mcpConfig: {
                        ...prev.mcpConfig,
                        imageGeneration: {
                          ...prev.mcpConfig?.imageGeneration,
                          enabled: prev.mcpConfig?.imageGeneration?.enabled || false,
                          baseUrl: e.target.value,
                          model: prev.mcpConfig?.imageGeneration?.model || '',
                          customConfig: prev.mcpConfig?.imageGeneration?.customConfig || '',
                        }
                      }
                    }))}
                    placeholder="https://chat.int.bayer.com/api/v2"
                    helpText="MCP endpoint for image generation"
                  />

                  <InputWithValidation
                    label="Model"
                    id="mcp-image-model"
                    value={localSettings.mcpConfig?.imageGeneration?.model || ''}
                    onChange={(e) => setLocalSettings(prev => ({
                      ...prev,
                      mcpConfig: {
                        ...prev.mcpConfig,
                        imageGeneration: {
                          ...prev.mcpConfig?.imageGeneration,
                          enabled: prev.mcpConfig?.imageGeneration?.enabled || false,
                          baseUrl: prev.mcpConfig?.imageGeneration?.baseUrl || '',
                          model: e.target.value,
                          customConfig: prev.mcpConfig?.imageGeneration?.customConfig || '',
                        }
                      }
                    }))}
                    placeholder="gpt-4o (model with tool access)"
                    helpText="Model that has access to image generation tools"
                  />

                  <div>
                    <label htmlFor="mcp-image-config" className="block text-sm font-medium text-text-secondary mb-1">
                      Custom Configuration (JSON)
                    </label>
                    <textarea
                      id="mcp-image-config"
                      value={localSettings.mcpConfig?.imageGeneration?.customConfig || ''}
                      onChange={(e) => setLocalSettings(prev => ({
                        ...prev,
                        mcpConfig: {
                          ...prev.mcpConfig,
                          imageGeneration: {
                            ...prev.mcpConfig?.imageGeneration,
                            enabled: prev.mcpConfig?.imageGeneration?.enabled || false,
                            baseUrl: prev.mcpConfig?.imageGeneration?.baseUrl || '',
                            model: prev.mcpConfig?.imageGeneration?.model || '',
                            customConfig: e.target.value,
                          }
                        }
                      }))}
                      placeholder='{"customHeaders": {"X-Custom": "value"}}'
                      className="w-full p-2 bg-base-200 border border-base-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
                      rows={3}
                    />
                    <p className="text-xs text-text-secondary mt-1">
                      Optional: Custom headers or tool-specific configuration
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Display other custom MCP tools */}
            {localSettings.mcpConfig && Object.keys(localSettings.mcpConfig).filter(key => 
              key !== 'supabase' && key !== 'imageGeneration'
            ).map(toolKey => {
              const tool = localSettings.mcpConfig![toolKey as keyof typeof localSettings.mcpConfig];
              if (!tool || typeof tool !== 'object') return null;
              
              return (
                <div key={toolKey} className="p-4 bg-base-100 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-medium text-text-primary capitalize">{toolKey.replace(/([A-Z])/g, ' $1').trim()}</h4>
                      <p className="text-xs text-text-secondary mt-0.5">Custom MCP tool</p>
                    </div>
                    <button
                      onClick={() => {
                        const newConfig = { ...localSettings.mcpConfig };
                        delete newConfig[toolKey as keyof typeof newConfig];
                        setLocalSettings(prev => ({ ...prev, mcpConfig: newConfig }));
                      }}
                      className="text-xs text-red-500 hover:text-red-600 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                  <pre className="text-xs bg-base-200 p-2 rounded overflow-x-auto">
                    {JSON.stringify(tool, null, 2)}
                  </pre>
                </div>
              );
            })}
          </div>
        )}

        {/* Add MCP Tool Modal */}
        {showAddMCPModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-base-200 rounded-lg p-6 max-w-2xl w-full mx-4">
              <h3 className="text-lg font-semibold text-text-primary mb-4">Add MCP Tool</h3>
              <p className="text-sm text-text-secondary mb-4">
                Enter the JSON configuration for your MCP tool. Required fields: <code className="bg-base-300 px-1 rounded">name</code>, <code className="bg-base-300 px-1 rounded">enabled</code>
              </p>
              <textarea
                value={newMCPJson}
                onChange={(e) => setNewMCPJson(e.target.value)}
                placeholder={`{
  "name": "myTool",
  "enabled": true,
  "baseUrl": "https://api.example.com",
  "model": "gpt-4o",
  "customConfig": "{\\"key\\": \\"value\\"}"
}`}
                className="w-full h-64 p-3 bg-base-100 border border-base-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
              />
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => {
                    setShowAddMCPModal(false);
                    setNewMCPJson('');
                  }}
                  className="px-4 py-2 text-sm text-text-secondary hover:bg-base-300 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddMCPTool}
                  className="px-4 py-2 text-sm bg-brand-primary hover:bg-brand-secondary text-white rounded-md transition-colors"
                >
                  Add Tool
                </button>
              </div>
            </div>
          </div>
        )}

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
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  models: string[];
  onLoadModels: () => void;
  isLoading: boolean;
  placeholder: string;
  helpText?: string;
}> = ({ label, id, value, onChange, models, onLoadModels, isLoading, placeholder, helpText }) => {
  const [isDropdown, setIsDropdown] = React.useState(models.length > 0);
  
  React.useEffect(() => {
    setIsDropdown(models.length > 0);
  }, [models.length]);
  
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-text-secondary mb-1">{label}</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          {isDropdown && models.length > 0 ? (
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
          ) : (
            <input
              type="text"
              id={id}
              value={value}
              onChange={onChange}
              disabled={isLoading}
              placeholder={placeholder}
              className="w-full p-2 bg-base-200 border border-base-300 rounded-md text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
            />
          )}
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
      {helpText && <p className="text-xs text-text-secondary mt-1">{helpText}</p>}
    </div>
  );
};

export default ModelManager;