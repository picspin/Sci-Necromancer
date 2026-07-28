import {
  AbstractData,
  ImageState,
  AnalysisResult,
  Category,
  AbstractType,
  AbstractTypeSuggestion,
  BlindReviewModelAssessment,
} from '../../types';
import * as prompts from './prompts/ismrmPrompts';
import {
  getRSNAAnalysisPrompt,
  getRSNACreativePrompt,
  getRSNAGenerationPrompt,
  type RSNAPromptInput,
} from './prompts/rsnaPrompts';
import {
  enforceRSNASourceFidelity,
  normalizeRSNAAnalysis,
  normalizeRSNAKeywords,
  validateRSNADraft,
} from '../conference/rsnaRules';
import { assertBlindReviewAssessment } from '../review/blindReview';

// Get settings from localStorage
const getSettings = () => {
  try {
    const savedSettings = localStorage.getItem('app-settings');
    if (savedSettings) {
      return JSON.parse(savedSettings);
    }
  } catch (e) {
    console.error('Failed to get settings:', e);
  }
  return {};
};

// Call OpenAI-compatible API
async function callOpenAIAPI(
  prompt: string,
  apiKey: string,
  baseUrl: string,
  model: string
): Promise<any> {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert academic medical submission editor. Follow the conference-specific user instructions and always respond with valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API call failed: ${response.status} ${response.statusText}\n${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No content in API response');
  }

  try {
    return JSON.parse(content);
  } catch {
    // Return raw content if not JSON
    return content;
  }
}

export async function analyzeContent(text: string, apiKey?: string): Promise<AnalysisResult> {
  const settings = getSettings();
  const finalApiKey = apiKey || settings.openAIApiKey;
  if (!finalApiKey) {
    throw new Error('OpenAI API key is required');
  }
  const baseUrl = settings.openAIBaseUrl || 'https://api.openai.com/v1';
  const model = settings.openAITextModel || 'gpt-4o';

  const prompt = await prompts.getAnalysisPrompt(text);
  return await callOpenAIAPI(prompt, finalApiKey, baseUrl, model);
}

export async function suggestAbstractType(
  text: string,
  categories: Category[],
  keywords: string[],
  apiKey?: string
): Promise<AbstractTypeSuggestion[]> {
  const settings = getSettings();
  const finalApiKey = apiKey || settings.openAIApiKey;
  if (!finalApiKey) {
    throw new Error('OpenAI API key is required');
  }
  const baseUrl = settings.openAIBaseUrl || 'https://api.openai.com/v1';
  const model = settings.openAITextModel || 'gpt-4o';

  const prompt = await prompts.getAbstractTypeSuggestionPrompt(text, categories, keywords);
  const result = await callOpenAIAPI(prompt, finalApiKey, baseUrl, model);

  // Handle both array and object with suggestions field
  let suggestions = Array.isArray(result) ? result : result?.suggestions || [];

  // Ensure suggestions is always an array
  if (!Array.isArray(suggestions)) {
    console.warn(
      'suggestAbstractType: suggestions is not an array, got:',
      typeof suggestions,
      suggestions
    );
    suggestions = [];
  }

  return suggestions
    .filter((s: AbstractTypeSuggestion) => s.probability >= 0.3)
    .sort((a: AbstractTypeSuggestion, b: AbstractTypeSuggestion) => b.probability - a.probability);
}

export async function generateImpactSynopsis(
  text: string,
  categories: Category[],
  keywords: string[],
  apiKey?: string
): Promise<{ impact: string; synopsis: string }> {
  const settings = getSettings();
  const finalApiKey = apiKey || settings.openAIApiKey;
  if (!finalApiKey) {
    throw new Error('OpenAI API key is required');
  }
  const baseUrl = settings.openAIBaseUrl || 'https://api.openai.com/v1';
  const model = settings.openAITextModel || 'gpt-4o';

  const prompt = await prompts.getImpactSynopsisPrompt(text, categories, keywords);
  return await callOpenAIAPI(prompt, finalApiKey, baseUrl, model);
}

export async function generateFinalAbstract(
  text: string,
  type: AbstractType,
  categories: Category[],
  keywords: string[],
  impact: string,
  synopsis: string,
  apiKey?: string
): Promise<AbstractData> {
  const settings = getSettings();
  const finalApiKey = apiKey || settings.openAIApiKey;
  if (!finalApiKey) {
    throw new Error('OpenAI API key is required');
  }
  const baseUrl = settings.openAIBaseUrl || 'https://api.openai.com/v1';
  const model = settings.openAITextModel || 'gpt-4o';

  const prompt = await prompts.getFinalAbstractPrompt(
    text,
    type,
    categories,
    keywords,
    impact,
    synopsis
  );
  // Try JSON first; if provider returns plaintext, construct AbstractData
  try {
    const res = await callOpenAIAPI(prompt, finalApiKey, baseUrl, model);
    // If res is a string (plaintext), wrap it into AbstractData
    if (typeof res === 'string') {
      return { abstract: res, impact, synopsis, keywords } as any;
    }
    return res;
  } catch (err) {
    const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${finalApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert academic writer specializing in ISMRM submissions.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      }),
    });
    if (!response.ok) throw err;
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    return { abstract: String(content), impact, synopsis, keywords } as any;
  }
}

export async function generateCreativeAbstract(
  coreIdea: string,
  apiKey?: string
): Promise<AbstractData> {
  const settings = getSettings();
  const finalApiKey = apiKey || settings.openAIApiKey;
  if (!finalApiKey) {
    throw new Error('OpenAI API key is required');
  }
  const baseUrl = settings.openAIBaseUrl || 'https://api.openai.com/v1';
  const model = settings.openAITextModel || 'gpt-4o';

  const prompt = await prompts.getCreativeAbstractPrompt(coreIdea);
  return await callOpenAIAPI(prompt, finalApiKey, baseUrl, model);
}

export async function analyzeRSNAContent(
  text: string,
  apiKey?: string,
  auxiliaryLocale: 'en' | 'zh' = 'en'
): Promise<AnalysisResult & { rsna: NonNullable<AnalysisResult['rsna']> }> {
  const settings = getSettings();
  const finalApiKey = apiKey || settings.openAIApiKey;
  if (!finalApiKey) throw new Error('OpenAI API key is required');
  const baseUrl = settings.openAIBaseUrl || 'https://api.openai.com/v1';
  const model = settings.openAITextModel || 'gpt-4o';
  const raw = await callOpenAIAPI(
    getRSNAAnalysisPrompt(text, auxiliaryLocale),
    finalApiKey,
    baseUrl,
    model
  );
  return normalizeRSNAAnalysis(raw, text, auxiliaryLocale);
}

export async function generateRSNAAbstract(
  input: RSNAPromptInput,
  apiKey?: string
): Promise<AbstractData> {
  const settings = getSettings();
  const finalApiKey = apiKey || settings.openAIApiKey;
  if (!finalApiKey) throw new Error('OpenAI API key is required');
  const baseUrl = settings.openAIBaseUrl || 'https://api.openai.com/v1';
  const model = settings.openAITextModel || 'gpt-4o';
  const prompt =
    input.mode === 'creative' ? getRSNACreativePrompt(input) : getRSNAGenerationPrompt(input);
  const raw = await callOpenAIAPI(prompt, finalApiKey, baseUrl, model);
  const result = typeof raw === 'string' ? { abstract: raw } : raw;
  let draft: AbstractData = {
    title: result.title ?? '',
    impact: result.impact ?? '',
    synopsis: result.synopsis ?? '',
    keywords: normalizeRSNAKeywords(input.keywords),
    abstract: result.abstract ?? '',
    categories: [{ name: input.category, type: 'main', probability: 1 }],
    presentationGuidance: Array.isArray(result.presentationGuidance)
      ? result.presentationGuidance
      : [],
    complianceWarnings: Array.isArray(result.complianceWarnings) ? result.complianceWarnings : [],
    rsna: input.classification,
    aiAssistance: {
      generatedAt: new Date().toISOString(),
      provider: 'openai',
      model,
      mode: input.mode,
      operations: ['RSNA classification-aware language editing', 'structure and compliance review'],
      authorVerificationRequired: true,
    },
  };
  draft = enforceRSNASourceFidelity(draft, input.inputText, input.auxiliaryLocale);
  const validation = validateRSNADraft(draft, input.auxiliaryLocale);
  draft.complianceWarnings = [
    ...(draft.complianceWarnings ?? []),
    ...validation.errors,
    ...validation.warnings,
  ];
  return draft;
}

export async function reviewAbstractBlind(
  prompt: string,
  apiKey?: string
): Promise<BlindReviewModelAssessment> {
  const settings = getSettings();
  const finalApiKey = apiKey || settings.openAIApiKey;
  if (!finalApiKey) throw new Error('llm.api_key_missing');
  const raw = await callOpenAIAPI(
    prompt,
    finalApiKey,
    settings.openAIBaseUrl || 'https://api.openai.com/v1',
    settings.openAITextModel || 'gpt-4o'
  );
  return assertBlindReviewAssessment(raw);
}

// ============================================================================
// IMAGE GENERATION - Simplified Architecture
// ============================================================================
// Two paths:
// 1. SiliconFlow: Direct API call to /v1/images/generations
// 2. MCP Tools: Call model with tool access (MyGenAssist, etc.)
// ============================================================================

export async function generateImage(
  imageState: ImageState,
  creativeContext: string,
  apiKey?: string
): Promise<string> {
  const settings = getSettings();
  const finalApiKey = apiKey || settings.openAIApiKey;
  if (!finalApiKey) throw new Error('API key required');

  // Check if MCP image generation is enabled
  if (settings.mcpConfig?.imageGeneration?.enabled) {
    return await generateImageViaMCP(imageState, creativeContext, finalApiKey, settings);
  }

  // Otherwise use SiliconFlow direct API
  return await generateImageViaSiliconFlow(imageState, creativeContext, finalApiKey, settings);
}

// Path 1: SiliconFlow Direct API
async function generateImageViaSiliconFlow(
  imageState: ImageState,
  creativeContext: string,
  apiKey: string,
  settings: any
): Promise<string> {
  const baseUrl = settings.openAIBaseUrl || 'https://api.siliconflow.cn';
  const imageModel = settings.openAIImageModel || 'black-forest-labs/FLUX.1-schnell';

  // Validate image model - common SiliconFlow image generation models
  const validImageModels = [
    'black-forest-labs/FLUX.1-schnell',
    'black-forest-labs/FLUX.1-dev',
    'stabilityai/stable-diffusion-xl-base-1.0',
    'stabilityai/stable-diffusion-3-medium',
    'stabilityai/stable-diffusion-2-1',
  ];

  // Warn if model doesn't look like an image generation model
  const isLikelyImageModel =
    validImageModels.some((m) =>
      imageModel.toLowerCase().includes(m.toLowerCase().split('/')[1])
    ) ||
    imageModel.toLowerCase().includes('flux') ||
    imageModel.toLowerCase().includes('stable-diffusion') ||
    imageModel.toLowerCase().includes('dall-e') ||
    imageModel.toLowerCase().includes('sdxl');

  if (!isLikelyImageModel) {
    console.warn(
      `Warning: "${imageModel}" may not be a valid image generation model. ` +
        `Recommended models: ${validImageModels.join(', ')}`
    );
  }

  // Build prompt
  let prompt: string;
  if (imageState.base64 && imageState.file) {
    // If user uploaded an image, analyze it first with vision model
    const visionModel =
      settings.openAIVisionModel || settings.openAITextModel || 'Qwen/Qwen2-VL-72B-Instruct';
    const analysisPrompt = `Analyze this image and describe it for regeneration. Focus on: ${imageState.specs}`;
    const description = await analyzeImageWithVision(
      imageState,
      analysisPrompt,
      apiKey,
      baseUrl,
      visionModel
    );
    prompt = `${description}\n\nSpecifications: ${imageState.specs}\n\nCreate a professional scientific/medical image.`;
  } else {
    // Creative generation from scratch
    prompt = `Generate a scientific/medical figure: ${creativeContext}. Specifications: ${imageState.specs}. Professional, publication-quality.`;
  }

  // Call SiliconFlow API - strictly following their documentation
  // Remove trailing /v1 if present to avoid duplicate /v1/v1/
  const cleanBaseUrl = baseUrl.replace(/\/$/, '').replace(/\/v1$/, '');
  const response = await fetch(`${cleanBaseUrl}/v1/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: imageModel,
      prompt: prompt,
      image_size: '1024x1024',
      batch_size: 1,
      num_inference_steps: 20,
      guidance_scale: 7.5,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    // Provide more helpful error message for common issues
    if (response.status === 500) {
      throw new Error(
        `Image generation failed (500 error). This usually means the model "${imageModel}" doesn't support image generation. ` +
          `Try using: black-forest-labs/FLUX.1-schnell or stabilityai/stable-diffusion-xl-base-1.0. ` +
          `Original error: ${errorText}`
      );
    }
    throw new Error(`SiliconFlow API failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Extract image URL from response
  const imageUrl = data.images?.[0]?.url;
  if (!imageUrl) {
    throw new Error('No image URL in SiliconFlow response');
  }

  // Download and convert to base64
  const imgResponse = await fetch(imageUrl);
  if (!imgResponse || typeof (imgResponse as any).arrayBuffer !== 'function') {
    // Fallback for test environments where fetch is partially mocked
    return imageUrl;
  }
  const arrayBuffer = await (imgResponse as any).arrayBuffer();
  return arrayBufferToBase64(arrayBuffer);
}

/**
 * Convert ArrayBuffer to base64 string using chunked approach
 * to avoid Maximum call stack size exceeded error on large images
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 32768; // Process in 32KB chunks to avoid stack overflow
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// Path 2: MCP Tool-based Generation (MyGenAssist, etc.)
async function generateImageViaMCP(
  imageState: ImageState,
  creativeContext: string,
  apiKey: string,
  settings: any
): Promise<string> {
  const mcpConfig = settings.mcpConfig?.imageGeneration;
  const baseUrl = mcpConfig.baseUrl || 'https://chat.int.bayer.com/api/v2';
  const model = mcpConfig.model || settings.openAITextModel || 'gpt-4o';

  // Parse custom configuration if provided
  let customHeaders = {};
  if (mcpConfig.customConfig) {
    try {
      const parsed = JSON.parse(mcpConfig.customConfig);
      customHeaders = parsed.customHeaders || {};
    } catch (e) {
      console.warn('Failed to parse custom MCP config:', e);
    }
  }

  // Build prompt
  let prompt: string;
  if (imageState.base64 && imageState.file) {
    const analysisPrompt = `Analyze this image and describe it for regeneration. Focus on: ${imageState.specs}`;
    const description = await analyzeImageWithVision(
      imageState,
      analysisPrompt,
      apiKey,
      baseUrl,
      model
    );
    prompt = `${description}\n\nSpecifications: ${imageState.specs}\n\nCreate a professional scientific/medical image.`;
  } else {
    prompt = `Generate a scientific/medical figure: ${creativeContext}. Specifications: ${imageState.specs}. Professional, publication-quality.`;
  }

  // Call MCP endpoint with tool access
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/agent`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...customHeaders,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content:
            'You are an AI assistant with image generation tools. Generate images as requested and return the image data.',
        },
        {
          role: 'user',
          content: `Generate image: ${prompt}`,
        },
      ],
      temperature: 0.7,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MCP tool call failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Extract image from tool calls
  const toolCalls = data.choices?.[0]?.message?.tool_calls;
  if (toolCalls?.length > 0) {
    for (const call of toolCalls) {
      const args =
        typeof call.function?.arguments === 'string'
          ? JSON.parse(call.function.arguments)
          : call.function?.arguments;
      const imageData = args?.image || args?.image_data || args?.base64;
      if (imageData && imageData.length > 100) {
        return imageData.replace(/^data:image\/[^;]+;base64,/, '');
      }
    }
  }

  // Extract from content as fallback
  const content = data.choices?.[0]?.message?.content;
  if (content) {
    const base64Match = content.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
    if (base64Match) return base64Match[1];
    if (content.match(/^[A-Za-z0-9+/=]{100,}$/)) return content;
  }

  throw new Error('No image data returned from MCP tools');
}

async function analyzeImageWithVision(
  imageState: ImageState,
  prompt: string,
  apiKey: string,
  baseUrl: string,
  visionModel: string
): Promise<string> {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: visionModel,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${imageState.file!.type};base64,${imageState.base64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vision analysis failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const description = data.choices?.[0]?.message?.content;

  if (!description) {
    throw new Error('No content returned from vision model');
  }

  return description;
}

// ============================================================================
// NANOBANANA PRO 3 - GOOGLE GEMINI IMAGE GENERATION
// ============================================================================
// Uses Google's Gemini imagen model for high-quality scientific image generation
// API keys are read from environment variable VITE_NANOBANA_API_KEY
// Supports multiple comma-separated keys for automatic fallback
// Set in .env file: VITE_NANOBANA_API_KEY=key1,key2,key3
// Default model: gemini-3-pro-image-preview (highest quality)
// ============================================================================

// Default model for image generation
const DEFAULT_NANOBANA_MODEL = 'gemini-3-pro-image-preview';

// Track failed API keys in this session (reset on page reload)
const failedApiKeys = new Set<string>();

/**
 * Parse API keys from environment variable
 * Supports comma-separated keys: key1,key2,key3
 */
const parseApiKeys = (): string[] => {
  const rawKeys = import.meta.env.VITE_NANOBANA_API_KEY || '';
  if (!rawKeys || rawKeys === 'your_google_ai_api_key_here') {
    return [];
  }

  // Split by comma and trim whitespace, filter empty strings
  return rawKeys
    .split(',')
    .map((key: string) => key.trim())
    .filter((key: string) => key.length > 0 && key !== 'your_google_ai_api_key_here');
};

/**
 * Get the next available API key (skipping failed ones)
 */
const getNextAvailableKey = (): string | null => {
  const allKeys = parseApiKeys();

  for (const key of allKeys) {
    if (!failedApiKeys.has(key)) {
      return key;
    }
  }

  // All keys have failed - reset and try first key again
  if (allKeys.length > 0 && failedApiKeys.size >= allKeys.length) {
    console.log('All API keys exhausted, resetting failed keys list');
    failedApiKeys.clear();
    return allKeys[0];
  }

  return null;
};

/**
 * Mark an API key as failed (quota exceeded, invalid, etc.)
 */
const markKeyAsFailed = (key: string): void => {
  failedApiKeys.add(key);
  const allKeys = parseApiKeys();
  const remainingKeys = allKeys.filter((k) => !failedApiKeys.has(k)).length;
  console.log(`API key marked as failed. ${remainingKeys}/${allKeys.length} keys remaining.`);
};

/**
 * Get count of available keys
 */
const getKeyStats = (): { total: number; available: number; failed: number } => {
  const allKeys = parseApiKeys();
  const failed = allKeys.filter((k) => failedApiKeys.has(k)).length;
  return {
    total: allKeys.length,
    available: allKeys.length - failed,
    failed,
  };
};

const getNanobanaConfig = () => {
  const apiKey = getNextAvailableKey();

  if (!apiKey) {
    const stats = getKeyStats();
    if (stats.total === 0) {
      throw new Error(
        'Nanobana Pro API key not configured. Please set VITE_NANOBANA_API_KEY in your .env file. ' +
          'You can add multiple keys separated by commas for automatic fallback. ' +
          'Get your API key from: https://aistudio.google.com/apikey'
      );
    } else {
      throw new Error(
        `All ${stats.total} API keys have failed. Please wait and try again, or add more keys to your .env file.`
      );
    }
  }

  // Use environment variable for model or fallback to default (gemini-3-pro-image-preview)
  const model = import.meta.env.VITE_NANOBANA_MODEL || DEFAULT_NANOBANA_MODEL;

  return {
    apiKey,
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model,
  };
};

export async function generateImageNanobana(
  imageState: ImageState,
  specsJson: string,
  _apiKey?: string
): Promise<string> {
  // Determine if we have multiple images
  const hasMultipleImages = imageState.uploadedImages && imageState.uploadedImages.length > 0;
  const imageCount = hasMultipleImages
    ? imageState.uploadedImages!.length
    : imageState.base64
      ? 1
      : 0;

  // Build the prompt for image generation
  let prompt: string;

  if (hasMultipleImages || (imageState.base64 && imageState.file)) {
    // Image-to-image mode: analyze and enhance the uploaded image(s)
    const imageDesc =
      imageCount > 1
        ? `these ${imageCount} scientific/medical images`
        : 'this scientific/medical image';
    prompt = `Analyze and enhance ${imageDesc} based on the following specifications: ${specsJson || imageState.specs}.
    Create a professional, publication-quality scientific figure suitable for academic conferences like ISMRM, RSNA, or ECR.
    ${imageCount > 1 ? 'Combine and arrange the images into a cohesive figure layout.' : ''}
    Ensure clear labeling, proper color schemes, and high visual quality.`;
  } else {
    // Text-to-image mode: generate from scratch
    prompt = `Generate a professional scientific/medical figure based on these specifications: ${specsJson || imageState.specs}.
    Create a publication-quality image suitable for academic conferences.
    Focus on clarity, proper scientific visualization, and professional aesthetics.`;
  }

  // Build parts array for the request
  const parts: any[] = [];

  // Add images to parts - support for multiple images
  if (hasMultipleImages) {
    // Add all uploaded images
    for (const img of imageState.uploadedImages!) {
      parts.push({
        inline_data: {
          mime_type: img.file.type || 'image/png',
          data: img.base64,
        },
      });
    }
  } else if (imageState.base64) {
    // Single image (legacy support)
    parts.push({
      inline_data: {
        mime_type: imageState.file?.type || 'image/png',
        data: imageState.base64,
      },
    });
  }

  // Add text prompt
  parts.push({ text: prompt });

  // Build request body
  const requestBody: any = {
    contents: [
      {
        parts: parts,
      },
    ],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  };

  // Try with automatic key rotation on failure
  const keyStats = getKeyStats();
  const maxRetries = Math.max(1, Math.min(keyStats.total, 5)); // At least 1 attempt, max 5 retries
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Get config (will return next available key)
      const config = getNanobanaConfig();

      console.log(`Nanobanana Pro 3 API call (attempt ${attempt + 1}/${maxRetries}):`, {
        hasImage: !!imageState.file || hasMultipleImages,
        imageCount,
        specs: specsJson,
        model: config.model,
        keyIndex: attempt + 1,
      });

      const response = await fetch(
        `${config.baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Nanobanana API error:', errorText);

        // Parse error and determine if we should try next key
        let shouldRetryWithNextKey = false;
        let errorMessage = `Nanobanana Pro API failed: ${response.status}`;

        try {
          const errorData = JSON.parse(errorText);
          const code = errorData.error?.code;
          const message = errorData.error?.message || '';

          if (code === 429) {
            // Rate limit / quota exceeded - mark this key as failed and try next
            markKeyAsFailed(config.apiKey);
            shouldRetryWithNextKey = true;

            const retryMatch = message.match(/retry in (\d+\.?\d*)/i);
            const retrySeconds = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : 60;

            if (message.includes('free_tier')) {
              errorMessage = `API quota exceeded (free tier). Wait ${retrySeconds}s or upgrade plan.`;
            } else {
              errorMessage = `Rate limit exceeded. Wait ${retrySeconds}s.`;
            }
          } else if (code === 403) {
            // Permission denied - mark key as failed
            markKeyAsFailed(config.apiKey);
            shouldRetryWithNextKey = true;
            errorMessage = 'API key permission denied.';
          } else if (code === 400) {
            // Bad request - don't retry with different key
            if (message.includes('not supported') || message.includes('not available')) {
              errorMessage = `Model "${config.model}" does not support image generation.`;
            } else {
              errorMessage = `Invalid request: ${message.substring(0, 200)}`;
            }
          } else if (code === 404) {
            errorMessage = `Model "${config.model}" not found.`;
          }
        } catch (parseError) {
          if (!(parseError instanceof SyntaxError)) {
            throw parseError;
          }
          errorMessage = `Nanobanana Pro API failed: ${response.status} - ${errorText.substring(0, 200)}`;
        }

        lastError = new Error(errorMessage);

        // Check if we should try next key
        if (shouldRetryWithNextKey && attempt < maxRetries - 1) {
          const stats = getKeyStats();
          console.log(`Trying next API key... (${stats.available}/${stats.total} available)`);
          continue;
        }

        throw lastError;
      }

      // Success! Parse response
      const data = await response.json();

      // Extract image from response
      const candidates = data.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('No response from Nanobanana Pro API');
      }

      const responseParts = candidates[0]?.content?.parts;
      if (!responseParts || responseParts.length === 0) {
        throw new Error('No content in Nanobanana Pro response');
      }

      // Find the image part in the response
      for (const part of responseParts) {
        if (part.inlineData?.data) {
          return part.inlineData.data;
        }
      }

      // If no image found, check for text response with error
      const textPart = responseParts.find((p: any) => p.text);
      if (textPart) {
        throw new Error(
          `Nanobanana Pro returned text instead of image: ${textPart.text.substring(0, 200)}`
        );
      }

      throw new Error('No image data in Nanobanana Pro response');
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error('Nanobanana Pro 3 image generation failed');

      // If this is the last attempt, throw the error
      if (attempt >= maxRetries - 1) {
        console.error('Nanobanana Pro 3 error (all retries exhausted):', lastError);
        throw lastError;
      }

      // Continue to next attempt if there are more keys
      console.log(`Attempt ${attempt + 1} failed: ${lastError.message}`);
    }
  }

  // Should never reach here, but just in case
  throw lastError || new Error('Nanobanana Pro 3 image generation failed');
}

// ============================================================================
// BACKEND PROXY FOR NANOBANANA (Bypasses browser network restrictions)
// ============================================================================

const getBackendUrl = (): string => {
  // Check for environment variable first (set in Cloudflare Pages)
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '');
  }

  // Check for custom backend URL in settings
  try {
    const saved = localStorage.getItem('app-settings');
    if (saved) {
      const settings = JSON.parse(saved);
      if (settings.backendUrl && settings.backendUrl.trim()) {
        return settings.backendUrl.replace(/\/$/, '');
      }
    }
  } catch (e) {
    console.error('Failed to read backend URL:', e);
  }

  // Use localhost for development
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3001';
  }

  // Fallback: assume API is on same origin (won't work for cross-origin deployments)
  console.warn('VITE_API_BASE_URL not set. API calls may fail for cross-origin deployments.');
  return window.location.origin;
};

/**
 * Generate image via backend proxy (bypasses browser network restrictions)
 * Falls back to direct API call if backend is unavailable
 */
export async function generateImageNanobanaViaProxy(
  imageState: ImageState,
  specsJson: string,
  _apiKey?: string
): Promise<string> {
  const backendUrl = getBackendUrl();

  // Build the prompt
  const hasMultipleImages = imageState.uploadedImages && imageState.uploadedImages.length > 0;
  const imageCount = hasMultipleImages
    ? imageState.uploadedImages!.length
    : imageState.base64
      ? 1
      : 0;

  let prompt: string;
  if (hasMultipleImages || (imageState.base64 && imageState.file)) {
    const imageDesc =
      imageCount > 1
        ? `these ${imageCount} scientific/medical images`
        : 'this scientific/medical image';
    prompt = `Analyze and enhance ${imageDesc} based on the following specifications: ${specsJson || imageState.specs}.
    Create a professional, publication-quality scientific figure suitable for academic conferences like ISMRM, RSNA, or ECR.
    ${imageCount > 1 ? 'Combine and arrange the images into a cohesive figure layout.' : ''}
    Ensure clear labeling, proper color schemes, and high visual quality.`;
  } else {
    prompt = `Generate a professional scientific/medical figure based on these specifications: ${specsJson || imageState.specs}.
    Create a publication-quality image suitable for academic conferences.
    Focus on clarity, proper scientific visualization, and professional aesthetics.`;
  }

  // Build request body
  const requestBody: any = {
    prompt,
    model: import.meta.env.VITE_NANOBANA_MODEL || 'gemini-3-pro-image-preview',
  };

  // Add images
  if (hasMultipleImages) {
    requestBody.images = imageState.uploadedImages!.map((img: any) => ({
      mimeType: img.file.type || 'image/png',
      data: img.base64,
    }));
  } else if (imageState.base64) {
    requestBody.image = {
      mimeType: imageState.file?.type || 'image/png',
      data: imageState.base64,
    };
  }

  try {
    console.log('Calling Nanobanana via backend proxy:', `${backendUrl}/api/image/generate`);
    console.log('Request body:', {
      hasImages: !!requestBody.images || !!requestBody.image,
      imageCount: requestBody.images?.length || (requestBody.image ? 1 : 0),
      promptLength: requestBody.prompt?.length,
      model: requestBody.model,
    });

    const response = await fetch(`${backendUrl}/api/image/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend proxy failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Image generation failed');
    }

    if (!data.image) {
      throw new Error('No image data in response');
    }

    return data.image;
  } catch (error) {
    console.error('Backend proxy error:', error);
    throw new Error(
      'Failed to generate image via backend proxy. Make sure the backend server is running.'
    );
  }
}
