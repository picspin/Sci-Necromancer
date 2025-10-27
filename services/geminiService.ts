
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AbstractData, GenerationMode, ImageState } from '../types';

// FIX: Initialize GoogleGenAI with API_KEY from environment variables as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const abstractSchema = {
  type: Type.OBJECT,
  properties: {
    impact: {
      type: Type.STRING,
      description: "A concise, high-impact statement (approx. 50 words) summarizing the key findings and their importance, as per ISMRM guidelines.",
    },
    synopsis: {
      type: Type.STRING,
      description: "A detailed summary of the work (approx. 200-250 words), covering introduction, methods, results, and conclusion, formatted for an ISMRM abstract.",
    },
    keywords: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
      },
      description: "A list of 3-5 relevant keywords for the abstract.",
    },
  },
  required: ["impact", "synopsis", "keywords"],
};

const getAbstractGenerationPrompt = (text: string, mode: GenerationMode): string => {
  const commonInstructions = `
    You are an expert academic assistant specializing in creating abstracts for the International Society for Magnetic Resonance in Medicine (ISMRM) conference.
    Your task is to generate a structured abstract containing three sections: Impact, Synopsis, and Keywords.
    Adhere strictly to ISMRM guidelines: the Impact should be a short, powerful summary, and the Synopsis a more detailed overview.
    The output must be in JSON format matching the provided schema.
  `;

  if (mode === 'standard') {
    return `${commonInstructions}
      Analyze the following academic text and generate the abstract sections based on its content.
      
      Text:
      ---
      ${text}
      ---
    `;
  } else { // creative mode
    return `${commonInstructions}
      Take the following core idea and creatively expand it into a full, compelling ISMRM abstract. 
      Invent plausible details for methods, results, and conclusions that align with the initial concept.
      
      Core Idea: "${text}"
    `;
  }
};


export const generateAbstract = async (text: string, mode: GenerationMode): Promise<AbstractData> => {
  const prompt = getAbstractGenerationPrompt(text, mode);
  
  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: abstractSchema,
        },
    });

    const jsonString = response.text.trim();
    const parsed = JSON.parse(jsonString);

    // Basic validation
    if (parsed.impact && parsed.synopsis && Array.isArray(parsed.keywords)) {
        return parsed as AbstractData;
    } else {
        throw new Error("Received malformed JSON from API.");
    }
  } catch (error) {
    console.error("Error generating abstract:", error);
    throw new Error("Failed to generate abstract. The model may be unavailable or the request failed.");
  }
};

export const generateImage = async (mode: GenerationMode, imageState: ImageState, creativeContext: string): Promise<string> => {
    try {
        let response;
        if (mode === 'standard' && imageState.base64 && imageState.file) {
            // Edit image
            response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    parts: [
                        {
                            inlineData: {
                                data: imageState.base64,
                                mimeType: imageState.file.type,
                            },
                        },
                        {
                            text: `Optimize and edit this scientific/medical image based on the following specifications: ${imageState.specs}. Ensure the output is professional and clear for an academic publication.`,
                        },
                    ],
                },
                config: {
                    responseModalities: [Modality.IMAGE],
                },
            });
        } else { // Creative mode or if standard mode fails to provide image
            const prompt = `Generate a scientific or medical imaging figure based on this context: ${creativeContext}. Specifications: ${imageState.specs}. The image should be publication-quality.`;
            response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [{ text: prompt }] },
                config: {
                    responseModalities: [Modality.IMAGE],
                },
            });
        }

        const part = response.candidates?.[0]?.content?.parts?.[0];
        if (part && part.inlineData) {
            return part.inlineData.data;
        } else {
            throw new Error("No image data received from API.");
        }

    } catch (error) {
        console.error("Error generating image:", error);
        throw new Error("Failed to generate image. The model may be unavailable or the request failed.");
    }
};
