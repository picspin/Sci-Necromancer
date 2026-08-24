import type {
  AbstractData,
  AbstractType,
  AbstractTypeSuggestion,
  AnalysisResult,
  BlindReviewModelAssessment,
  Category,
  ISMRMAnalysisBundle,
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
import { parseStructuredModelOutput } from './modelResponse';
import { anthropicApiUrl } from './providerUrl';
import { getLockedTextModel } from './textModelWorkflow';

function settings() {
  try {
    return JSON.parse(localStorage.getItem('app-settings') || '{}');
  } catch {
    return {};
  }
}

function parseJson(text: string): any {
  const parsed = parseStructuredModelOutput(text);
  if (parsed === null) throw new Error('Anthropic response did not contain valid JSON');
  return parsed;
}

async function callAnthropic(
  prompt: string,
  apiKey?: string,
  highThinking = false,
  modelOverride?: string
): Promise<any> {
  const configured = settings();
  const key = apiKey || configured.anthropicApiKey;
  if (!key) throw new Error('Anthropic API key is required');
  const body: Record<string, unknown> = {
    model: modelOverride || configured.anthropicTextModel || 'claude-sonnet-4-5',
    max_tokens: highThinking ? 12000 : 6000,
    system:
      'You are an expert academic medical submission editor. Follow the conference rules and return only valid JSON.',
    messages: [{ role: 'user', content: prompt }],
  };
  if (highThinking) body.thinking = { type: 'enabled', budget_tokens: 6000 };
  const target = anthropicApiUrl(configured.anthropicBaseUrl, 'messages');
  const request: RequestInit = {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  };
  let response: Response;
  try {
    response = await fetch(target, request);
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        capability: 'anthropic_byok',
        resource: 'messages',
        baseUrl: configured.anthropicBaseUrl || 'https://api.anthropic.com',
        apiKey: key,
        body,
      }),
    });
  }
  if (!response.ok)
    throw new Error(`Anthropic API failed: ${response.status} ${await response.text()}`);
  const payload = await response.json();
  const text = payload.content?.find((item: any) => item.type === 'text')?.text;
  if (!text) throw new Error('No text content in Anthropic response');
  return parseJson(text);
}

export async function analyzeISMRMBundle(
  text: string,
  apiKey?: string,
  workflowContext = text
): Promise<ISMRMAnalysisBundle> {
  const [analysis, impact, type] = await Promise.all([
    prompts.getAnalysisPrompt(text),
    prompts.getImpactSynopsisPrompt(text, [], []),
    prompts.getAbstractTypeSuggestionPrompt(text, [], []),
  ]);
  const result = await callAnthropic(
    `${analysis}\n\n${impact}\n\n${type}\n\nReturn one JSON object with categories, keywords, impact, synopsis, and typeSuggestions.`,
    apiKey,
    false,
    getLockedTextModel(workflowContext)?.model
  );
  return {
    categories: Array.isArray(result.categories) ? result.categories : [],
    keywords: Array.isArray(result.keywords) ? result.keywords : [],
    impact: result.impact || '',
    synopsis: result.synopsis || '',
    typeSuggestions: Array.isArray(result.typeSuggestions) ? result.typeSuggestions : [],
  };
}

export async function analyzeContent(
  text: string,
  apiKey?: string,
  workflowContext = text
): Promise<AnalysisResult> {
  return callAnthropic(
    await prompts.getAnalysisPrompt(text),
    apiKey,
    false,
    getLockedTextModel(workflowContext)?.model
  );
}

export async function suggestAbstractType(
  text: string,
  categories: Category[],
  keywords: string[],
  apiKey?: string
): Promise<AbstractTypeSuggestion[]> {
  const result = await callAnthropic(
    await prompts.getAbstractTypeSuggestionPrompt(text, categories, keywords),
    apiKey
  );
  const values = Array.isArray(result) ? result : result.suggestions || [];
  return values.filter((item: AbstractTypeSuggestion) => item.probability >= 0.3);
}

export async function generateImpactSynopsis(
  text: string,
  categories: Category[],
  keywords: string[],
  apiKey?: string
) {
  return callAnthropic(await prompts.getImpactSynopsisPrompt(text, categories, keywords), apiKey);
}

export async function generateFinalAbstract(
  text: string,
  type: AbstractType,
  categories: Category[],
  keywords: string[],
  impact: string,
  synopsis: string,
  apiKey?: string,
  operation: 'generation' | 'deep_update' = 'generation',
  workflowContext = text
): Promise<AbstractData> {
  return callAnthropic(
    await prompts.getFinalAbstractPrompt(text, type, categories, keywords, impact, synopsis),
    apiKey,
    operation === 'deep_update',
    getLockedTextModel(workflowContext)?.model
  );
}

export async function generateCreativeAbstract(coreIdea: string, apiKey?: string) {
  return callAnthropic(await prompts.getCreativeAbstractPrompt(coreIdea), apiKey);
}

export async function analyzeRSNAContent(
  text: string,
  apiKey?: string,
  auxiliaryLocale: 'en' | 'zh' = 'en'
) {
  return normalizeRSNAAnalysis(
    await callAnthropic(
      getRSNAAnalysisPrompt(text, auxiliaryLocale),
      apiKey,
      false,
      getLockedTextModel(`RSNA:${text}`)?.model
    ),
    text,
    auxiliaryLocale
  );
}

export async function generateRSNAAbstract(
  input: RSNAPromptInput,
  apiKey?: string,
  operation: 'generation' | 'deep_update' = 'generation',
  workflowContext = input.inputText
): Promise<AbstractData> {
  const prompt =
    input.mode === 'creative' ? getRSNACreativePrompt(input) : getRSNAGenerationPrompt(input);
  const raw = await callAnthropic(
    prompt,
    apiKey,
    operation === 'deep_update',
    getLockedTextModel(`RSNA:${workflowContext}`)?.model
  );
  let draft: AbstractData = {
    ...raw,
    impact: raw.impact || '',
    synopsis: raw.synopsis || '',
    keywords: normalizeRSNAKeywords(input.keywords),
    categories: [{ name: input.category, type: 'main', probability: 1 }],
    rsna: input.classification,
  };
  draft = enforceRSNASourceFidelity(draft, input.inputText, input.auxiliaryLocale);
  const validation = validateRSNADraft(draft, input.auxiliaryLocale);
  draft.complianceWarnings = [
    ...(draft.complianceWarnings || []),
    ...validation.errors,
    ...validation.warnings,
  ];
  return draft;
}

export async function reviewAbstractBlind(
  prompt: string,
  apiKey?: string
): Promise<BlindReviewModelAssessment> {
  return assertBlindReviewAssessment(await callAnthropic(prompt, apiKey));
}
