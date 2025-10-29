import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AbstractData, GenerationMode, ImageState } from "../types";

// 初始化时检查 API Key（如果你希望在构建时报错，可提前在这里判断）
const apiKey = process.env.API_KEY;
if (!apiKey) {
  // 可选：抛出或仅警告
  console.warn("[geminiService] Missing API_KEY environment variable.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "" });

const abstractSchema = {
  type: Type.OBJECT,
  properties: {
    impact: {
      type: Type.STRING,
      description:
        "A concise, high-impact statement (approx. 50 words) summarizing the key findings and their importance, as per ISMRM guidelines.",
    },
    synopsis: {
      type: Type.STRING,
      description:
        "A detailed summary of the work (approx. 200-250 words), covering introduction, methods, results, and conclusion, formatted for an ISMRM abstract.",
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

const getAbstractGenerationPrompt = (
  text: string,
  mode: GenerationMode
): string => {
  const commonInstructions = `
    You are an expert academic assistant specializing in creating abstracts for the International Society for Magnetic Resonance in Medicine (ISMRM) conference.
    Your task is to generate a structured abstract containing three sections: Impact, Synopsis, and Keywords.
    Adhere strictly to ISMRM guidelines: the Impact should be a short, powerful summary, and the Synopsis a more detailed overview.
    The output must be in JSON format matching the provided schema.
  `;

  if (mode === "standard") {
    return `${commonInstructions}
      Analyze the following academic text and generate the abstract sections based on its content.
      
      Text:
      ---
      ${text}
      ---
    `;
  } else {
    // creative
    return `${commonInstructions}
      Take the following core idea and creatively expand it into a full, compelling ISMRM abstract. 
      Invent plausible details for methods, results, and conclusions that align with the initial concept.
      
      Core Idea: "${text}"
    `;
  }
};

export const generateAbstract = async (
  text: string,
  mode: GenerationMode
): Promise<AbstractData> => {
  const prompt = getAbstractGenerationPrompt(text, mode);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: abstractSchema,
      },
    });

    // Step 1: 获取可能的文本
    let rawText = response.text ?? '';
    if (!rawText) {
      // 尝试从候选 parts 中拼接
      const firstCandidate = response.candidates?.[0];
      const parts = firstCandidate?.content?.parts;
      if (parts && parts.length > 0) {
        rawText = parts
          .map((p: any) => (typeof p.text === "string" ? p.text : ""))
          .join("\n")
          .trim();
      }
    }

    if (!rawText || rawText.trim() === "") {
      throw new Error("Empty response: no text content returned by Gemini.");
    }

    const jsonString = rawText.trim();

    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch (parseErr: any) {
      console.error("[geminiService] JSON parse error:", parseErr, {
        raw: jsonString.slice(0, 500),
      });
      throw new Error(
        "Failed to parse JSON returned from Gemini. Check model output format."
      );
    }

    // Basic validation
    if (
      parsed &&
      typeof parsed.impact === "string" &&
      typeof parsed.synopsis === "string" &&
      Array.isArray(parsed.keywords)
    ) {
      return parsed as AbstractData;
    } else {
      console.error("[geminiService] Malformed JSON structure:", parsed);
      throw new Error("Received malformed JSON from API.");
    }
  } catch (error) {
    console.error("Error generating abstract:", error);
    throw new Error(
      "Failed to generate abstract. The model may be unavailable or the request failed."
    );
  }
};

export const generateImage = async (
  mode: GenerationMode,
  imageState: ImageState,
  creativeContext: string
): Promise<string> => {
  try {
    let response;

    if (mode === "standard" && imageState.base64 && imageState.file) {
      // 编辑原图
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
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
    } else {
      // 创造模式或缺少可编辑图 => 生成新图
      const prompt = `Generate a scientific or medical imaging figure based on this context: ${creativeContext}. Specifications: ${imageState.specs}. The image should be publication-quality.`;
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: { parts: [{ text: prompt }] },
        config: {
          responseModalities: [Modality.IMAGE],
        },
      });
    }

    const part = response.candidates?.[0]?.content?.parts?.[0];

    // 逐层安全检查
    const inlineData = part?.inlineData;
    const data = inlineData?.data;

    if (typeof data === "string" && data.trim() !== "") {
      return data;
    }

    console.error("[geminiService] No usable image data in response:", {
      part,
      inlineData,
    });
    throw new Error("No image data received from API.");
  } catch (error) {
    console.error("Error generating image:", error);
    throw new Error(
      "Failed to generate image. The model may be unavailable or the request failed."
    );
  }
};
