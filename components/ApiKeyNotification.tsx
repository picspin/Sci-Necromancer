import React, { useState, useContext } from 'react';
import { SettingsContext } from '../context/SettingsContext';
import { SvgIcon } from './SvgIcon';

interface ApiKeyNotificationProps {
  provider: 'google' | 'openai';
  onOpenSettings: () => void;
}

const ApiKeyNotification: React.FC<ApiKeyNotificationProps> = ({ provider, onOpenSettings }) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const { settings } = useContext(SettingsContext);

  // Check if API key is configured
  const hasApiKey = provider === 'google' 
    ? settings.googleApiKey && settings.googleApiKey.trim() !== ''
    : settings.openAIApiKey && settings.openAIApiKey.trim() !== '';

  // Don't show if API key is configured or notification is dismissed
  if (hasApiKey || isDismissed) {
    return null;
  }

  const providerName = provider === 'google' ? 'Google AI' : 'OpenAI';

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <SvgIcon type="info" className="h-5 w-5 text-yellow-600" />
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">
            {providerName} API Key Required
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>
              To use {providerName} models, you need to configure your API key. 
              Click the settings button to add your API key.
            </p>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={onOpenSettings}
              className="bg-yellow-600 hover:bg-yellow-700 text-white text-sm px-3 py-1 rounded-md transition-colors"
            >
              Open Settings
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              className="text-yellow-600 hover:text-yellow-700 text-sm px-3 py-1 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
        <div className="flex-shrink-0 ml-4">
          <button
            onClick={() => setIsDismissed(true)}
            className="text-yellow-400 hover:text-yellow-600 transition-colors"
          >
            <span className="sr-only">Dismiss</span>
            <SvgIcon type="close" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyNotification;