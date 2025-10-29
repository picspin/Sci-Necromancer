import * as gemini from './gemini';
import * as openai from './openai';
import { AbstractData, ImageState, AnalysisResult, Category, AbstractType, AbstractTypeSuggestion } from '../../types';

// Export writing style utilities
export { 
  DEFAULT_WRITING_STYLE,
  generateWritingStylePrompt,
  detectProhibitedPhrases,
  validateWritingStyle,
  getWritingStyleInstructions,
  type WritingStyleValidation,
  type WritingStyleIssue,
  type ProhibitedPhraseDetection
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

export const analyzeContent = (text: string): Promise<AnalysisResult> => {
  const apiKey = getApiKey();
  return getService().analyzeContent(text, apiKey);
};

export const suggestAbstractType = (text: string, categories: Category[], keywords: string[]): Promise<AbstractTypeSuggestion[]> => {
    const apiKey = getApiKey();
    return getService().suggestAbstractType(text, categories, keywords, apiKey);
};

export const generateImpactSynopsis = (text: string, categories: Category[], keywords: string[]): Promise<{impact: string, synopsis: string}> => {
    const apiKey = getApiKey();
    return getService().generateImpactSynopsis(text, categories, keywords, apiKey);
};

export const generateFinalAbstract = (text: string, type: AbstractType, categories: Category[], keywords: string[], impact: string, synopsis: string): Promise<AbstractData> => {
    const apiKey = getApiKey();
    return getService().generateFinalAbstract(text, type, categories, keywords, impact, synopsis, apiKey);
};

export const generateCreativeAbstract = (coreIdea: string): Promise<AbstractData> => {
    const apiKey = getApiKey();
    return getService().generateCreativeAbstract(coreIdea, apiKey);
};

export const generateImage = (imageState: ImageState, creativeContext: string): Promise<string> => {
    const apiKey = getApiKey();
    return getService().generateImage(imageState, creativeContext, apiKey);
};

// Conference-specific functions
export const analyzeContentForConference = (text: string, conference: string): Promise<AnalysisResult> => {
    const apiKey = getApiKey();
    const service = getService();
    if ('analyzeContentForConference' in service) {
        return (service as any).analyzeContentForConference(text, conference, apiKey);
    }
    // Fallback to regular analysis
    return service.analyzeContent(text, apiKey);
};

export const generateAbstractForConference = (text: string, type: AbstractType, categories: Category[], keywords: string[], conference: string): Promise<AbstractData> => {
    const apiKey = getApiKey();
    const service = getService();
    if ('generateAbstractForConference' in service) {
        return (service as any).generateAbstractForConference(text, type, categories, keywords, conference, apiKey);
    }
    // Fallback to regular generation
    return service.generateFinalAbstract(text, type, categories, keywords, '', '', apiKey);
};

export const generateCreativeAbstractForConference = (coreIdea: string, conference: string): Promise<AbstractData> => {
    const apiKey = getApiKey();
    const service = getService();
    if ('generateCreativeAbstractForConference' in service) {
        return (service as any).generateCreativeAbstractForConference(coreIdea, conference, apiKey);
    }
    // Fallback to regular creative generation
    return service.generateCreativeAbstract(coreIdea, apiKey);
};
