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
): Promise<{impact: string, synopsis: string}> {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  const settings = getSettings();
  const baseUrl = settings.openAIBaseUrl || 'https://api.openai.com/v1';
  const model = settings.openAITextModel || 'gpt-4o';

  const prompt = await prompts.getImpactSynopsisPrompt(text, categories, keywords);
  return await callOpenAIAPI(prompt, apiKey, baseUrl, model);
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
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  const settings = getSettings();
  const baseUrl = settings.openAIBaseUrl || 'https://api.openai.com/v1';
  const model = settings.openAITextModel || 'gpt-4o';

  const prompt = await prompts.getFinalAbstractPrompt(text, type, categories, keywords, impact, synopsis);
  return await callOpenAIAPI(prompt, apiKey, baseUrl, model);
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

export async function generateImage(
  imageState: ImageState,
  creativeContext: string,
  apiKey?: string
): Promise<string> {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  const settings = getSettings();
  const baseUrl = settings.openAIBaseUrl || 'https://api.openai.com/v1';
  const imageModel = settings.openAIImageModel || 'dall-e-3';

  console.log('OpenAI Image Generation Settings:', {
    baseUrl,
    imageModel,
    hasApiKey: !!apiKey,
    mode: imageState.base64 && imageState.file ? 'editing' : 'creative'
  });

  try {
    if (imageState.base64 && imageState.file) {
      // Image editing mode - use vision model for analysis then generate
      const analysisPrompt = `Analyze this image and create a detailed description for regenerating an improved version. Focus on: ${imageState.specs}. Provide a comprehensive prompt for image generation that maintains the scientific/medical context while implementing the requested improvements.`;
      
      console.log('Starting vision analysis...');
      
      // First, analyze the image using vision model
      const visionUrl = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
      const visionResponse = await fetch(visionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: settings.openAITextModel || 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: analysisPrompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${imageState.file.type};base64,${imageState.base64}`
                  }
                }
              ]
            }
          ],
          max_tokens: 500
        }),
      });

      if (!visionResponse.ok) {
        const errorText = await visionResponse.text();
        console.error('Vision analysis failed:', errorText);
        throw new Error(`Vision analysis failed: ${visionResponse.status} - ${errorText}`);
      }

      const visionData = await visionResponse.json();
      const imageDescription = visionData.choices?.[0]?.message?.content;
      
      if (!imageDescription) {
        throw new Error('Failed to analyze the uploaded image');
      }

      console.log('Vision analysis complete, generating image...');

      // Now generate new image based on analysis
      const generationPrompt = `${imageDescription}\n\nAdditional specifications: ${imageState.specs}\n\nCreate a professional, publication-quality scientific/medical image.`;
      
      return await generateImageFromPrompt(generationPrompt, apiKey, baseUrl, imageModel);
    } else {
      // Creative mode - generate from context and specs
      const prompt = `Generate a scientific or medical imaging figure based on this context: ${creativeContext}. Specifications: ${imageState.specs}. The image should be publication-quality, professional, and suitable for academic presentation.`;
      
      console.log('Starting creative image generation...');
      return await generateImageFromPrompt(prompt, apiKey, baseUrl, imageModel);
    }
  } catch (error) {
    console.error('Error generating image:', error);
    throw new Error(`Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper function for image generation
async function generateImageFromPrompt(prompt: string, apiKey: string, baseUrl: string, model: string): Promise<string> {
  // Try standard OpenAI images/generations endpoint first
  let url = `${baseUrl.replace(/\/$/, '')}/images/generations`;
  
  let requestBody: any = {
    model: model,
    prompt: prompt,
    n: 1,
    size: '1024x1024',
    response_format: 'b64_json',
    quality: 'hd'
  };

  let response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  // If standard endpoint fails, try chat completions with image generation
  if (!response.ok) {
    console.log('Standard image endpoint failed, trying chat completions...');
    url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
    
    requestBody = {
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are an AI that generates images. Respond with a base64-encoded image.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 4000,
      temperature: 0.7
    };

    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Image generation API call failed: ${response.status} ${response.statusText}\n${errorText}`);
  }

  const data = await response.json();
  
  // Try to extract image data from different response formats
  let imageData = data.data?.[0]?.b64_json; // Standard OpenAI format
  
  if (!imageData) {
    // Try chat completion format
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      // Look for base64 data in the response
      const base64Match = content.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
      if (base64Match) {
        imageData = base64Match[1];
      } else if (content.match(/^[A-Za-z0-9+/=]+$/)) {
        // Assume the entire content is base64
        imageData = content;
      }
    }
  }
  
  if (!imageData) {
    throw new Error('No image data received from API. The model may not support image generation or returned an unexpected format.');
  }

  return imageData;
}
