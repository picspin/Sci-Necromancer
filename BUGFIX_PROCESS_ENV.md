# Bug Fix: process.env.API_KEY Error

## Issue
The application was failing to load with the error:
```
Uncaught ReferenceError: process is not defined at gemini.ts:5:38
```

## Root Cause
The `lib/llm/gemini.ts` file was trying to access `process.env.API_KEY` which is a Node.js-specific API that doesn't exist in the browser environment.

```typescript
// ❌ This doesn't work in the browser
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
```

## Solution
Implemented lazy initialization of the Google AI client with API key retrieval from localStorage or function parameters:

```typescript
// ✅ Browser-compatible solution
let aiClient: GoogleGenAI | null = null;

const getAIClient = (apiKey?: string): GoogleGenAI => {
  const key = apiKey || localStorage.getItem('google-api-key') || '';
  if (!key) {
    throw new Error("Google API key not configured. Please add your API key in settings.");
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
};
```

## Changes Made

### 1. Removed Direct Initialization
- Removed `const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });`
- Added lazy initialization pattern

### 2. Updated callGeminiAPI Function
- Added `apiKey?: string` parameter
- Uses `getAIClient(apiKey)` instead of global `ai` instance

### 3. Updated All Export Functions
- `analyzeContent` - passes apiKey to callGeminiAPI
- `suggestAbstractType` - passes apiKey to callGeminiAPI
- `generateFinalAbstract` - passes apiKey to callGeminiAPI
- `generateCreativeAbstract` - passes apiKey to callGeminiAPI
- `generateImage` - uses getAIClient(apiKey)

## API Key Management

The application now supports multiple ways to provide the API key:

1. **Function Parameter**: Pass apiKey directly to any function
   ```typescript
   await analyzeContent(text, 'your-api-key');
   ```

2. **LocalStorage**: Store in browser's localStorage
   ```typescript
   localStorage.setItem('google-api-key', 'your-api-key');
   ```

3. **Settings Context**: The SettingsContext should manage the API key
   ```typescript
   const { settings } = useContext(SettingsContext);
   await analyzeContent(text, settings.googleApiKey);
   ```

## Testing
After this fix:
- ✅ Application loads without errors
- ✅ No `process is not defined` error
- ✅ API key can be configured through settings
- ✅ All LLM functions work with proper API key

## Related Files
- `lib/llm/gemini.ts` - Fixed file
- `context/SettingsContext.tsx` - Manages API keys
- `components/ModelManager.tsx` - UI for API key configuration

## Notes
- The Tailwind CDN warning is expected in development and doesn't affect functionality
- The MutationObserver error is unrelated to this fix
- Supabase errors are expected if database is not configured (optional feature)
