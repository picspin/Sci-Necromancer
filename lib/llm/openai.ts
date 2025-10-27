import { AbstractData, ImageState, AnalysisResult, Category, AbstractType, AbstractTypeSuggestion } from '../../types';

const notImplementedError = new Error("The selected OpenAI provider is not yet implemented. Please switch to Google AI in the settings.");

export const analyzeContent = async (text: string): Promise<AnalysisResult> => {
  console.error("OpenAI analyzeContent called but not implemented.");
  throw notImplementedError;
};

export const suggestAbstractType = async (text: string, categories: Category[], keywords: string[]): Promise<AbstractTypeSuggestion[]> => {
    console.error("OpenAI suggestAbstractType called but not implemented.");
    throw notImplementedError;
};

export const generateFinalAbstract = async (text: string, type: AbstractType, categories: Category[], keywords: string[]): Promise<AbstractData> => {
    console.error("OpenAI generateFinalAbstract called but not implemented.");
    throw notImplementedError;
};

export const generateCreativeAbstract = async (coreIdea: string): Promise<AbstractData> => {
    console.error("OpenAI generateCreativeAbstract called but not implemented.");
    throw notImplementedError;
};


export const generateImage = async (imageState: ImageState, creativeContext: string): Promise<string> => {
    console.error("OpenAI generateImage called but not implemented.");
    throw notImplementedError;
};
