
import { AbstractType, Category } from '../../types';
import * as data from './ismrmData';

export const getAnalysisPrompt = (text: string): string => {
  return `
    You are an expert academic assistant specializing in ISMRM conference submissions.
    Your task is to analyze the following academic text based on ISMRM guidelines.
    
    **Instructions:**
    1.  Read the text carefully.
    2.  Identify the main, sub, and secondary scientific categories relevant to the text. Refer to the category list for examples.
    3.  Assign a probability score (0.0 to 1.0) for each identified category, reflecting its relevance.
    4.  Extract 3-7 of the most important keywords from the text.
    5.  Return your findings in a structured JSON format that adheres to the provided schema.

    **Reference: Category & Keyword List**
    ---
    ${data.categoryAndKeywordsList}
    ---
    
    **Reference: Analysis Guidance**
    ---
    ${data.abstractCategoryGuidance}
    ---

    **Academic Text for Analysis:**
    ---
    ${text}
    ---

    Now, perform the analysis and provide the JSON output.
  `;
};

export const getAbstractTypeSuggestionPrompt = (text: string, categories: Category[], keywords: string[]): string => {
  const categoryNames = categories.map(c => c.name).join(', ');
  const keywordList = keywords.join(', ');

  return `
    You are an expert academic assistant applying Occam's Razor to classify research for an ISMRM submission.
    Based on the provided text and its identified categories/keywords, determine the most appropriate abstract type(s).
    
    **Classification Rules (Simplified):**
    -   If categories heavily feature 'Body', 'Neuro', 'Pediatrics', 'Cardiovascular', 'Interventional', 'MSK', or 'Preclinical', there is a high probability (>75%) for 'MRI in Clinical Practice Abstract' and a moderate probability (>25%) for 'Standard Abstract'.
    -   If the content explicitly mentions a 'hypothesis', 'mimicking', or 'simulation', there is a very high probability (>90%) for 'Registered Abstract'.
    -   For most other technical or methods-focused research (e.g., 'Data Analysis', 'Engineering'), 'Standard Abstract' is the most likely (>75%), with 'ISMRT Abstract' being a possibility (>50%) if it involves technologist-focused work.
    
    **Instructions:**
    -   Analyze the inputs below.
    -   Output a JSON array of objects, where each object contains the abstract 'type' and a 'probability' score.
    -   Only include types with a probability of 30% or higher.
    
    **Content for Classification:**
    ---
    **Text Snippet:** ${text.substring(0, 500)}...
    **Selected Categories:** ${categoryNames}
    **Selected Keywords:** ${keywordList}
    ---
    
    Provide only the JSON array that adheres to the schema.
  `;
};

export const getFinalAbstractPrompt = (text: string, type: AbstractType, categories: Category[], keywords: string[]): string => {
  return `
    You are an expert academic writer tasked with generating a publication-ready abstract for the ISMRM conference.
    
    **Task:**
    Generate a structured abstract containing three sections: 'impact', 'synopsis', and 'keywords'.
    
    **Context:**
    -   **Abstract Type:** ${type}
    -   **Confirmed Categories:** ${categories.map(c => c.name).join(', ')}
    -   **Confirmed Keywords:** ${keywords.join(', ')}
    
    **Guidelines & Constraints:**
    1.  **Overall Guidance:** Strictly adhere to the 'ISMRM Global Guidance for Abstract Submission'.
    2.  **Writing Style:** You MUST follow the 'Humanization Guidelines' precisely to ensure the output sounds natural, clear, and is free of any AI-like phrasing. This is critical.
    3.  **Output Format:** The final output must be a single JSON object matching the provided schema. Do not include any explanatory text outside the JSON.
    
    **Reference 1: ISMRM Global Guidance**
    ---
    ${data.callForAbstractsGuidance}
    ---
    
    **Reference 2: Humanization Guidelines (CRITICAL)**
    ---
    ${data.humanizationGuidelines}
    ---
    
    **Source Text:**
    ---
    ${text}
    ---
    
    Now, generate the complete, structured abstract as a JSON object.
  `;
};

export const getCreativeAbstractPrompt = (coreIdea: string): string => {
  return `
    You are an expert academic writer tasked with creatively expanding a core idea into a full, publication-ready abstract for the ISMRM conference.

    **Task:**
    Take the following core idea and generate a complete, structured abstract containing 'impact', 'synopsis', and 'keywords'. You must invent plausible, scientifically sound details for the methods, results, and conclusions that align with the initial concept.

    **Core Idea:** "${coreIdea}"

    **Guidelines & Constraints:**
    1.  **Overall Guidance:** The generated abstract must strictly adhere to the 'ISMRM Global Guidance for Abstract Submission'.
    2.  **Writing Style:** You MUST follow the 'Humanization Guidelines' precisely. The output must be indistinguishable from that of a human expert—clear, direct, and free of AI clichés. This is the highest priority.
    3.  **Plausibility:** The invented details (e.g., sample sizes, statistical results, specific MRI parameters) should be realistic for a typical MR research study.
    4.  **Keywords:** Generate 3-5 relevant keywords that fit the expanded abstract.
    5.  **Output Format:** The final output must be a single JSON object matching the provided schema. Do not include any explanatory text outside the JSON.

    **Reference 1: ISMRM Global Guidance**
    ---
    ${data.callForAbstractsGuidance}
    ---

    **Reference 2: Humanization Guidelines (CRITICAL)**
    ---
    ${data.humanizationGuidelines}
    ---

    Now, based on the core idea, generate the complete, structured abstract as a JSON object.
  `;
};
