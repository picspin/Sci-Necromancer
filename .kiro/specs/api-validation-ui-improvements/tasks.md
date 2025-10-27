# Implementation Plan

- [ ] 1. Update OpenAI validation and add model fetching functionality
  - Modify `validateOpenAIApiKey` function in `lib/llm/openai.ts` to use `/v1/models` endpoint instead of `/chat/completions`
  - Add `fetchAvailableModels` function to retrieve and parse models list from provider
  - Implement URL construction logic to handle Base URLs with/without trailing slashes and `/v1` paths
  - Update validation response to include models array
  - Remove `testModelAvailability` function as it's no longer needed
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 4.2, 4.3, 4.4_

- [ ] 2. Update ModelManager component state and handlers
  - Remove `isTestingModels` and `modelTestResult` state variables
  - Add `availableModels` state as string array
  - Add `isLoadingModels` boolean state
  - Update `handleValidateApiKey` to fetch models on successful validation and populate `availableModels`
  - Remove `handleTestModels` function
  - _Requirements: 2.1, 2.5, 5.2, 5.3_

- [ ] 3. Redesign API key input with embedded validation button
  - Refactor API key input field for both Google AI and OpenAI tabs to use relative positioning wrapper
  - Position "Validate" button absolutely at the far right inside the input field
  - Add appropriate padding-right to input to prevent text overlap with button
  - Ensure consistent styling between Google AI and OpenAI-compatible provider sections
  - _Requirements: 3.2, 3.4, 5.1_

- [ ] 4. Implement model dropdown selection UI
  - Replace text input fields for `openAITextModel` and `openAIVisionModel` with dropdown select elements
  - Add loading arrow icon on the far right side of dropdown
  - Populate dropdown options from `availableModels` state
  - Disable dropdown until successful API key validation
  - Show loading spinner during model fetch
  - Implement fallback to text input if models list is empty or fails to load
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 5.5_

- [ ] 5. Simplify UI helper text and remove test button
  - Update helper text for OpenAI-compatible providers to show only "Supported providers: Any OpenAI-compatible API"
  - Remove the "Test Model Access" button and related UI elements
  - Update Base URL placeholder text to provide clear example
  - _Requirements: 3.1, 3.3_

- [ ] 6. Add comprehensive error handling and user feedback
  - Implement specific error messages for different HTTP status codes (400, 401, 403, 404, 429)
  - Handle network errors gracefully with appropriate user messaging
  - Display validation success notification
  - Show loading indicators during validation and model fetching
  - Handle empty models list with fallback option
  - _Requirements: 1.3, 1.4, 4.5, 5.1, 5.4_

- [ ]* 7. Add validation and integration tests
  - Write tests for URL construction logic with various Base URL formats
  - Test model list parsing and error handling
  - Test validation response handling for different status codes
  - Test full validation flow with mock API responses
  - Test model dropdown population and selection persistence
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.5, 4.2, 4.3, 4.4_
