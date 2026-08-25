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
  Conference,
  Settings,
  AIAssistanceRecord,
} from '../../types';
import {
  normalizeRSNAAnalysis,
  normalizeRSNAKeywords,
  RSNA_CATEGORIES,
} from '../conference/rsnaRules';
import {
  collectAIAssistanceRecords,
  createAIAssistanceRecord,
  getTrustedAIAssistance,
  requireAIDisclosureAcceptance,
} from '../compliance/aiDisclosure';
import {
  canUseManagedText,
  canUseManagedResearchVerification,
  hasManagedCredits,
  generateManagedResearchVerification,
  generateManagedText,
} from '../../src/composables/useMembership';
import { assertBlindReviewAssessment } from '../review/blindReview';
import { resolveTextRoute, selectedByokTextModel } from './capabilityRouting';
import {
  enabledMGAResearchToolIds,
  hasEnabledMGAResearchAgent,
} from '../capabilities/managedResearchCapabilities';
import { getManagedAnalysisRetryNotice, managedConferenceContext } from './managedTextWorkflow';
import { announceByokTextFailure } from './modelEvents';
import { openMemberPanel } from '../../src/services/memberCta';
import {
  completeTextModelGeneration,
  getLockedTextModel,
  getTextWorkflowAssistance,
  lockTextModelForAnalysis,
  recordTextWorkflowAssistance,
  type TextModelSnapshot,
} from './textModelWorkflow';

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

const getTextRoute = (workflowContext?: string) => {
  const rawSettings = getSettings();
  const settings = { ...rawSettings, provider: rawSettings.provider || 'google' } as Settings;
  const locked = workflowContext ? getLockedTextModel(workflowContext) : null;
  if (locked?.source === 'managed') {
    settings.textGenerationSource = 'managed';
    settings.memberManagedTextEnabled = true;
    settings.memberManagedTextModel = locked.model === 'gpt-5.6-luna' ? 'gpt-5.6-luna' : 'glm-5.2';
  } else if (locked?.source === 'byok' && locked.provider !== 'mga') {
    settings.textGenerationSource = 'byok';
    settings.provider = locked.provider;
    if (locked.provider === 'google') settings.model = locked.model;
    if (locked.provider === 'openai') settings.openAITextModel = locked.model;
    if (locked.provider === 'anthropic') settings.anthropicTextModel = locked.model;
  }
  return { settings, route: resolveTextRoute(settings, canUseManagedText()) };
};

const getProvider = (workflowContext?: string): AIProvider =>
  getTextRoute(workflowContext).settings.provider || 'google';

const compatibleProviderDisplayName = (
  baseUrl: string | undefined,
  officialHostname: string,
  officialName: string,
  protocolName: string
): string => {
  const configuredUrl = baseUrl?.trim();
  if (!configuredUrl) return officialName;
  try {
    const hostname = new URL(configuredUrl).hostname.toLowerCase();
    if (hostname === officialHostname || hostname.endsWith(`.${officialHostname}`)) {
      return officialName;
    }
    return `${protocolName} (user configured; underlying model not verified)`;
  } catch {
    return `${protocolName} (user configured; underlying model not verified)`;
  }
};

const currentTextModel = (
  workflowContext?: string
): Pick<AIAssistanceRecord, 'provider' | 'providerDisplayName' | 'model'> => {
  const locked = workflowContext ? getLockedTextModel(workflowContext) : null;
  if (locked) {
    return {
      provider: locked.provider,
      providerDisplayName: locked.providerDisplayName,
      model: locked.model,
    };
  }
  const { settings, route } = getTextRoute(workflowContext);
  if (route === 'managed') {
    return {
      provider: 'mga',
      providerDisplayName: 'MGA',
      model: settings.memberManagedTextModel || 'glm-5.2',
    };
  }
  if (settings.provider === 'anthropic') {
    return {
      provider: 'anthropic',
      providerDisplayName: compatibleProviderDisplayName(
        settings.anthropicBaseUrl,
        'api.anthropic.com',
        'Anthropic',
        'Anthropic Messages-compatible API'
      ),
      model: selectedByokTextModel(settings) || 'claude-sonnet-4-5',
    };
  }
  if (settings.provider === 'openai') {
    return {
      provider: 'openai',
      providerDisplayName: compatibleProviderDisplayName(
        settings.openAIBaseUrl,
        'api.openai.com',
        'OpenAI',
        'OpenAI-compatible API'
      ),
      model: selectedByokTextModel(settings) || 'gpt-4o',
    };
  }
  return {
    provider: 'google',
    providerDisplayName: 'Google',
    model: selectedByokTextModel(settings) || 'gemini-2.5-pro',
  };
};

const currentTextSnapshot = (): TextModelSnapshot | null => {
  const { route } = getTextRoute();
  if (route === 'unavailable') return null;
  const identity = currentTextModel();
  return {
    source: route === 'managed' ? 'managed' : 'byok',
    provider: identity.provider,
    providerDisplayName: identity.providerDisplayName,
    model: identity.model,
  };
};

const lockCurrentTextModel = (workflowContext: string): TextModelSnapshot | null => {
  const snapshot = currentTextSnapshot();
  return snapshot ? lockTextModelForAnalysis(workflowContext, snapshot) : null;
};

const requireManagedCredits = (required: number, workflowContext?: string): void => {
  if (getTextRoute(workflowContext).route !== 'managed' || hasManagedCredits(required)) return;
  openMemberPanel();
  throw new Error('member_insufficient_credits');
};

const requireAnalysisCredits = (workflowContext: string): void => {
  if (getManagedAnalysisRetryNotice(workflowContext) === 'charge_applies') {
    requireManagedCredits(1, workflowContext);
  }
};

const runAndRecordAnalysis = async <T>(
  workflowContext: string,
  operations: string[],
  run: () => Promise<T>
): Promise<T> => {
  requireAnalysisCredits(workflowContext);
  const result = await run();
  const trustedRecord =
    result && typeof result === 'object' ? getTrustedAIAssistance(result as object) : undefined;
  const identity = trustedRecord ?? currentTextModel(workflowContext);
  recordTextWorkflowAssistance(
    workflowContext,
    createAIAssistanceRecord({
      ...identity,
      modelType: trustedRecord?.modelType,
      mode: 'standard',
      operations,
      methodsDisclosureRequired: trustedRecord?.methodsDisclosureRequired,
      generatedAt: trustedRecord?.generatedAt,
    })
  );
  return result;
};

const withAIAssistance = (
  result: AbstractData,
  mode: 'standard' | 'creative',
  operations: string[],
  workflowContext?: string
): AbstractData => {
  const trustedManagedRecord = getTrustedAIAssistance(result);
  const identity = trustedManagedRecord ?? currentTextModel(workflowContext);
  const {
    aiAssistance: _untrustedAssistance,
    aiAssistanceRecords: _untrustedRecords,
    ...safeResult
  } = result;
  const currentRecord = createAIAssistanceRecord({
    provider: identity.provider,
    providerDisplayName: identity.providerDisplayName,
    model: identity.model,
    modelType: trustedManagedRecord?.modelType,
    mode,
    operations,
    methodsDisclosureRequired: trustedManagedRecord?.methodsDisclosureRequired,
    generatedAt: trustedManagedRecord?.generatedAt,
  });
  const priorRecords = workflowContext ? getTextWorkflowAssistance(workflowContext) : [];
  return {
    ...safeResult,
    aiAssistance: currentRecord,
    aiAssistanceRecords: collectAIAssistanceRecords({
      aiAssistanceRecords: [...priorRecords, currentRecord],
    }),
  };
};

const getApiKey = (workflowContext?: string): string | undefined => {
  try {
    const { settings, route } = getTextRoute(workflowContext);
    if (route !== 'byok') return undefined;
    if (settings.provider === 'openai') return settings.openAIApiKey;
    if (settings.provider === 'anthropic') return settings.anthropicApiKey;
    return settings.googleApiKey;
  } catch (e) {
    console.error('Failed to get API key from settings:', e);
  }
  return undefined;
};

const getService = (allowManagedText = true, workflowContext?: string) => {
  const { route } = getTextRoute(workflowContext);
  const provider = getProvider(workflowContext);
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

async function runSelectedByok<T>(run: () => Promise<T>, workflowContext?: string): Promise<T> {
  try {
    return await run();
  } catch (byokError) {
    announceByokTextFailure(workflowContext);
    throw byokError;
  }
}

export const analyzeISMRMBundle = async (text: string): Promise<ISMRMAnalysisBundle> => {
  requireAIDisclosureAcceptance();
  const workflowContext = managedConferenceContext('ISMRM', text);
  lockCurrentTextModel(workflowContext);
  const apiKey = getApiKey(workflowContext);
  const service = getService(true, workflowContext);
  return runAndRecordAnalysis(workflowContext, ['ISMRM content analysis'], () =>
    !apiKey
      ? openai.analyzeISMRMBundle(text, undefined, workflowContext, true)
      : runSelectedByok(
          () => service.analyzeISMRMBundle(text, apiKey, workflowContext),
          workflowContext
        )
  );
};

const getAuxiliaryLocale = (): 'en' | 'zh' =>
  localStorage.getItem('i18nextLng')?.toLowerCase().startsWith('zh') ? 'zh' : 'en';

export async function reviewAbstractBlind(prompt: string): Promise<BlindReviewModelAssessment> {
  requireAIDisclosureAcceptance();
  const apiKey = getApiKey();
  if (apiKey) {
    return runSelectedByok(async () => {
      const assessment = await getService(false).reviewAbstractBlind(prompt, apiKey);
      const identity = currentTextModel();
      return {
        ...assessment,
        aiAssistance: createAIAssistanceRecord({
          ...identity,
          mode: 'standard',
          operations: ['independent abstract review'],
        }),
      };
    });
  }
  return runManagedBlindReview(prompt);
}

async function runManagedBlindReview(prompt: string): Promise<BlindReviewModelAssessment> {
  const idempotencyKey =
    globalThis.crypto?.randomUUID?.() ?? `blind-review-${Date.now()}-${Math.random()}`;
  const capabilities = getSettings().capabilities;
  const enabledIds = Array.isArray(capabilities?.managedEnabledIds)
    ? capabilities.managedEnabledIds
    : [];
  const researchToolIds = enabledMGAResearchToolIds(enabledIds);
  const useResearchAgent = hasEnabledMGAResearchAgent(capabilities);
  if (
    (useResearchAgent && !canUseManagedResearchVerification()) ||
    (!useResearchAgent && !canUseManagedText())
  ) {
    throw new Error('llm.api_key_missing');
  }
  if (!hasManagedCredits(1)) {
    openMemberPanel();
    throw new Error('member_insufficient_credits');
  }
  const result = useResearchAgent
    ? await generateManagedResearchVerification({
        prompt,
        idempotencyKey,
        enabledCapabilityIds: researchToolIds,
      })
    : await generateManagedText({ prompt, idempotencyKey, operation: 'blind_review' });
  try {
    const assessment = assertBlindReviewAssessment(JSON.parse(result.text));
    const fallbackIdentity = currentTextModel();
    return {
      ...assessment,
      aiAssistance: createAIAssistanceRecord({
        provider: result.provider ?? fallbackIdentity.provider,
        model: result.model ?? fallbackIdentity.model,
        modelType:
          result.modelType ?? (useResearchAgent ? 'research-agent' : 'large-language-model'),
        mode: 'standard',
        operations: useResearchAgent
          ? ['independent abstract review', 'read-only literature verification']
          : ['independent abstract review'],
        methodsDisclosureRequired: useResearchAgent,
      }),
    };
  } catch {
    throw new Error('blind_review.invalid_model_response');
  }
}

export const analyzeContent = async (text: string): Promise<AnalysisResult> => {
  requireAIDisclosureAcceptance();
  lockCurrentTextModel(text);
  const apiKey = getApiKey(text);
  const service = getService(true, text);
  return runAndRecordAnalysis(text, ['content analysis'], () =>
    !apiKey
      ? openai.analyzeContent(text, undefined, text, true)
      : runSelectedByok(() => service.analyzeContent(text, apiKey, text), text)
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
  requireManagedCredits(1, workflowContext);
  const apiKey = getApiKey(workflowContext);
  const service = getService(true, workflowContext);
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
  const result = !apiKey
    ? await openai.generateFinalAbstract(
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
    : await runSelectedByok(run, workflowContext);
  const assisted = withAIAssistance(
    result,
    'standard',
    [
      'abstract drafting',
      'language revision',
      managedOperation === 'deep_update' ? 'deep revision' : 'structure and compliance review',
    ],
    workflowContext
  );
  completeTextModelGeneration(workflowContext);
  return assisted;
};

export const generateCreativeAbstract = async (coreIdea: string): Promise<AbstractData> => {
  requireAIDisclosureAcceptance();
  requireManagedCredits(1);
  const apiKey = getApiKey();
  const service = getService();
  const result = !apiKey
    ? await openai.generateCreativeAbstract(coreIdea, undefined, true)
    : await runSelectedByok(() => service.generateCreativeAbstract(coreIdea, apiKey));
  return withAIAssistance(result, 'creative', [
    'content generation from an author-supplied concept',
    'language drafting',
    'structure and compliance review',
  ]);
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
  conference: Conference
): Promise<AnalysisResult> => {
  requireAIDisclosureAcceptance();
  const managedContext = managedConferenceContext(conference, text);
  lockCurrentTextModel(managedContext);
  const apiKey = getApiKey(managedContext);
  const service = getService(true, managedContext);
  return runAndRecordAnalysis(
    managedContext,
    [`${conference} content analysis and classification`],
    async () => {
      if (conference === 'RSNA') {
        const locale = getAuxiliaryLocale();
        const run = () => service.analyzeRSNAContent(text, apiKey, locale);
        if (!apiKey) return openai.analyzeRSNAContent(text, undefined, locale, true);
        return runSelectedByok(run, managedContext);
      }
      if (service === openai || service === anthropic) {
        const run = () => service.analyzeContent(text, apiKey, managedContext);
        if (!apiKey) return openai.analyzeContent(text, undefined, managedContext, true);
        return runSelectedByok(run, managedContext);
      }
      if ('analyzeContentForConference' in service) {
        const run = () => (service as any).analyzeContentForConference(text, conference);
        if (!apiKey) return openai.analyzeContent(text, undefined, managedContext, true);
        return runSelectedByok(run, managedContext);
      }
      const run = () => service.analyzeContent(text, apiKey, managedContext);
      if (!apiKey) return openai.analyzeContent(text, undefined, managedContext, true);
      return runSelectedByok(run, managedContext);
    }
  );
};

export const generateAbstractForConference = async (
  text: string,
  type: AbstractType,
  categories: Category[],
  keywords: string[],
  conference: Conference,
  conferenceContext?: RSNAClassification | string,
  managedOperation: 'generation' | 'deep_update' = 'generation',
  workflowContext = text
): Promise<AbstractData> => {
  requireAIDisclosureAcceptance();
  const lockedContext = managedConferenceContext(conference, workflowContext);
  requireManagedCredits(1, lockedContext);
  const apiKey = getApiKey(lockedContext);
  const service = getService(true, lockedContext);
  const finalize = (result: AbstractData) => {
    const assisted = withAIAssistance(
      result,
      'standard',
      [
        `${conference} classification-informed abstract drafting`,
        'language revision',
        managedOperation === 'deep_update' ? 'deep revision' : 'structure and compliance review',
      ],
      lockedContext
    );
    completeTextModelGeneration(lockedContext);
    return assisted;
  };
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
    const result = !apiKey
      ? await openai.generateRSNAAbstract(
          promptInput,
          undefined,
          managedOperation,
          workflowContext,
          true
        )
      : await runSelectedByok(run, lockedContext);
    return finalize(result);
  }
  if ('generateAbstractForConference' in service) {
    return finalize(
      await (service as any).generateAbstractForConference(
        text,
        type,
        categories,
        keywords,
        conference
      )
    );
  }
  if (service === openai || service === anthropic) {
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
        lockedContext
      );
    const result = !apiKey
      ? await openai.generateFinalAbstract(
          text,
          type,
          categories,
          keywords,
          '',
          '',
          undefined,
          managedOperation,
          lockedContext,
          true
        )
      : await runSelectedByok(run, lockedContext);
    return finalize(result);
  }
  // Fallback to regular generation
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
      lockedContext
    );
  const result = !apiKey
    ? await openai.generateFinalAbstract(
        text,
        type,
        categories,
        keywords,
        '',
        '',
        undefined,
        managedOperation,
        lockedContext,
        true
      )
    : await runSelectedByok(run, lockedContext);
  return finalize(result);
};

export const generateCreativeAbstractForConference = async (
  coreIdea: string,
  conference: Conference,
  rsna?: RSNAClassification,
  category?: string,
  keywords: string[] = []
): Promise<AbstractData> => {
  requireAIDisclosureAcceptance();
  requireManagedCredits(1);
  const apiKey = getApiKey();
  const service = getService();
  const finalize = (result: AbstractData) =>
    withAIAssistance(result, 'creative', [
      `${conference}-aware creative drafting`,
      'content generation from an author-supplied concept',
      'language drafting',
      'structure and compliance review',
    ]);
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
    const result = !apiKey
      ? await execute(openai, true)
      : await runSelectedByok(() => execute(service));
    return finalize(result);
  }
  if ('generateCreativeAbstractForConference' in service) {
    const run = (): Promise<AbstractData> =>
      (service as any).generateCreativeAbstractForConference(coreIdea, conference, apiKey);
    const result = !apiKey
      ? await openai.generateCreativeAbstract(coreIdea, undefined, true)
      : await runSelectedByok(run);
    return finalize(result);
  }
  // Fallback to regular creative generation
  const run = () => service.generateCreativeAbstract(coreIdea, apiKey);
  const result = !apiKey
    ? await openai.generateCreativeAbstract(coreIdea, undefined, true)
    : await runSelectedByok(run);
  return finalize(result);
};
