import * as gemini from './gemini';
import * as openai from './openai';
import { AbstractData, ImageState, AnalysisResult, Category, AbstractType, AbstractTypeSuggestion } from '../../types';

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

const getService = () => {
    const provider = getProvider();
    if (provider === 'openai') {
        return openai;
    }
    return gemini;
};

export const analyzeContent = (text: string): Promise<AnalysisResult> => {
  return getService().analyzeContent(text);
};

export const suggestAbstractType = (text: string, categories: Category[], keywords: string[]): Promise<AbstractTypeSuggestion[]> => {
    return getService().suggestAbstractType(text, categories, keywords);
};

export const generateFinalAbstract = (text: string, type: AbstractType, categories: Category[], keywords: string[]): Promise<AbstractData> => {
    return getService().generateFinalAbstract(text, type, categories, keywords);
};

export const generateCreativeAbstract = (coreIdea: string): Promise<AbstractData> => {
    return getService().generateCreativeAbstract(coreIdea);
};

export const generateImage = (imageState: ImageState, creativeContext: string): Promise<string> => {
    return getService().generateImage(imageState, creativeContext);
};