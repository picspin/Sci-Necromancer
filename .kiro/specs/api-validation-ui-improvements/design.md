# Design Document

## Overview

This design addresses the API key validation failures for OpenAI-compatible providers and streamlines the Model Manager UI. The current implementation uses the `/chat/completions` endpoint for validation, which returns 400 errors for most providers except OpenRouter. The solution switches to using the `/v1/models` endpoint for validation and introduces a model dropdown populated from the provider's available models list.

The UI improvements focus on consistency between Google AI and OpenAI-compatible provider configurations, embedding validation buttons within input fields, and removing redundant testing functionality.

## Architecture

### Current Flow
1. User enters API key and Base URL
2. Clicks "Validate Key" button (separate from input)
3. System calls `/chat/completions` with minimal test request
4. User manually types model names
5. User clicks separate "Test Model Access" button

### Proposed Flow
1. User enters API key and Base URL
2. Clicks embedded "Validate" button (inside input field)
3. System calls `/v1/models` endpoint
4. On success, automatically populates model dropdown
5. User selects model from dropdown
6. Settings are saved

## Components and Interfaces

### Modified Components

#### ModelManager.tsx
The main component requiring updates:

**State Changes:**
- Remove `isTestingModels` and `modelTestResult` states
- Add `availableModels` state: `string[]`
- Add `isLoadingModels` state: `boolean`

**UI Changes:**
- Embed "Validate" button inside API key input (far right)
- Replace text input for models with dropdown select
- Add loading arrow icon to model dropdown
- Simplify helper text for OpenAI-compatible providers
- Remove "Test Model Access" button
- Maintain consistent styling between Google AI and OpenAI tabs

#### lib/llm/openai.ts
Update validation and add model fetching:

**New Function:**
```typescript
export const fetchAvailableModels = async (
  apiKey: string, 
  baseURL?: string
): Promise<string[]>
```

**Modified Function:**
```typescript
export const validateOpenAIApiKey = async (
  apiKey: string, 
  baseURL?: string
): Promise<{ valid: boolean; error?: string; models?: string[] }>
```

**Removed Function:**
- `testModelAvailability` (no longer needed)

### API Integration

#### Models List Endpoint
**Endpoint:** `{baseURL}/v1/models`
**Method:** GET
**Headers:**
```typescript
{
  'Authorization': `Bearer ${apiKey}`,
  'Content-Type': 'application/json'
}
```

**Response Format:**
```typescript
{
  data: Array<{
    id: string;
    object: string;
    created: number;
    owned_by: string;
  }>;
}
```

**URL Construction:**
- Handle Base URLs with/without trailing slashes
- Avoid path duplication if Base URL already contains `/v1`
- Construct as: `baseURL.replace(/\/$/, '') + '/models'` if baseURL ends with `/v1`
- Otherwise: `baseURL.replace(/\/$/, '') + '/v1/models'`

## Data Models

### Settings Interface (types.ts)
No changes required - existing structure supports the design:
```typescript
interface Settings {
  provider: AIProvider;
  openAITextModel: string;
  openAIVisionModel: string;
  openAIApiKey: string;
  openAIBaseURL: string;
  googleApiKey: string;
  // ... other fields
}
```

### Validation Response
```typescript
interface ValidationResult {
  valid: boolean;
  error?: string;
  models?: string[];  // New field
}
```

## Error Handling

### Validation Errors

**400 Bad Request:**
- Message: "API key validation failed. Please check your API key and Base URL."
- Indicates invalid credentials or malformed request

**401 Unauthorized:**
- Message: "Invalid API key or unauthorized."
- Clear authentication failure

**403 Forbidden:**
- Message: "Access forbidden. Check API key permissions."
- Valid key but insufficient permissions

**404 Not Found:**
- Message: "Endpoint not found. Please verify your Base URL."
- Incorrect Base URL configuration

**429 Rate Limit:**
- Message: "Rate limit exceeded. Please try again in a few moments."
- Treat as successful validation (key is valid)

**Network Errors:**
- Message: "Validation failed due to network error. Please check your connection."
- Connectivity issues

### Model Loading Errors

**Empty Models List:**
- Display: "No models available. Please check your API key permissions."
- Allow user to manually enter model name as fallback

**Parsing Errors:**
- Log error and display: "Failed to load models list. Please enter model name manually."
- Graceful degradation to text input

## UI/UX Design

### Input Field with Embedded Button

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ API Key                                         │
│ ┌─────────────────────────────────────────────┐ │
│ │ ••••••••••••••••••••••••    [Validate]      │ │
│ └─────────────────────────────────────────────┘ │
│ ✓ Valid  or  ✗ Error message                   │
└─────────────────────────────────────────────────┘
```

**Implementation:**
- Use relative positioning for input wrapper
- Position button absolutely at right edge
- Add padding-right to input to prevent text overlap
- Match button styling to existing design system

### Model Dropdown

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Text Model                                      │
│ ┌─────────────────────────────────────────────┐ │
│ │ gpt-4o                              ▼       │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**States:**
- Disabled: Before successful validation (gray background)
- Loading: Show spinner icon instead of arrow
- Active: Populated with models, arrow icon on right
- Empty: Fallback to text input if no models available

**Dropdown Options:**
- Display model ID as option text
- Sort alphabetically
- Highlight currently selected model
- Max height with scroll for long lists

### Helper Text Simplification

**Current (OpenAI tab):**
```
Supported providers:
• OpenAI: https://api.openai.com/v1
• OpenRouter: https://openrouter.ai/api/v1
• SiliconFlow: https://api.siliconflow.cn/v1
• Any OpenAI-compatible API
```

**Proposed:**
```
Supported providers: Any OpenAI-compatible API
```

**Rationale:**
- Reduces visual clutter
- Base URL field provides example placeholder
- Users familiar with their provider's URL
- Maintains consistency with Google AI tab simplicity

## Testing Strategy

### Unit Tests
- URL construction logic for various Base URL formats
- Model list parsing and error handling
- Validation response handling for different status codes

### Integration Tests
- Full validation flow with mock API responses
- Model dropdown population after successful validation
- Error state handling and user feedback
- Settings persistence after model selection

### Manual Testing Checklist
- [ ] Validate with OpenAI official API
- [ ] Validate with OpenRouter
- [ ] Validate with Azure OpenAI (custom endpoint)
- [ ] Validate with SiliconFlow
- [ ] Test with invalid API key
- [ ] Test with malformed Base URL
- [ ] Test with network disconnection
- [ ] Verify model dropdown populates correctly
- [ ] Verify model selection persists to settings
- [ ] Test UI consistency between Google AI and OpenAI tabs
- [ ] Verify embedded button styling and positioning
- [ ] Test dropdown with long model lists (scrolling)

## Implementation Notes

### Backward Compatibility
- Existing settings with manually entered model names remain valid
- If validation fails, allow fallback to manual text input
- No breaking changes to Settings interface

### Performance Considerations
- Cache models list in component state after successful fetch
- Debounce validation requests if user rapidly changes input
- Limit models list to reasonable size (first 100 models if needed)

### Accessibility
- Ensure embedded button is keyboard accessible
- Add proper ARIA labels to dropdown
- Maintain focus management during validation
- Provide screen reader feedback for validation states
