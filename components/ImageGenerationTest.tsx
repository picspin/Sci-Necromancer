import React, { useState } from 'react';
import { testImageGenerationSetup } from '../lib/llm/openai';

interface TestResult {
  success: boolean;
  message: string;
  details: any;
}

export const ImageGenerationTest: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [apiKey, setApiKey] = useState('');

  const runTest = async () => {
    if (!apiKey.trim()) {
      setTestResult({
        success: false,
        message: 'Please enter your API key',
        details: {}
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await testImageGenerationSetup(apiKey);
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: {}
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Image Generation Setup Test</h2>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          API Key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter your API key"
        />
      </div>

      <button
        onClick={runTest}
        disabled={isLoading}
        className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Testing...' : 'Test Image Generation Setup'}
      </button>

      {testResult && (
        <div className={`mt-6 p-4 rounded-md ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className={`font-medium ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
            {testResult.success ? '✅ Success' : '❌ Issues Found'}
          </div>
          <div className={`mt-2 ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
            {testResult.message}
          </div>
          
          {testResult.details && (
            <div className="mt-4">
              <h3 className="font-medium text-gray-800 mb-2">Test Details:</h3>
              <div className="bg-gray-50 p-3 rounded text-sm">
                <div><strong>Platform:</strong> {testResult.details.platform}</div>
                <div><strong>Base URL:</strong> {testResult.details.baseUrl}</div>
                <div><strong>Image Model:</strong> {testResult.details.imageModel}</div>
                
                {testResult.details.modelCapabilities && (
                  <div className="mt-2">
                    <strong>Model Capabilities:</strong>
                    <ul className="ml-4 mt-1">
                      <li>Can Generate Images: {testResult.details.modelCapabilities.canGenerateImages ? '✅' : '❌'}</li>
                      <li>Can Analyze Images: {testResult.details.modelCapabilities.canAnalyzeImages ? '✅' : '❌'}</li>
                      <li>Is Multi-Modal: {testResult.details.modelCapabilities.isMultiModal ? '✅' : '❌'}</li>
                      <li>Recommended Approach: {testResult.details.modelCapabilities.recommendedApproach()}</li>
                    </ul>
                  </div>
                )}
                
                {testResult.details.availableTools && testResult.details.availableTools.length > 0 && (
                  <div className="mt-2">
                    <strong>Available Tools:</strong> {testResult.details.availableTools.join(', ')}
                  </div>
                )}
                
                {testResult.details.testAttempts && testResult.details.testAttempts.length > 0 && (
                  <div className="mt-2">
                    <strong>Test Results:</strong>
                    <ul className="ml-4 mt-1">
                      {testResult.details.testAttempts.map((attempt: string, index: number) => (
                        <li key={index} className="text-xs">{attempt}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ImageGenerationTest;