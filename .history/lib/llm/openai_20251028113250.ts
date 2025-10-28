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

  // TODO: Implement actual OpenAI API call
  return {
    impact: 'This innovative approach presents a novel perspective on the research question.',
    synopsis: 'Building on the core concept, we developed a comprehensive framework that addresses key challenges in the field.',
    keywords: ['innovation', 'research', 'methodology']
  };
}

export async function generateImage(
  imageState: ImageState,
  creativeContext: string,
  apiKey?: string
): Promise<string> {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  // TODO: Implement actual DALL-E 3 image generation
  throw new Error('Image generation not yet implemented for OpenAI');
}
