# Implementation Plan

- [x] 1. Core LLM service architecture (COMPLETED)
  - Provider pattern with Google AI and OpenAI support implemented
  - Service dispatcher in `lib/llm/index.ts` working
  - Google AI provider fully functional with structured outputs
  - Basic prompt system established in `lib/llm/prompts/`
  - _Requirements: 2.1, 2.3_

- [x] 2. Complete OpenAI provider implementation
  - Install OpenAI SDK and configure API client
  - Implement all LLM functions using OpenAI API (GPT-4, GPT-4-vision, DALL-E 3)
  - Add structured output using function calling for consistent responses
  - Implement retry logic and rate limiting for API calls
  - Add API key configuration and validation
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2.1 Install OpenAI dependencies and setup
  - Add `openai` package to dependencies
  - Create OpenAI client configuration with API key management
  - Add environment variable handling for OpenAI API key
  - _Requirements: 2.1, 2.4_

- [x] 2.2 Implement OpenAI text analysis functions
  - Create `analyzeContent` function using GPT-4 with structured output
  - Implement `suggestAbstractType` with function calling
  - Add `generateFinalAbstract` and `generateCreativeAbstract` functions
  - Ensure output schemas match existing Gemini implementation
  - _Requirements: 2.1, 2.3_

- [x] 2.3 Implement OpenAI image generation
  - Create image generation using DALL-E 3 for creative mode
  - Implement image analysis and editing using GPT-4-vision for standard mode
  - Add image format validation and optimization
  - _Requirements: 2.1, 2.3_

- [x] 2.4 Add OpenAI API configuration and error handling
  - Implement API key management in settings context
  - Add retry mechanisms with exponential backoff
  - Create fallback error messages and recovery options
  - _Requirements: 2.4, 2.5_

- [x] 3. Implement file processing service for PDF and DOCX
  - Install and configure `pdf-parse` library for PDF text extraction
  - Install and configure `mammoth.js` library for DOCX parsing
  - Create unified file processing service with type validation
  - Add file size limits and error handling for unsupported formats
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 3.1 Install file processing dependencies
  - Add `pdf-parse` and `mammoth` packages to dependencies
  - Configure build system to handle binary dependencies
  - Add type definitions for file processing libraries
  - _Requirements: 1.1, 1.2_

- [x] 3.2 Create PDF processing module
  - Replace placeholder in `lib/file/file-process/pdf.ts` with real implementation
  - Implement PDF text extraction using `pdf-parse`
  - Add support for multi-page documents
  - Handle encrypted or corrupted PDF files gracefully
  - _Requirements: 1.1, 1.3_

- [x] 3.3 Create DOCX processing module
  - Replace placeholder in `lib/file/file-process/docx.ts` with real implementation
  - Implement DOCX parsing using `mammoth.js`
  - Extract text content while preserving basic formatting
  - Handle complex document structures and embedded objects
  - _Requirements: 1.2, 1.3_

- [x] 3.4 Implement unified file processing service
  - Create `FileProcessingService` with provider pattern
  - Add file type detection and validation
  - Implement file size limits (10MB) and security checks
  - Integrate with existing file upload in ISMRMPanel
  - _Requirements: 1.4, 1.5_

- [x] 3. Complete OpenAI provider implementation
  - Implement all LLM functions using OpenAI API (GPT-4, GPT-4-vision, DALL-E 3)
  - Add structured output using function calling for consistent responses
  - Implement retry logic and rate limiting for API calls
  - Add API key configuration and validation
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3.1 Implement OpenAI text analysis functions
  - Create `analyzeContent` function using GPT-4
  - Implement `suggestAbstractType` with structured output
  - Add `generateFinalAbstract` and `generateCreativeAbstract` functions
  - _Requirements: 2.1, 2.3_

- [x] 3.2 Implement OpenAI image generation
  - Create image generation using DALL-E 3 for creative mode
  - Implement image analysis and editing using GPT-4-vision for standard mode
  - Add image format validation and optimization
  - _Requirements: 2.1, 2.3_

- [x] 3.3 Add OpenAI API configuration and error handling
  - Implement API key management and validation
  - Add retry mechanisms with exponential backoff
  - Create fallback error messages and recovery options
  - _Requirements: 2.4, 2.5_

- [x] 4. Interactive UI components for ISMRM workflow (COMPLETED)
  - Category and keyword selection popup with color coding implemented
  - Abstract type suggestion popup with probability display working
  - Loading states and animations already functional
  - Modal system and responsive design in place
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 5. Occam Content Classifier (COMPLETED)
  - Classification logic implemented in `lib/llm/prompts/ismrmPrompts.ts`
  - Routing rules based on categories already working
  - Probability calculation and threshold filtering (≥30%) functional
  - Simple prompt building and response parsing in place
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 6. Abstract generation with writing style requirements (COMPLETED)
  - Writing style guidelines implemented in `lib/llm/prompts/ismrmData.ts`
  - AI tone elimination and colloquialism detection integrated
  - Rhythm control and natural expression enhancement in prompts
  - Style requirements integrated into prompt generation
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 4. Implement export service with multiple formats
  - Create PDF export using `jsPDF` with academic formatting
  - Implement DOCX export using `docx` library with template support
  - Add JSON export for programmatic access
  - Create conference-specific formatting templates
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4.1 Install export dependencies
  - Add `jspdf`, `docx`, and related packages to dependencies
  - Configure build system for export libraries
  - Add type definitions for export functionality
  - _Requirements: 3.1, 3.2_

- [x] 4.2 Create PDF export functionality
  - Replace basic markdown export in `components/export/ExportButtons.tsx`
  - Implement PDF generation using `jsPDF`
  - Add academic formatting with proper margins and fonts
  - Create template system for different conference requirements
  - _Requirements: 3.1, 3.4_

- [x] 4.3 Implement DOCX export
  - Create Word document generation using `docx` library
  - Add formatting templates compatible with Microsoft Word
  - Implement custom styling and layout options
  - _Requirements: 3.2, 3.4_

- [x] 4.4 Add JSON export and preview functionality
  - Create JSON export with complete abstract data
  - Implement export preview before download
  - Add metadata inclusion options
  - _Requirements: 3.3, 3.5_

- [x] 5. Add database integration for saving and managing abstracts
  - Implement localStorage for offline functionality
  - Add optional Supabase integration for cloud sync
  - Create abstract management interface (save, load, delete)
  - Implement conflict resolution for offline/online sync
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 5.1 Install database dependencies
  - Add `@supabase/supabase-js` package for cloud integration
  - Configure environment variables for Supabase connection
  - Add type definitions for database models
  - _Requirements: 8.2_

- [x] 5.2 Create local storage service
  - Implement `DatabaseService` with localStorage backend
  - Add abstract saving, loading, and deletion functionality
  - Create data validation and migration handling
  - _Requirements: 8.1, 8.3_

- [x] 5.3 Add Supabase cloud integration
  - Implement optional cloud storage using Supabase
  - Add user authentication and data synchronization
  - Create conflict resolution for offline/online data
  - _Requirements: 8.2, 8.4, 8.5_

- [x] 5.4 Create abstract management interface
  - Add UI for viewing saved abstracts list
  - Implement load, edit, and delete functionality
  - Create search and filtering capabilities
  - _Requirements: 8.3, 8.4_

- [x] 6. Implement comprehensive error handling and recovery
  - Create error boundary components for graceful failure handling
  - Add retry mechanisms for API calls and file processing
  - Implement offline mode fallbacks and user notifications
  - Create error logging system with privacy protection
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 6.1 Create error boundary system
  - Implement `ServiceErrorBoundary` for service-level errors
  - Add `ComponentErrorBoundary` for UI-level errors
  - Create recovery options and user-friendly error messages
  - _Requirements: 5.1, 5.3_

- [x] 6.2 Add retry and fallback mechanisms
  - Implement exponential backoff for API calls in LLM services
  - Add provider switching for LLM failures
  - Create offline mode with limited functionality
  - _Requirements: 5.2, 5.3, 5.5_

- [x] 6.3 Implement error logging and monitoring
  - Create privacy-safe error logging system
  - Add error categorization and reporting
  - Implement user feedback collection for errors
  - _Requirements: 5.4, 5.5_

- [x] 7. Add RSNA and JACC conference support
  - Create RSNA-specific templates and prompts
  - Implement JACC journal requirements and formatting
  - Add conference selection and validation logic
  - Update UI to support multiple conference workflows
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 7.1 Implement RSNA conference support
  - Create RSNA-specific prompt templates and guidelines
  - Add radiology-focused formatting requirements
  - Implement RSNA validation rules and word limits
  - Create RSNAPanel component similar to ISMRMPanel
  - _Requirements: 4.1, 4.2_

- [x] 7.2 Add JACC journal support
  - Create JACC-specific templates and guidelines
  - Implement cardiology journal formatting requirements
  - Add JACC submission validation and export options
  - Create JACCPanel component for journal workflow
  - _Requirements: 4.1, 4.2_

- [x] 7.3 Update conference selection UI
  - Enable RSNA and JACC tabs in ConferencePanel
  - Add conference-specific workflow components
  - Implement dynamic template loading based on selection
  - _Requirements: 4.3, 4.4_

- [ ]* 8. Create comprehensive test suite
  - Write unit tests for all service modules
  - Add integration tests for API interactions and workflows
  - Create end-to-end tests for complete user journeys
  - Implement snapshot tests for UI consistency
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ]* 8.1 Setup testing infrastructure
  - Install Jest, React Testing Library, and Playwright
  - Configure test environment and mock setup
  - Add test scripts to package.json
  - _Requirements: 6.1_

- [ ]* 8.2 Write unit tests for services
  - Test file processing modules with mock files
  - Add LLM provider tests with API mocking
  - Create database service tests with localStorage mocking
  - _Requirements: 6.1_

- [ ]* 8.3 Add integration tests
  - Test complete abstract generation workflow
  - Add file upload and processing integration tests
  - Create export functionality integration tests
  - _Requirements: 6.2_

- [ ]* 8.4 Implement end-to-end tests
  - Create complete user journey tests using Playwright
  - Add error recovery and fallback testing
  - Test accessibility compliance and keyboard navigation
  - _Requirements: 6.3, 6.5_

- [ ]* 8.5 Add UI snapshot tests
  - Create component snapshot tests for consistency
  - Add visual regression testing for popups and animations
  - Test responsive design across different screen sizes
  - _Requirements: 6.4_

- [ ] 9. Improve accessibility and user experience（updated）

  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 9.1 Implement accessibility features
  - Add ARIA labels to all interactive components
  - Create semantic HTML structure for screen readers
  - Implement proper focus management and tab order
  - _Requirements: 7.1, 7.2_

- [ ] 9.2 Add keyboard navigation support
  - Enable full keyboard navigation for popups and forms
  - Add keyboard shortcuts for common actions
  - Create visible focus indicators throughout the interface
  - _Requirements: 7.2, 7.4_

- [ ] 9.3 Create responsive design improvements
  - Add high contrast mode toggle
  - Implement responsive layouts for mobile and tablet
  - Create adaptive font sizing and spacing
  - _Requirements: 7.3, 7.5_

- [ ] 9.4 Add help system and tooltips
  - Create contextual help text for complex features
  - Add tooltips for all buttons and interactive elements
  - Implement guided tour for new users
  - _Requirements: 7.4, 7.5_