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
import {
  hasEnabledCapabilityAdapter,
  isCapabilityGroupEnabled,
} from '../capabilities/capabilityRegistry';
import { canUseManagedText, generateManagedText } from '../../src/composables/useMembership';
import {
  acquireManagedTextCall,
  abandonManagedTextWorkflow,
  beginManagedTextWorkflow,
  completeManagedTextWorkflow,
  registerManagedTextWorkflow,
} from './managedTextWorkflow';

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
  apiKey: string | undefined,
  baseUrl: string,
  model: string,
  options: {
    allowManaged?: boolean;
    beginWorkflow?: boolean;
    finishWorkflow?: boolean;
    workflowStage?: 'analysis' | 'synopsis' | 'type' | 'generation';
    workflowContext?: string;
    standaloneOperation?: 'regeneration' | 'deep_update';
  } = {}
): Promise<any> {
  if (options.allowManaged !== false && canUseManagedText()) {
    const workflowContext = options.workflowContext || prompt;
    if (options.beginWorkflow) beginManagedTextWorkflow(workflowContext);
    const billing = acquireManagedTextCall(
      options.workflowStage || 'generation',
      workflowContext,
      options.standaloneOperation
    );
    try {
      const result = await generateManagedText({
        prompt,
        ...billing,
      });
      if (options.beginWorkflow) {
        registerManagedTextWorkflow(workflowContext, billing.idempotencyKey, result.workflowId);
      }
      try {
        return JSON.parse(result.text);
      } catch {
        return result.text;
      }
    } catch (error) {
      completeManagedTextWorkflow(billing.idempotencyKey);
      throw error;
    } finally {
      if (options.finishWorkflow) completeManagedTextWorkflow(billing.idempotencyKey);
    }
  }

  abandonManagedTextWorkflow(options.workflowContext || prompt);

  if (!apiKey) throw new Error('OpenAI API key is required');
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

export async function analyzeContent(
  text: string,
  apiKey?: string,
  workflowContext = text
): Promise<AnalysisResult> {
  const settings = getSettings();
  const finalApiKey = apiKey || settings.openAIApiKey;
  const baseUrl = settings.openAIBaseUrl || 'https://api.openai.com/v1';
  const model = settings.openAITextModel || 'gpt-4o';

  const prompt = await prompts.getAnalysisPrompt(text);
  return await callOpenAIAPI(prompt, finalApiKey, baseUrl, model, {
    beginWorkflow: true,
    workflowStage: 'analysis',
    workflowContext,
  });
}

export async function suggestAbstractType(
  text: string,
  categories: Category[],
  keywords: string[],
  apiKey?: string,
  workflowContext = text
): Promise<AbstractTypeSuggestion[]> {
  const settings = getSettings();
  const finalApiKey = apiKey || settings.openAIApiKey;
  const baseUrl = settings.openAIBaseUrl || 'https://api.openai.com/v1';
  const model = settings.openAITextModel || 'gpt-4o';

  const prompt = await prompts.getAbstractTypeSuggestionPrompt(text, categories, keywords);
  const result = await callOpenAIAPI(prompt, finalApiKey, baseUrl, model, {
    workflowStage: 'type',
    workflowContext,
  });

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
  apiKey?: string,
  workflowContext = text
): Promise<{ impact: string; synopsis: string }> {
  const settings = getSettings();
  const finalApiKey = apiKey || settings.openAIApiKey;
  const baseUrl = settings.openAIBaseUrl || 'https://api.openai.com/v1';
  const model = settings.openAITextModel || 'gpt-4o';

  const prompt = await prompts.getImpactSynopsisPrompt(text, categories, keywords);
  return await callOpenAIAPI(prompt, finalApiKey, baseUrl, model, {
    workflowStage: 'synopsis',
    workflowContext,
  });
}

export async function generateFinalAbstract(
  text: string,
  type: AbstractType,
  categories: Category[],
  keywords: string[],
  impact: string,
  synopsis: string,
  apiKey?: string,
  managedOperation: 'generation' | 'deep_update' = 'generation',
  workflowContext = text
): Promise<AbstractData> {
  const settings = getSettings();
  const finalApiKey = apiKey || settings.openAIApiKey;
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
  const usingManagedText = canUseManagedText();
  try {
    const res = await callOpenAIAPI(prompt, finalApiKey, baseUrl, model, {
      finishWorkflow: true,
      workflowStage: 'generation',
      workflowContext,
      ...(managedOperation === 'deep_update'
        ? { standaloneOperation: 'deep_update' as const }
        : {}),
    });
    // If res is a string (plaintext), wrap it into AbstractData
    if (typeof res === 'string') {
      return { abstract: res, impact, synopsis, keywords } as any;
    }
    return res;
  } catch (err) {
    if (usingManagedText || !finalApiKey) throw err;
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
  const baseUrl = settings.openAIBaseUrl || 'https://api.openai.com/v1';
  const model = settings.openAITextModel || 'gpt-4o';

  const prompt = await prompts.getCreativeAbstractPrompt(coreIdea);
  return await callOpenAIAPI(prompt, finalApiKey, baseUrl, model, {
    finishWorkflow: true,
    workflowStage: 'generation',
    workflowContext: coreIdea,
    standaloneOperation: 'regeneration',
  });
}

export async function analyzeRSNAContent(
  text: string,
  apiKey?: string,
  auxiliaryLocale: 'en' | 'zh' = 'en'
): Promise<AnalysisResult & { rsna: NonNullable<AnalysisResult['rsna']> }> {
  const settings = getSettings();
  const finalApiKey = apiKey || settings.openAIApiKey;
  const baseUrl = settings.openAIBaseUrl || 'https://api.openai.com/v1';
  const model = settings.openAITextModel || 'gpt-4o';
  const raw = await callOpenAIAPI(
    getRSNAAnalysisPrompt(text, auxiliaryLocale),
    finalApiKey,
    baseUrl,
    model,
    { beginWorkflow: true, workflowStage: 'analysis', workflowContext: `RSNA:${text}` }
  );
  return normalizeRSNAAnalysis(raw, text, auxiliaryLocale);
}

export async function generateRSNAAbstract(
  input: RSNAPromptInput,
  apiKey?: string,
  managedOperation: 'generation' | 'deep_update' = 'generation'
): Promise<AbstractData> {
  const settings = getSettings();
  const finalApiKey = apiKey || settings.openAIApiKey;
  const baseUrl = settings.openAIBaseUrl || 'https://api.openai.com/v1';
  const model = settings.openAITextModel || 'gpt-4o';
  const usesManagedProvider = canUseManagedText();
  const prompt =
    input.mode === 'creative' ? getRSNACreativePrompt(input) : getRSNAGenerationPrompt(input);
  const raw = await callOpenAIAPI(prompt, finalApiKey, baseUrl, model, {
    finishWorkflow: true,
    workflowStage: 'generation',
    workflowContext: `RSNA:${input.inputText}`,
    ...(managedOperation === 'deep_update' ? { standaloneOperation: 'deep_update' as const } : {}),
  });
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
      provider: usesManagedProvider ? 'google' : 'openai',
      model: usesManagedProvider ? 'gemini-3.6-flash' : model,
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
    settings.openAITextModel || 'gpt-4o',
    { allowManaged: false }
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
  const imageMcpEnabled =
    isCapabilityGroupEnabled(settings, 'mcp') &&
    (settings.mcpConfig?.imageGeneration?.enabled ||
      hasEnabledCapabilityAdapter(settings, 'mcp', 'image-generation'));
  if (imageMcpEnabled) {
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
