import React, { useState, useEffect } from 'react';
import { SupabaseMCPConfig, ConnectionStatus } from '../types';
import { SvgIcon } from './SvgIcon';
import { notificationService } from '../lib/utils/notificationService';

interface SupabaseMCPConfigProps {
  config: SupabaseMCPConfig;
  onChange: (config: SupabaseMCPConfig) => void;
  databaseEnabled: boolean;
  onDatabaseEnabledChange: (enabled: boolean) => void;
}

const SupabaseMCPConfigComponent: React.FC<SupabaseMCPConfigProps> = ({
  config,
  onChange,
  databaseEnabled,
  onDatabaseEnabledChange,
}) => {
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Notify user when database status changes
  useEffect(() => {
    if (databaseEnabled && config.connectionStatus === 'connected') {
      notificationService.success(
        'Database Connected',
        'Cloud storage is now active. Your abstracts will be synced to Supabase.'
      );
    } else if (!databaseEnabled) {
      notificationService.info(
        'Database Disabled',
        'Cloud storage is disabled. Your abstracts will be stored locally only.'
      );
    }
  }, [databaseEnabled, config.connectionStatus]);

  const handleConfigChange = (updates: Partial<SupabaseMCPConfig>) => {
    onChange({ ...config, ...updates });
  };

  const testConnection = async () => {
    if (!config.apiUrl || !config.apiKey) {
      handleConfigChange({
        connectionStatus: 'error',
        errorMessage: 'API URL and API Key are required',
      });
      return;
    }

    setIsTestingConnection(true);
    handleConfigChange({ connectionStatus: 'connecting' });

    try {
      // Test connection to Supabase
      const response = await fetch(`${config.apiUrl}/rest/v1/`, {
        method: 'GET',
        headers: {
          'apikey': config.apiKey,
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        handleConfigChange({
          connectionStatus: 'connected',
          lastConnectionTest: new Date(),
          errorMessage: undefined,
        });
        notificationService.success(
          'Connection Successful',
          'Successfully connected to Supabase MCP'
        );
      } else {
        throw new Error(`Connection failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown connection error';
      handleConfigChange({
        connectionStatus: 'error',
        errorMessage,
      });
      notificationService.error(
        'Connection Failed',
        `Failed to connect to Supabase: ${errorMessage}`
      );
    } finally {
      setIsTestingConnection(false);
    }
  };

  const getStatusIcon = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected':
        return <span className="text-green-500 text-lg">✓</span>;
      case 'error':
        return <span className="text-red-500 text-lg">✗</span>;
      case 'connecting':
        return <SvgIcon type="loader" className="h-4 w-4 animate-spin text-brand-primary" />;
      default:
        return <span className="text-gray-400 text-lg">○</span>;
    }
  };

  const getStatusText = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'error':
        return 'Connection Error';
      case 'connecting':
        return 'Testing...';
      case 'disconnected':
      default:
        return 'Not Connected';
    }
  };

  return (
    <div className="space-y-4 p-4 bg-base-100 rounded-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Database (Supabase MCP)</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">Enable Cloud Storage</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={databaseEnabled}
              onChange={(e) => onDatabaseEnabledChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-base-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
          </label>
        </div>
      </div>

      {databaseEnabled && (
        <>
          <div className="space-y-3">
            <div>
              <label htmlFor="supabase-url" className="block text-sm font-medium text-text-secondary mb-1">
                Supabase URL
              </label>
              <input
                type="text"
                id="supabase-url"
                value={config.apiUrl}
                onChange={(e) => handleConfigChange({ apiUrl: e.target.value })}
                placeholder="https://your-project.supabase.co"
                className="w-full p-2 bg-base-200 border border-base-300 rounded-md text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
              />
            </div>

            <div>
              <label htmlFor="supabase-key" className="block text-sm font-medium text-text-secondary mb-1">
                API Key
              </label>
              <input
                type="password"
                id="supabase-key"
                value={config.apiKey}
                onChange={(e) => handleConfigChange({ apiKey: e.target.value })}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full p-2 bg-base-200 border border-base-300 rounded-md text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
              />
              <p className="text-xs text-text-secondary mt-1">
                Use your Supabase anon/public key or service role key
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={config.autoSync}
                  onChange={(e) => handleConfigChange({ autoSync: e.target.checked })}
                  className="rounded border-base-300 text-brand-primary focus:ring-brand-primary focus:ring-offset-0"
                />
                Auto-sync data
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-base-300">
            <div className="flex items-center gap-2">
              {getStatusIcon(config.connectionStatus)}
              <span className="text-sm text-text-secondary">
                {getStatusText(config.connectionStatus)}
              </span>
              {config.errorMessage && (
                <span className="text-xs text-red-500">
                  - {config.errorMessage}
                </span>
              )}
            </div>
            <button
              onClick={testConnection}
              disabled={isTestingConnection || !config.apiUrl || !config.apiKey}
              className="px-3 py-1 text-xs bg-base-300 hover:bg-base-300/80 text-text-secondary rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTestingConnection ? 'Testing...' : 'Test Connection'}
            </button>
          </div>

          {config.lastConnectionTest && (
            <p className="text-xs text-text-secondary">
              Last tested: {config.lastConnectionTest.toLocaleString()}
            </p>
          )}
        </>
      )}

      {!databaseEnabled && (
        <div className="text-sm text-text-secondary bg-base-200 p-3 rounded-md">
          <p>Cloud storage is disabled. Your abstracts will be stored locally only.</p>
          <p className="mt-1 text-xs">Enable cloud storage to sync your work across devices and collaborate with others.</p>
        </div>
      )}
    </div>
  );
};

export default SupabaseMCPConfigComponent;