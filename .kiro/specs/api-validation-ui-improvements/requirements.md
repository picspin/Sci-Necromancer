# Requirements Document

## Introduction

This feature addresses critical issues with API key validation across different OpenAI-compatible providers and improves the Model Manager UI for better user experience. The current validation approach fails for most providers (returning 400 errors) except OpenRouter, while actual model usage works correctly. The UI also needs streamlining to provide a more cohesive experience between Google AI and OpenAI-compatible provider configurations.

## Glossary

- **Model Manager**: The UI component that allows users to configure API keys and models for different LLM providers
- **OpenAI-compatible Provider**: Any API service that implements the OpenAI API specification (e.g., Azure OpenAI, SiliconFlow, OpenRouter)
- **API Key Validation**: The process of verifying that an API key is valid and can authenticate with the provider
- **Model List Endpoint**: The API endpoint used to retrieve available models from a provider
- **Base URL**: The root URL for an OpenAI-compatible API provider

## Requirements

### Requirement 1

**User Story:** As a user configuring an OpenAI-compatible provider, I want the API key validation to work correctly across all providers, so that I can verify my credentials without encountering false negatives.

#### Acceptance Criteria

1. WHEN the user clicks validate on an OpenAI-compatible API key, THE Model Manager SHALL send a request to the provider's `/v1/models` endpoint
2. IF the models list request returns a 200 status code, THEN THE Model Manager SHALL display a success message
3. IF the models list request returns a 400 status code, THEN THE Model Manager SHALL display an error message indicating validation failure
4. IF the models list request returns an error other than 400, THEN THE Model Manager SHALL display the error message from the response
5. THE Model Manager SHALL use the `/v1/models` endpoint for API key validation

### Requirement 2

**User Story:** As a user, I want to select models from a dropdown list instead of manually typing model names, so that I can easily choose from available models and avoid typos.

#### Acceptance Criteria

1. WHEN the user has validated their API key successfully, THE Model Manager SHALL automatically fetch and populate the available models list
2. THE Model Manager SHALL display the model selection as a dropdown with a loading arrow icon on the far right side
3. WHEN the user clicks the model dropdown, THE Model Manager SHALL display all available models from the provider
4. THE Model Manager SHALL allow users to select a model from the dropdown list
5. THE Model Manager SHALL save the selected model to the user's settings

### Requirement 3

**User Story:** As a user, I want a streamlined UI for configuring OpenAI-compatible providers, so that the interface is consistent with the Google AI configuration and easier to use.

#### Acceptance Criteria

1. THE Model Manager SHALL display simplified helper text for OpenAI-compatible providers showing only "Supported providers: Any OpenAI-compatible API"
2. THE Model Manager SHALL embed the "Validate" button on the far right side of the API key input box for both Google AI and OpenAI-compatible providers
3. THE Model Manager SHALL remove the separate "Test Model" button since model availability verification is handled by the validation step
4. THE Model Manager SHALL maintain visual consistency between Google AI and OpenAI-compatible provider configuration sections
5. THE Model Manager SHALL display the Base URL input field for OpenAI-compatible providers with appropriate placeholder text

### Requirement 4

**User Story:** As a user with an Azure OpenAI or other custom provider, I want the validation to work with my specific endpoint, so that I can use enterprise or custom API deployments.

#### Acceptance Criteria

1. WHEN the user provides a custom Base URL, THE Model Manager SHALL use that URL for all API requests including validation
2. THE Model Manager SHALL append the correct path (`/v1/models`) to the Base URL for model list retrieval
3. IF the Base URL already contains a version path, THE Model Manager SHALL handle path construction correctly to avoid duplication
4. THE Model Manager SHALL support Base URLs with or without trailing slashes
5. THE Model Manager SHALL display clear error messages if the Base URL format is invalid

### Requirement 5

**User Story:** As a user, I want immediate feedback when my API key validation succeeds, so that I know I can proceed with using the configured provider.

#### Acceptance Criteria

1. WHEN API key validation succeeds, THE Model Manager SHALL display a success notification
2. WHEN API key validation succeeds, THE Model Manager SHALL automatically load the available models into the dropdown
3. THE Model Manager SHALL display a loading indicator while fetching models during validation
4. THE Model Manager SHALL persist the validated API key and Base URL to settings
5. THE Model Manager SHALL enable the model dropdown only after successful validation
