import * as gemini from './gemini';
import * as openai from './openai';
import * as anthropic from './anthropic';
import {
  AbstractData,
  ImageState,
  AnalysisResult,
  Category,
  AbstractType,
  AbstractTypeSuggestion,
  RSNAClassification,
  BlindReviewModelAssessment,
  ISMRMAnalysisBundle,
  AIProvider,
  Settings,
} from '../../types';
import {
  normalizeRSNAAnalysis,
  normalizeRSNAKeywords,
  RSNA_CATEGORIES,
} from '../conference/rsnaRules';
import { requireAIDisclosureAcceptance } from '../compliance/aiDisclosure';
import { canUseManagedText, generateManagedText } from '../../src/composables/useMembership';
import { assertBlindReviewAssessment } from '../review/blindReview';
import { resolveTextRoute } from './capabilityRouting';

// Export writing style utilities
export {
  DEFAULT_WRITING_STYLE,
  generateWritingStylePrompt,
  detectProhibitedPhrases,
  validateWritingStyle,
  getWritingStyleInstructions,
  type WritingStyleValidation,
  type WritingStyleIssue,
  type ProhibitedPhraseDetection,
} from './writingStyleEnhancer';

// This is a simplified way to get the settings.
// In a larger app, this might come from a context passed down or another state management solution.
const getSettings = (): Partial<Settings> => {
  try {
    const savedSettings = localStorage.getItem('app-settings');
    if (savedSettings) return JSON.parse(savedSettings) as Partial<Settings>;
  } catch (e) {
    // Ignore parsing error and use an empty configuration.
  }
  return {};
};

const getProvider = (): AIProvider => getSettings().provider || 'google';

const getTextRoute = () => {
  const rawSettings = getSettings();
  const settings = { ...rawSettings, provider: rawSettings.provider || 'google' } as Settings;
  return { settings, route: resolveTextRoute(settings, canUseManagedText()) };
};

const getApiKey = (): string | undefined => {
  try {
    const { settings, route } = getTextRoute();
    if (route !== 'byok') return undefined;
    if (settings.provider === 'openai') return settings.openAIApiKey;
    if (settings.provider === 'anthropic') return settings.anthropicApiKey;
    return settings.googleApiKey;
  } catch (e) {
    console.error('Failed to get API key from settings:', e);
  }
  return undefined;
};

const getService = (allowManagedText = true) => {
  const { route } = getTextRoute();
  const provider = getProvider();
  if (route === 'unavailable' || (route === 'managed' && !allowManagedText)) {
    throw new Error('llm.api_key_missing');
  }
  if (route === 'managed') return openai;
  if (provider === 'anthropic') return anthropic;
  if (provider === 'openai') {
    return openai;
  }
  return gemini;
};

async function withExplicitManagedFallback<T>(
  apiKey: string | undefined,
  runSelectedByok: () => Promise<T>,
  runManaged: () => Promise<T>
): Promise<T> {
  try {
    return await runSelectedByok();
  } catch (byokError) {
    if (!apiKey || !canUseManagedText() || typeof globalThis.confirm !== 'function') {
      throw byokError;
    }
    const isChinese = getAuxiliaryLocale() === 'zh';
    const approved = globalThis.confirm(
      isChinese
        ? '个人 API 调用失败。是否改用会员托管模型并消耗 1 bonus？取消则不调用托管模型，也不扣费。'
        : 'Your personal API call failed. Use the managed member model for 1 bonus? Cancel makes no managed call and incurs no charge.'
    );
    if (!approved) throw byokError;
    return runManaged();
  }
}

export const analyzeISMRMBundle = async (text: string): Promise<ISMRMAnalysisBundle> => {
  requireAIDisclosureAcceptance();
  const apiKey = getApiKey();
  const service = getService();
  if (!apiKey) return openai.analyzeISMRMBundle(text, undefined, text, true);
  return withExplicitManagedFallback(
    apiKey,
    () => service.analyzeISMRMBundle(text, apiKey),
    () => openai.analyzeISMRMBundle(text, undefined, text, true)
  );
};

const getAuxiliaryLocale = (): 'en' | 'zh' =>
  localStorage.getItem('i18nextLng')?.toLowerCase().startsWith('zh') ? 'zh' : 'en';

export async function reviewAbstractBlind(prompt: string): Promise<BlindReviewModelAssessment> {
  requireAIDisclosureAcceptance();
  const apiKey = getApiKey();
  if (apiKey) {
    return withExplicitManagedFallback(
      apiKey,
      () => getService(false).reviewAbstractBlind(prompt, apiKey),
      () => runManagedBlindReview(prompt)
    );
  }
  return runManagedBlindReview(prompt);
}

async function runManagedBlindReview(prompt: string): Promise<BlindReviewModelAssessment> {
  if (!canUseManagedText()) throw new Error('llm.api_key_missing');
  const result = await generateManagedText({
    prompt,
    idempotencyKey:
      globalThis.crypto?.randomUUID?.() ?? `blind-review-${Date.now()}-${Math.random()}`,
    operation: 'blind_review',
  });
  try {
    return assertBlindReviewAssessment(JSON.parse(result.text));
  } catch {
    throw new Error('blind_review.invalid_model_response');
  }
}

export const analyzeContent = async (text: string): Promise<AnalysisResult> => {
  requireAIDisclosureAcceptance();
  const apiKey = getApiKey();
  const service = getService();
  if (!apiKey) return openai.analyzeContent(text, undefined, text, true);
  return withExplicitManagedFallback(
    apiKey,
    () => service.analyzeContent(text, apiKey),
    () => openai.analyzeContent(text, undefined, text, true)
  );
};

export const suggestAbstractType = (
  text: string,
  categories: Category[],
  keywords: string[]
): Promise<AbstractTypeSuggestion[]> => {
  requireAIDisclosureAcceptance();
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('managed_workflow_operation_not_supported');
  return getService().suggestAbstractType(text, categories, keywords, apiKey);
};

export const generateImpactSynopsis = (
  text: string,
  categories: Category[],
  keywords: string[]
): Promise<{ impact: string; synopsis: string }> => {
  requireAIDisclosureAcceptance();
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('managed_workflow_operation_not_supported');
  return getService().generateImpactSynopsis(text, categories, keywords, apiKey);
};

export const generateFinalAbstract = async (
  text: string,
  type: AbstractType,
  categories: Category[],
  keywords: string[],
  impact: string,
  synopsis: string,
  managedOperation: 'generation' | 'deep_update' = 'generation',
  workflowContext = text
): Promise<AbstractData> => {
  requireAIDisclosureAcceptance();
  const apiKey = getApiKey();
  const service = getService();
  const run = () =>
    service.generateFinalAbstract(
      text,
      type,
      categories,
      keywords,
      impact,
      synopsis,
      apiKey,
      managedOperation,
      workflowContext
    );
  if (!apiKey)
    return openai.generateFinalAbstract(
      text,
      type,
      categories,
      keywords,
      impact,
      synopsis,
      undefined,
      managedOperation,
      workflowContext,
      true
    );
  return withExplicitManagedFallback(apiKey, run, () =>
    openai.generateFinalAbstract(
      text,
      type,
      categories,
      keywords,
      impact,
      synopsis,
      undefined,
      managedOperation,
      workflowContext,
      true
    )
  );
};

export const generateCreativeAbstract = async (coreIdea: string): Promise<AbstractData> => {
  requireAIDisclosureAcceptance();
  const apiKey = getApiKey();
  const service = getService();
  if (!apiKey) return openai.generateCreativeAbstract(coreIdea, undefined, true);
  return withExplicitManagedFallback(
    apiKey,
    () => service.generateCreativeAbstract(coreIdea, apiKey),
    () => openai.generateCreativeAbstract(coreIdea, undefined, true)
  );
};

export const generateImage = (imageState: ImageState, creativeContext: string): Promise<string> => {
  requireAIDisclosureAcceptance();
  const provider = getProvider();
  const saved = getSettings();
  if (provider === 'anthropic') {
    throw new Error('Anthropic Messages does not provide image generation.');
  }
  return provider === 'openai'
    ? openai.generateImage(imageState, creativeContext, saved.openAIApiKey)
    : gemini.generateImage(imageState, creativeContext, saved.googleApiKey);
};

export const generateImageForProvider = (
  provider: 'nano-banana-pro' | 'gpt-image-2',
  imageState: ImageState,
  creativeContext: string
): Promise<string> => {
  requireAIDisclosureAcceptance();
  const saved = JSON.parse(localStorage.getItem('app-settings') || '{}');
  return provider === 'nano-banana-pro'
    ? gemini.generateImage(imageState, creativeContext, saved.googleApiKey)
    : openai.generateImage(imageState, creativeContext, saved.openAIApiKey);
};

// Conference-specific functions
export const analyzeContentForConference = async (
  text: string,
  conference: string
): Promise<AnalysisResult> => {
  requireAIDisclosureAcceptance();
  const apiKey = getApiKey();
  const service = getService();
  if (conference === 'RSNA') {
    const locale = getAuxiliaryLocale();
    const run = () => service.analyzeRSNAContent(text, apiKey, locale);
    if (!apiKey) return openai.analyzeRSNAContent(text, undefined, locale, true);
    return withExplicitManagedFallback(apiKey, run, () =>
      openai.analyzeRSNAContent(text, undefined, locale, true)
    );
  }
  if (service === openai || service === anthropic) {
    const context = `${conference}:${text}`;
    const run = () => service.analyzeContent(text, apiKey, context);
    if (!apiKey) return openai.analyzeContent(text, undefined, context, true);
    return withExplicitManagedFallback(apiKey, run, () =>
      openai.analyzeContent(text, undefined, context, true)
    );
  }
  if ('analyzeContentForConference' in service) {
    const run = () => (service as any).analyzeContentForConference(text, conference);
    if (!apiKey) return openai.analyzeContent(text, undefined, `${conference}:${text}`, true);
    return withExplicitManagedFallback(apiKey, run, () =>
      openai.analyzeContent(text, undefined, `${conference}:${text}`, true)
    );
  }
  // Fallback to regular analysis
  const run = () => service.analyzeContent(text, apiKey);
  if (!apiKey) return openai.analyzeContent(text, undefined, `${conference}:${text}`, true);
  return withExplicitManagedFallback(apiKey, run, () =>
    openai.analyzeContent(text, undefined, `${conference}:${text}`, true)
  );
};

export const generateAbstractForConference = async (
  text: string,
  type: AbstractType,
  categories: Category[],
  keywords: string[],
  conference: string,
  conferenceContext?: RSNAClassification | string,
  managedOperation: 'generation' | 'deep_update' = 'generation',
  workflowContext = text
): Promise<AbstractData> => {
  requireAIDisclosureAcceptance();
  const apiKey = getApiKey();
  const service = getService();
  if (conference === 'RSNA') {
    const auxiliaryLocale = getAuxiliaryLocale();
    const category = categories[0]?.name;
    if (!category || !(RSNA_CATEGORIES as readonly string[]).includes(category)) {
      throw new Error(
        'RSNA_CATEGORY_REQUIRED: run RSNA analysis and choose one controlled category.'
      );
    }
    const controlledKeywords = normalizeRSNAKeywords(keywords);
    if (controlledKeywords.length < 3) {
      throw new Error('RSNA_KEYWORDS_REQUIRED: choose 3-7 controlled RSNA keywords.');
    }
    const suppliedClassification =
      typeof conferenceContext === 'object' ? conferenceContext : undefined;
    const provisionalClassification =
      suppliedClassification ??
      (type === 'RSNA Education Exhibit'
        ? {
            ...normalizeRSNAAnalysis(
              { categories, keywords: controlledKeywords },
              text,
              auxiliaryLocale
            ).rsna,
            contentType: 'education' as const,
            primaryPresentationFormat: 'digital-presentation' as const,
            alternativePresentationFormats: ['standalone-education-exhibit' as const],
          }
        : normalizeRSNAAnalysis({ categories, keywords: controlledKeywords }, text, auxiliaryLocale)
            .rsna);
    const classification = normalizeRSNAAnalysis(
      { categories, keywords: controlledKeywords, rsna: provisionalClassification },
      text,
      auxiliaryLocale
    ).rsna;
    const promptInput = {
      inputText: text,
      category,
      keywords: controlledKeywords,
      classification,
      mode: 'standard',
      auxiliaryLocale,
    } as const;
    const run = () =>
      service.generateRSNAAbstract(promptInput, apiKey, managedOperation, workflowContext);
    if (!apiKey)
      return openai.generateRSNAAbstract(
        promptInput,
        undefined,
        managedOperation,
        workflowContext,
        true
      );
    return withExplicitManagedFallback(apiKey, run, () =>
      openai.generateRSNAAbstract(promptInput, undefined, managedOperation, workflowContext, true)
    );
  }
  if ('generateAbstractForConference' in service) {
    return (service as any).generateAbstractForConference(
      text,
      type,
      categories,
      keywords,
      conference
    );
  }
  if (service === openai || service === anthropic) {
    const context = `${conference}:${workflowContext}`;
    const run = () =>
      service.generateFinalAbstract(
        text,
        type,
        categories,
        keywords,
        '',
        '',
        apiKey,
        managedOperation,
        context
      );
    if (!apiKey)
      return openai.generateFinalAbstract(
        text,
        type,
        categories,
        keywords,
        '',
        '',
        undefined,
        managedOperation,
        context,
        true
      );
    return withExplicitManagedFallback(apiKey, run, () =>
      openai.generateFinalAbstract(
        text,
        type,
        categories,
        keywords,
        '',
        '',
        undefined,
        managedOperation,
        context,
        true
      )
    );
  }
  // Fallback to regular generation
  const context = `${conference}:${workflowContext}`;
  const run = () =>
    service.generateFinalAbstract(
      text,
      type,
      categories,
      keywords,
      '',
      '',
      apiKey,
      managedOperation,
      context
    );
  if (!apiKey)
    return openai.generateFinalAbstract(
      text,
      type,
      categories,
      keywords,
      '',
      '',
      undefined,
      managedOperation,
      context,
      true
    );
  return withExplicitManagedFallback(apiKey, run, () =>
    openai.generateFinalAbstract(
      text,
      type,
      categories,
      keywords,
      '',
      '',
      undefined,
      managedOperation,
      context,
      true
    )
  );
};

export const generateCreativeAbstractForConference = async (
  coreIdea: string,
  conference: string,
  rsna?: RSNAClassification,
  category?: string,
  keywords: string[] = []
): Promise<AbstractData> => {
  requireAIDisclosureAcceptance();
  const apiKey = getApiKey();
  const service = getService();
  if (conference === 'RSNA') {
    const execute = async (target: any, forceManaged = false) => {
      const auxiliaryLocale = getAuxiliaryLocale();
      const analysis = rsna
        ? null
        : await target.analyzeRSNAContent(
            coreIdea,
            forceManaged ? undefined : apiKey,
            auxiliaryLocale,
            forceManaged
          );
      const provisionalClassification =
        rsna ??
        analysis?.rsna ??
        normalizeRSNAAnalysis({ categories: [], keywords }, coreIdea, auxiliaryLocale).rsna;
      const classification = normalizeRSNAAnalysis(
        {
          categories:
            analysis?.categories ??
            (category ? [{ name: category, type: 'main', probability: 1 }] : []),
          keywords: keywords.length ? keywords : (analysis?.keywords ?? []),
          rsna: provisionalClassification,
        },
        coreIdea,
        auxiliaryLocale
      ).rsna;
      const selectedCategory = category ?? analysis?.categories[0]?.name;
      if (!selectedCategory || !(RSNA_CATEGORIES as readonly string[]).includes(selectedCategory)) {
        throw new Error(
          'RSNA_CATEGORY_REQUIRED: automatic classification did not return a controlled category; run standard analysis and choose one category.'
        );
      }
      const controlledKeywords = normalizeRSNAKeywords(
        keywords.length ? keywords : (analysis?.keywords ?? [])
      );
      if (controlledKeywords.length < 3) {
        throw new Error(
          'RSNA_KEYWORDS_REQUIRED: automatic classification did not return 3-7 controlled keywords; run standard analysis and complete the keyword selection.'
        );
      }
      return target.generateRSNAAbstract(
        {
          inputText: coreIdea,
          category: selectedCategory,
          keywords: controlledKeywords,
          classification,
          mode: 'creative',
          auxiliaryLocale,
        },
        forceManaged ? undefined : apiKey,
        'generation',
        coreIdea,
        forceManaged
      );
    };
    if (!apiKey) return execute(openai, true);
    return withExplicitManagedFallback(
      apiKey,
      () => execute(service),
      () => execute(openai, true)
    );
  }
  if ('generateCreativeAbstractForConference' in service) {
    const run = () =>
      (service as any).generateCreativeAbstractForConference(coreIdea, conference, apiKey);
    if (!apiKey) return openai.generateCreativeAbstract(coreIdea, undefined, true);
    return withExplicitManagedFallback(apiKey, run, () =>
      openai.generateCreativeAbstract(coreIdea, undefined, true)
    );
  }
  // Fallback to regular creative generation
  const run = () => service.generateCreativeAbstract(coreIdea, apiKey);
  if (!apiKey) return openai.generateCreativeAbstract(coreIdea, undefined, true);
  return withExplicitManagedFallback(apiKey, run, () =>
    openai.generateCreativeAbstract(coreIdea, undefined, true)
  );
};
