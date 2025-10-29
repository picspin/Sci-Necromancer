import { AbstractData, ImageState, AnalysisResult, Category, AbstractType, AbstractTypeSuggestion } from '../../types';
import * as prompts from './prompts/ismrmPrompts';

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
async function callOpenAIAPI(prompt: string, apiKey: string, baseUrl: string, model: string): Promise<any> {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert academic writer specializing in ISMRM conference submissions. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
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

  return JSON.parse(content);
}

export async function analyzeContent(text: string, apiKey?: string): Promise<AnalysisResult> {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  const settings = getSettings();
  const baseUrl = settings.openAIBaseUrl || 'https://api.openai.com/v1';
  const model = settings.openAITextModel || 'gpt-4o';

  const prompt = await prompts.getAnalysisPrompt(text);
  return await callOpenAIAPI(prompt, apiKey, baseUrl, model);
}

export async function suggestAbstractType(
  text: string,
  categories: Category[],
  keywords: string[],
  apiKey?: string
): Promise<AbstractTypeSuggestion[]> {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  const settings = getSettings();
  const baseUrl = settings.openAIBaseUrl || 'https://api.openai.com/v1';
  const model = settings.openAITextModel || 'gpt-4o';

  const prompt = await prompts.getAbstractTypeSuggestionPrompt(text, categories, keywords);
  const result = await callOpenAIAPI(prompt, apiKey, baseUrl, model);

  // Handle both array and object with suggestions field
  const suggestions = Array.isArray(result) ? result : (result.suggestions || []);

  return suggestions
    .filter((s: AbstractTypeSuggestion) => s.probability >= 0.30)
    .sort((a: AbstractTypeSuggestion, b: AbstractTypeSuggestion) => b.probability - a.probability);
}

export async function generateImpactSynopsis(
  text: string,
  categories: Category[],
  keywords: string[],
  apiKey?: string
): Promise<{ impact: string, synopsis: string }> {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  const settings = getSettings();
  const baseUrl = settings.openAIBaseUrl || 'https://api.openai.com/v1';
  const model = settings.openAITextModel || 'gpt-4o';

  const prompt = await prompts.getImpactSynopsisPrompt(text, categories, keywords);
  return await callOpenAIAPI(prompt, apiKey, baseUrl, model);
}

// 原函数改名（内部使用）
async function generateFinalAbstractFull(
  text: string,
  type: AbstractType,
  categories: Category[],
  keywords: string[],
  impact: string,
  synopsis: string,
  apiKey?: string
): Promise<AbstractData> {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }
  const settings = getSettings();
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
  return await callOpenAIAPI(prompt, apiKey, baseUrl, model);
}

// 兼容旧签名：generateFinalAbstract(text, type, categories, keywords, apiKey?)
// 新签名：generateFinalAbstract(text, type, categories, keywords, impact, synopsis, apiKey?)
export async function generateFinalAbstract(
  text: string,
  type: AbstractType,
  categories: Category[],
  keywords: string[],
  arg5?: string,
  arg6?: string,
  arg7?: string
): Promise<AbstractData> {
  // 判断调用方式
  if (
    // 老式：5 参数（第5是 apiKey）
    (arg6 === undefined && arg7 === undefined) ||
    // 老式但 apiKey 是可选（arg5 可能是 undefined）
    (arg6 === undefined && arg7 === undefined && arg5 === undefined)
  ) {
    const apiKey = arg5;
    // 先生成 impact & synopsis
    const { impact, synopsis } = await generateImpactSynopsis(
      text,
      categories,
      keywords,
      apiKey
    );
    return await generateFinalAbstractFull(
      text,
      type,
      categories,
      keywords,
      impact,
      synopsis,
      apiKey
    );
  } else {
    // 新式：7 参数
    const impact = arg5!;
    const synopsis = arg6!;
    const apiKey = arg7;
    return await generateFinalAbstractFull(
      text,
      type,
      categories,
      keywords,
      impact,
      synopsis,
      apiKey
    );
  }
}

// 简单的测试图像生成功能（占位）
export async function testImageGeneration(
  prompt: string = 'Test scientific figure',
  apiKey?: string
): Promise<string> {
  // 这里你可以直接调用 generateImage 或返回占位符
  return `data:image/png;base64,${btoa(`TEST_IMAGE_${Date.now()}_${prompt}`)}`;
}

export async function generateCreativeAbstract(
  coreIdea: string,
  apiKey?: string
): Promise<AbstractData> {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  const settings = getSettings();
  const baseUrl = settings.openAIBaseUrl || 'https://api.openai.com/v1';
  const model = settings.openAITextModel || 'gpt-4o';

  const prompt = await prompts.getCreativeAbstractPrompt(coreIdea);
  return await callOpenAIAPI(prompt, apiKey, baseUrl, model);
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
  if (!apiKey) throw new Error('API key required');

  const settings = getSettings();
  
  // Check if MCP image generation is enabled
  if (settings.mcpConfig?.imageGeneration?.enabled) {
    return await generateImageViaMCP(imageState, creativeContext, apiKey, settings);
  }
  
  // Otherwise use SiliconFlow direct API
  return await generateImageViaSiliconFlow(imageState, creativeContext, apiKey, settings);
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
  
  // Build prompt
  let prompt: string;
  if (imageState.base64 && imageState.file) {
    // If user uploaded an image, analyze it first with vision model
    const visionModel = settings.openAIVisionModel || settings.openAITextModel || 'Qwen/Qwen2-VL-72B-Instruct';
    const analysisPrompt = `Analyze this image and describe it for regeneration. Focus on: ${imageState.specs}`;
    const description = await analyzeImageWithVision(imageState, analysisPrompt, apiKey, baseUrl, visionModel);
    prompt = `${description}\n\nSpecifications: ${imageState.specs}\n\nCreate a professional scientific/medical image.`;
  } else {
    // Creative generation from scratch
    prompt = `Generate a scientific/medical figure: ${creativeContext}. Specifications: ${imageState.specs}. Professional, publication-quality.`;
  }

  // Call SiliconFlow API - strictly following their documentation
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/images/generations`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: imageModel,
      prompt: prompt,
      image_size: '1024x1024',
      batch_size: 1,
      num_inference_steps: 20,
      guidance_scale: 7.5
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
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
  const arrayBuffer = await imgResponse.arrayBuffer();
  return btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
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
    const description = await analyzeImageWithVision(imageState, analysisPrompt, apiKey, baseUrl, model);
    prompt = `${description}\n\nSpecifications: ${imageState.specs}\n\nCreate a professional scientific/medical image.`;
  } else {
    prompt = `Generate a scientific/medical figure: ${creativeContext}. Specifications: ${imageState.specs}. Professional, publication-quality.`;
  }

  // Call MCP endpoint with tool access
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/agent`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...customHeaders
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are an AI assistant with image generation tools. Generate images as requested and return the image data.'
        },
        {
          role: 'user',
          content: `Generate image: ${prompt}`
        }
      ],
      temperature: 0.7,
      stream: false
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
      const args = typeof call.function?.arguments === 'string' 
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

// Vision analysis helper (shared by both paths)
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
      'Authorization': `Bearer ${apiKey}`,
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
                url: `data:${imageState.file!.type};base64,${imageState.base64}`
              }
            }
          ]
        }
      ],
      max_tokens: 500
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
