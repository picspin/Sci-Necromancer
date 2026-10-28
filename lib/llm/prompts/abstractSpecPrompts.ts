import { AbstractType, Category, WritingStyleConfig } from '../../../types';
import { generateWritingStylePrompt, DEFAULT_WRITING_STYLE } from '../writingStyleEnhancer';
import { callForAbstractsGuidance, getISMRMTypeGuidance } from './ismrmData';

// Generate Impact & Synopsis from original text
export const getImpactSynopsisPrompt = (
  text: string,
  categories: Category[],
  keywords: string[],
  writingStyle: WritingStyleConfig = DEFAULT_WRITING_STYLE
): string => {
  const categoryNames = categories.map((c) => c.name).join(', ');
  const keywordList = keywords.join(', ');

  return `
    You are an expert academic writer specializing in ISMRM conference submissions.
    Your task is to generate an Impact statement and Synopsis from the provided research text.
    
    **Task:**
    Generate two sections:
    1. **Impact** (40 words max): A compelling statement about the significance and potential impact of this research.
    2. **Synopsis** (100 words max): A concise summary covering the motivation, goals, approach, and key results.
    
    **Context:**
    -   **Identified Categories:** ${categoryNames}
    -   **Identified Keywords:** ${keywordList}
    
    **Guidelines:**
    -   The Impact statement should answer: "What will be different because of this research? Who will care and why?"
    -   The initial Synopsis uses Motivation, Goals, Approach, Results; final Clinical Practice generation rewrites it as unstructured prose
    ${callForAbstractsGuidance}
    -   Be specific and concrete, not vague or generic
    
    ${generateWritingStylePrompt(writingStyle)}
    
    **Source Text:**
    ---
    ${text}
    ---
    
    Return a JSON object with two fields: "impact" (string) and "synopsis" (string).
  `;
};

// Generate full abstract based on selected type
export const getAbstractByTypePrompt = async (
  text: string,
  impact: string,
  synopsis: string,
  type: AbstractType,
  categories: Category[],
  keywords: string[],
  writingStyle: WritingStyleConfig = DEFAULT_WRITING_STYLE
): Promise<string> => {
  const categoryNames = categories.map((c) => c.name).join(', ');
  const keywordList = keywords.join(', ');

  const guidanceContent = callForAbstractsGuidance;
  const specificInstructions = getISMRMTypeGuidance(type);

  return `
    You are an expert academic writer tasked with generating a publication-ready abstract for the ISMRM conference.
    
    **Context:**
    -   **Abstract Type:** ${type}
    -   **Categories:** ${categoryNames}
    -   **Keywords:** ${keywordList}
    -   **Impact Statement (already generated):** ${impact}
    -   **Synopsis (already generated):** ${synopsis}
    
    ${specificInstructions}
    
    **Reference: Type-Specific Guidance**
    ---
    ${guidanceContent}
    ---
    
    ${generateWritingStylePrompt(writingStyle)}
    
    **Source Text:**
    ---
    ${text}
    ---
    
    **Task:**
    Generate the complete abstract body following the structure for ${type}.
    Return a JSON object with:
    - "abstract": the full abstract text with proper sections
    - "impact": a source-grounded impact statement of <=40 words
    - "synopsis": revise the provided synopsis to the selected type-specific format and <=100 words
    - "keywords": array of 1-5 source-relevant keywords
    
    The abstract should be publication-ready and adhere strictly to the word limits and formatting requirements.
  `;
};

// Creative mode: Generate everything from a core idea
export const getCreativeAbstractByTypePrompt = async (
  coreIdea: string,
  type: AbstractType,
  writingStyle: WritingStyleConfig = DEFAULT_WRITING_STYLE
): Promise<string> => {
  const guidanceContent = callForAbstractsGuidance;
  const specificInstructions = getISMRMTypeGuidance(type);

  return `
    You are an expert academic writer tasked with expanding a core idea into a clearly labelled research planning draft, not a submission-ready completed study.
    
    **Core Idea:** "${coreIdea}"
    
    **Abstract Type:** ${type}
    
    ${specificInstructions}
    
    **Reference: Type-Specific Guidance**
    ---
    ${guidanceContent}
    ---
    
    **Task:**
    1. Expand the core idea into a clearly labelled planning draft, not a submission-ready completed study
    2. Do not fabricate research methods, participants, results, statistics, references or ethics approval; mark unknowns [author to verify]
    3. Generate Impact (40 words), Synopsis (100 words), and Keywords (1-5)
    4. Follow the structure and requirements for ${type}
    
    ${generateWritingStylePrompt(writingStyle)}
    
    Return a JSON object with:
    - "abstract": full abstract text
    - "impact": 40-word impact statement
    - "synopsis": 100-word synopsis
    - "keywords": array of 1-5 keywords
  `;
};
