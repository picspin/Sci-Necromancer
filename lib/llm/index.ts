import * as gemini from './gemini';
import * as openai from './openai';
import {
  AbstractData,
  ImageState,
  AnalysisResult,
  Category,
  AbstractType,
  AbstractTypeSuggestion,
  RSNAClassification,
} from '../../types';
import {
  normalizeRSNAAnalysis,
  normalizeRSNAKeywords,
  RSNA_CATEGORIES,
} from '../conference/rsnaRules';
import { requireAIDisclosureAcceptance } from '../compliance/aiDisclosure';

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
const getProvider = (): 'google' | 'openai' => {
  try {
    const savedSettings = localStorage.getItem('app-settings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      return settings.provider || 'google';
    }
  } catch (e) {
    // Ignore parsing error, default to google
  }
  return 'google';
};

const getApiKey = (): string | undefined => {
  try {
    const savedSettings = localStorage.getItem('app-settings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      const provider = settings.provider || 'google';
      if (provider === 'openai') {
        return settings.openAIApiKey;
      } else {
        return settings.googleApiKey;
      }
    }
  } catch (e) {
    console.error('Failed to get API key from settings:', e);
  }
  return undefined;
};

const getService = () => {
  const provider = getProvider();
  if (provider === 'openai') {
    return openai;
  }
  return gemini;
};

const getAuxiliaryLocale = (): 'en' | 'zh' =>
  localStorage.getItem('i18nextLng')?.toLowerCase().startsWith('zh') ? 'zh' : 'en';

export const analyzeContent = (text: string): Promise<AnalysisResult> => {
  requireAIDisclosureAcceptance();
  const apiKey = getApiKey();
  return getService().analyzeContent(text, apiKey);
};

export const suggestAbstractType = (
  text: string,
  categories: Category[],
  keywords: string[]
): Promise<AbstractTypeSuggestion[]> => {
  requireAIDisclosureAcceptance();
  const apiKey = getApiKey();
  return getService().suggestAbstractType(text, categories, keywords, apiKey);
};

export const generateImpactSynopsis = (
  text: string,
  categories: Category[],
  keywords: string[]
): Promise<{ impact: string; synopsis: string }> => {
  requireAIDisclosureAcceptance();
  const apiKey = getApiKey();
  return getService().generateImpactSynopsis(text, categories, keywords, apiKey);
};

export const generateFinalAbstract = (
  text: string,
  type: AbstractType,
  categories: Category[],
  keywords: string[],
  impact: string,
  synopsis: string
): Promise<AbstractData> => {
  requireAIDisclosureAcceptance();
  const apiKey = getApiKey();
  return getService().generateFinalAbstract(
    text,
    type,
    categories,
    keywords,
    impact,
    synopsis,
    apiKey
  );
};

export const generateCreativeAbstract = (coreIdea: string): Promise<AbstractData> => {
  requireAIDisclosureAcceptance();
  const apiKey = getApiKey();
  return getService().generateCreativeAbstract(coreIdea, apiKey);
};

export const generateImage = (imageState: ImageState, creativeContext: string): Promise<string> => {
  requireAIDisclosureAcceptance();
  const apiKey = getApiKey();
  return getService().generateImage(imageState, creativeContext, apiKey);
};

export const generateImageNanobana = (
  imageState: ImageState,
  specsJson: string
): Promise<string> => {
  requireAIDisclosureAcceptance();
  const apiKey = getApiKey();
  return openai.generateImageNanobana(imageState, specsJson, apiKey);
};

export const generateImageNanobanaViaProxy = (
  imageState: ImageState,
  specsJson: string
): Promise<string> => {
  requireAIDisclosureAcceptance();
  return openai.generateImageNanobanaViaProxy(imageState, specsJson);
};

// Conference-specific functions
export const analyzeContentForConference = (
  text: string,
  conference: string
): Promise<AnalysisResult> => {
  requireAIDisclosureAcceptance();
  const apiKey = getApiKey();
  const service = getService();
  if (conference === 'RSNA') {
    return service.analyzeRSNAContent(text, apiKey, getAuxiliaryLocale());
  }
  if ('analyzeContentForConference' in service) {
    return (service as any).analyzeContentForConference(text, conference);
  }
  // Fallback to regular analysis
  return service.analyzeContent(text, apiKey);
};

export const generateAbstractForConference = (
  text: string,
  type: AbstractType,
  categories: Category[],
  keywords: string[],
  conference: string,
  conferenceContext?: RSNAClassification | string
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
    return service.generateRSNAAbstract(
      {
        inputText: text,
        category,
        keywords: controlledKeywords,
        classification,
        mode: 'standard',
        auxiliaryLocale,
      },
      apiKey
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
  // Fallback to regular generation
  return service.generateFinalAbstract(text, type, categories, keywords, '', '', apiKey);
};

export const generateCreativeAbstractForConference = (
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
    return (async () => {
      const auxiliaryLocale = getAuxiliaryLocale();
      const analysis = rsna
        ? null
        : await service.analyzeRSNAContent(coreIdea, apiKey, auxiliaryLocale);
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
      return service.generateRSNAAbstract(
        {
          inputText: coreIdea,
          category: selectedCategory,
          keywords: controlledKeywords,
          classification,
          mode: 'creative',
          auxiliaryLocale,
        },
        apiKey
      );
    })();
  }
  if ('generateCreativeAbstractForConference' in service) {
    return (service as any).generateCreativeAbstractForConference(coreIdea, conference, apiKey);
  }
  // Fallback to regular creative generation
  return service.generateCreativeAbstract(coreIdea, apiKey);
};
