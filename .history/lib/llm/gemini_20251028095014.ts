import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AbstractData, ImageState, AnalysisResult, Category, AbstractType, AbstractTypeSuggestion } from '../../types';
import * as prompts from './prompts/ismrmPrompts';

// Initialize AI client lazily with API key from settings
let aiClient: GoogleGenAI | null = null;

const getAIClient = (apiKey?: string): GoogleGenAI => {
  const key = apiKey || localStorage.getItem('google-api-key') || '';
  if (!key) {
    throw new Error("Google API key not configured. Please add your API key in settings.");
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
};

// Schemas for structured responses
const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    categories: {
      type: Type.ARRAY,
      description: "List of identified categories with their type (main, sub, secondary) and probability.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          type: { type: Type.STRING, enum: ['main', 'sub', 'secondary'] },
          probability: { type: Type.NUMBER }
        },
        required: ["name", "type", "probability"]
      }
    },
    keywords: {
      type: Type.ARRAY,
      description: "List of 3-7 relevant keywords.",
      items: { type: Type.STRING }
    }
  },
  required: ["categories", "keywords"]
};

const abstractTypeSchema = {
    type: Type.ARRAY,
    description: "A list of suitable abstract types with their corresponding probability.",
    items: {
        type: Type.OBJECT,
        properties: {
            type: { type: Type.STRING, enum: ['Standard Abstract', 'MRI in Clinical Practice Abstract', 'ISMRT Abstract', 'Registered Abstract'] },
            probability: { type: Type.NUMBER }
        },
        required: ["type", "probability"]
    }
};

const finalAbstractSchema = {
  type: Type.OBJECT,
  properties: {
    abstract: {
      type: Type.STRING,
      description: "The complete abstract body with proper sections (INTRODUCTION, METHODS, RESULTS, etc.) following the specified abstract type structure.",
    },
    impact: {
      type: Type.STRING,
      description: "A concise, high-impact statement (approx. 40 words) summarizing the key findings and their importance.",
    },
    synopsis: {
      type: Type.STRING,
      description: "A detailed summary of the work (approx. 100 words), covering motivation, goals, approach, and results.",
    },
    keywords: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "The list of user-confirmed keywords.",
    },
  },
  required: ["abstract", "impact", "synopsis", "keywords"],
};

async function callGeminiAPI<T>(prompt: string, schema: object, apiKey?: string): Promise<T> {
    try {
        const client = getAIClient(apiKey);
        const response = await client.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: schema,
            },
        });

        const jsonString = response.text?.trim();
        if (!jsonString) {
            throw new Error("Empty response from AI model");
        }
        return JSON.parse(jsonString) as T;
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error("Failed to get a valid response from the AI model.");
    }
}

export const analyzeContent = async (text: string, apiKey?: string): Promise<AnalysisResult> => {
  const prompt = await prompts.getAnalysisPrompt(text);
  return await callGeminiAPI<AnalysisResult>(prompt, analysisSchema, apiKey);
};

export const suggestAbstractType = async (text: string, categories: Category[], keywords: string[], apiKey?: string): Promise<AbstractTypeSuggestion[]> => {
    const prompt = await prompts.getAbstractTypeSuggestionPrompt(text, categories, keywords);
    const result = await callGeminiAPI<AbstractTypeSuggestion[]>(prompt, abstractTypeSchema, apiKey);
    // Sort by probability descending and filter ≥30% threshold
    return result
      .filter(suggestion => suggestion.probability >= 0.30)
      .sort((a, b) => b.probability - a.probability);
};

export const generateFinalAbstract = async (text: string, type: AbstractType, categories: Category[], keywords: string[], apiKey?: string): Promise<AbstractData> => {
    const prompt = await prompts.getFinalAbstractPrompt(text, type, categories, keywords);
    return await callGeminiAPI<AbstractData>(prompt, finalAbstractSchema, apiKey);
};

export const generateCreativeAbstract = async (coreIdea: string, apiKey?: string): Promise<AbstractData> => {
    const prompt = await prompts.getCreativeAbstractPrompt(coreIdea);
    // The output schema is the same as the final abstract
    return await callGeminiAPI<AbstractData>(prompt, finalAbstractSchema, apiKey);
};


export const generateImage = async (imageState: ImageState, creativeContext: string, apiKey?: string): Promise<string> => {
    try {
        const client = getAIClient(apiKey);
        let response;
        if (imageState.base64 && imageState.file) { // Standard mode
            response = await client.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    parts: [
                        { inlineData: { data: imageState.base64, mimeType: imageState.file.type }},
                        { text: `Optimize and edit this scientific/medical image based on the following specifications: ${imageState.specs}. Ensure the output is professional and clear for an academic publication.`},
                    ],
                },
                config: { responseModalities: [Modality.IMAGE] },
            });
        } else { // Creative mode
            const prompt = `Generate a scientific or medical imaging figure based on this context: ${creativeContext}. Specifications: ${imageState.specs}. The image should be publication-quality.`;
            response = await client.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [{ text: prompt }] },
                config: { responseModalities: [Modality.IMAGE] },
            });
        }

        const part = response.candidates?.[0]?.content?.parts?.[0];
        if (part && part.inlineData && part.inlineData.data) {
            return part.inlineData.data;
        } else {
            throw new Error("No image data received from API.");
        }
    } catch (error) {
        console.error("Error generating image:", error);
        throw new Error("Failed to generate image. The model may be unavailable or the request failed.");
    }
};