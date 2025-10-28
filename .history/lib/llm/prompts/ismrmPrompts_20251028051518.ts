import { AbstractType, Category } from '../../../types';

/**
 * ISMRM Prompt System with Guideline Router
 * 
 * This module implements the prompt generation system for ISMRM abstract workflow:
 * 1. Content Analysis - Extract categories and keywords
 * 2. Abstract Type Suggestion - Apply Occam's Razor classification
 * 3. Final Abstract Generation - Generate spec-compliant output
 * 4. Creative Abstract Generation - Generate from core idea
 */

// ============================================================================
// Guideline Loading Functions
// ============================================================================

/**
 * Load guideline files from the public directory
 * These files contain conference-specific formatting and content requirements
 */
export const loadGuidelineFile = async (filename: string): Promise<string> => {
  try {
    const response = await fetch(`/${filename}`);
    if (!response.ok) {
      console.warn(`Failed to load guidance file: ${filename}`);
      return '';
    }
    return await response.text();
  } catch (error) {
    console.warn(`Error loading guidance file: ${filename}`, error);
    return '';
  }
};

/**
 * Load all ISMRM guideline files
 */
export const loadISMRMGuidelines = async (): Promise<{
  globalGuidance: string;
  categoryGuidance: string;
  categoriesKeywords: string;
  standardAbstract: string;
  registeredAbstract: string;
  clinicalPractice: string;
  ismrt: string;
}> => {
  const [
    globalGuidance,
    categoryGuidance,
    categoriesKeywords,
    standardAbstract,
    registeredAbstract,
    clinicalPractice,
    ismrt
  ] = await Promise.all([
    loadGuidelineFile('call for abstracts global guidance.md'),
    loadGuidelineFile('abstract category guidance.md'),
    loadGuidelineFile('ismrm abstract categories & keywords.md'),
    loadGuidelineFile('standard abstract guidance.md'),
    loadGuidelineFile('registered abstract guidance.md'),
    loadGuidelineFile('mri in clinical practice abstract guidance.md'),
    loadGuidelineFile('ISMRT abstract.md')
  ]);

  return {
    globalGuidance,
    categoryGuidance,
    categoriesKeywords,
    standardAbstract,
    registeredAbstract,
    clinicalPractice,
    ismrt
  };
};

// ============================================================================
// Occam's Razor Classification Logic
// ============================================================================

/**
 * Routing rules based on categories (Occam's Razor principle)
 * These rules determine which abstract type is most appropriate based on content
 */
export const getRoutingRules = (): string => {
  return `
**Occam's Razor Classification Rules:**

Apply the simplest explanation that fits the evidence. Analyze the categories and content to determine abstract type probability:

**Rule 1: Clinical Practice Focus (≥30% threshold)**
IF categories include: Body, Neuro, Pediatrics, Cardiovascular, Interventional, MSK, or Preclinical
AND content discusses: patient care, clinical applications, diagnostic value, treatment outcomes
THEN:
  - "MRI in Clinical Practice Abstract": 70-85% probability
  - "Standard Abstract": 40-60% probability
  - "ISMRT Abstract": 30-50% probability (if technologist-focused)

**Rule 2: Registered Abstract (≥30% threshold)**
IF content explicitly mentions: hypothesis, study protocol, future work, prospective study
OR keywords include: hypothesis, protocol, prospective, planned
THEN:
  - "Registered Abstract": 85-95% probability
  - "Standard Abstract": 20-40% probability

**Rule 3: ISMRT Focus (≥30% threshold)**
IF categories include: Physics & Engineering, Acquisition & Reconstruction
AND content emphasizes: workflow, scanning protocols, technologist role, practical implementation
THEN:
  - "ISMRT Abstract": 65-80% probability
  - "Standard Abstract": 50-70% probability

**Rule 4: Standard Abstract (Default)**
IF categories include: Analysis Methods, Contrast Mechanisms, Diffusion, Brain Function
OR content focuses on: novel methods, technical development, quantitative analysis
THEN:
  - "Standard Abstract": 75-90% probability
  - "ISMRT Abstract": 30-50% probability (if applicable)

**Rule 5: Multiple Categories**
IF primary and secondary categories span different domains:
  - Calculate weighted probability based on category distribution
  - Favor the type with highest combined probability
  - Only include types with ≥30% probability in final output

**Probability Calculation:**
- Start with base probability from matching rules
- Adjust +10% if keywords strongly align with type
- Adjust +15% if multiple rules support the same type
- Adjust -20% if content contradicts type requirements
- Ensure all probabilities sum to ≤100% (types can overlap)
- Filter out any type with <30% probability
`;
};

// ============================================================================
// Prompt Generation Functions
// ============================================================================

/**
 * Step 1: Content Analysis Prompt
 * Extracts categories and keywords from the input text
 */
export const getAnalysisPrompt = async (text: string): Promise<string> => {
  const guidelines = await loadISMRMGuidelines();
  
  return `
You are an expert academic assistant specializing in ISMRM conference submissions.
Your task is to analyze the following academic text and extract relevant categories and keywords.

**Instructions:**
1. Read the text carefully and identify its core scientific focus
2. Identify the main category (highest relevance), sub-categories, and secondary categories
3. Assign probability scores (0.0 to 1.0) for each identified category
4. Extract 3-7 specific, relevant keywords that characterize the research
5. Return results in structured JSON format

**Category Selection Guidelines:**
${guidelines.categoryGuidance}

**Available Categories & Keywords:**
${guidelines.categoriesKeywords}

**Analysis Rules:**
- Main category: The primary scientific domain (probability 0.7-1.0)
- Sub category: Specific sub-field within main domain (probability 0.5-0.9)
- Secondary category: Additional relevant domains (probability 0.3-0.7)
- Keywords: Must be specific terms from the text, not generic descriptors
- Include imaging techniques, anatomy, pathology, and key concepts

**Academic Text for Analysis:**
---
${text}
---

Analyze the text and provide JSON output with:
{
  "categories": [
    {"name": "Category Name", "type": "main|sub|secondary", "probability": 0.0-1.0}
  ],
  "keywords": ["keyword1", "keyword2", ...]
}
`;
};

/**
 * Step 2: Abstract Type Suggestion Prompt
 * Applies Occam's Razor classification to suggest appropriate abstract types
 */
export const getAbstractTypeSuggestionPrompt = async (
  text: string,
  categories: Category[],
  keywords: string[]
): Promise<string> => {
  const categoryNames = categories.map(c => `${c.name} (${c.type}, ${(c.probability * 100).toFixed(0)}%)`).join(', ');
  const keywordList = keywords.join(', ');
  const routingRules = getRoutingRules();

  return `
You are an expert academic assistant applying Occam's Razor to classify research for ISMRM submission.
Based on the analyzed content, determine the most appropriate abstract type(s).

${routingRules}

**Content Classification:**
- **Text Preview:** ${text.substring(0, 600)}...
- **Identified Categories:** ${categoryNames}
- **Keywords:** ${keywordList}

**Your Task:**
1. Apply the routing rules above to the provided content
2. Calculate probability for each abstract type based on category matches
3. Consider keyword alignment and content focus
4. Only include types with probability ≥30%
5. Sort results by probability (highest first)

**Output Format:**
Return a JSON array of objects:
[
  {"type": "Abstract Type Name", "probability": 0.0-1.0}
]

Available types:
- "Standard Abstract"
- "MRI in Clinical Practice Abstract"
- "ISMRT Abstract"
- "Registered Abstract"

Analyze and provide the classification:
`;
};

/**
 * Step 3: Final Abstract Generation Prompt
 * Generates spec-compliant abstract based on selected type
 */
export const getFinalAbstractPrompt = async (
  text: string,
  type: AbstractType,
  categories: Category[],
  keywords: string[]
): Promise<string> => {
  const guidelines = await loadISMRMGuidelines();
  const categoryNames = categories.map(c => c.name).join(', ');
  const keywordList = keywords.join(', ');

  // Load type-specific guidance
  let typeGuidance = '';
  switch (type) {
    case 'Standard Abstract':
      typeGuidance = guidelines.standardAbstract;
      break;
    case 'Registered Abstract':
      typeGuidance = guidelines.registeredAbstract;
      break;
    case 'MRI in Clinical Practice Abstract':
      typeGuidance = guidelines.clinicalPractice;
      break;
    case 'ISMRT Abstract':
      typeGuidance = guidelines.ismrt;
      break;
  }

  return `
You are an expert academic writer generating a publication-ready abstract for ISMRM ${type}.

**Task:**
Generate a structured abstract with Impact (40 words), Synopsis (100 words), and Keywords.

**Context:**
- **Abstract Type:** ${type}
- **Categories:** ${categoryNames}
- **Keywords:** ${keywordList}

**Global Guidelines:**
${guidelines.globalGuidance}

**Type-Specific Requirements:**
${typeGuidance}

**Writing Style Requirements (CRITICAL):**
1. Use clear, direct language with specific subjects
2. Avoid AI phrases: "It is worth noting", "Based on the above", "It is not difficult to find"
3. Use active voice: "We found" not "Results indicated"
4. Vary sentence structure for natural rhythm
5. Be specific with data, methods, and results
6. No vague statements or generic claims

**Source Text:**
---
${text}
---

**Output Requirements:**
Generate JSON object:
{
  "impact": "40-word statement of significance and potential impact",
  "synopsis": "100-word summary covering motivation, goals, approach, and results",
  "keywords": ["keyword1", "keyword2", ...]
}

The output must be publication-ready and adhere to all word limits and formatting requirements.
`;
};

/**
 * Step 4: Creative Abstract Generation Prompt
 * Generates abstract from a core idea (creative mode)
 */
export const getCreativeAbstractPrompt = async (coreIdea: string): Promise<string> => {
  const guidelines = await loadISMRMGuidelines();

  return `
You are an expert academic writer creatively expanding a core idea into a publication-ready ISMRM abstract.

**Core Idea:** "${coreIdea}"

**Task:**
1. Expand the core idea into a complete research narrative
2. Invent plausible, scientifically sound details (methods, results, statistics)
3. Generate Impact (40 words), Synopsis (100 words), and Keywords (3-7)
4. Ensure all details are realistic for MR research

**Global Guidelines:**
${guidelines.globalGuidance}

**Writing Style Requirements (CRITICAL):**
1. Clear, direct language - no AI clichés
2. Specific, concrete details (sample sizes, statistical values, MRI parameters)
3. Active voice and varied sentence structure
4. Natural, human-like expression
5. Avoid: "It is worth noting", "Based on the above analysis", "This study demonstrates"

**Plausibility Guidelines:**
- Sample sizes: 10-200 subjects (depending on study type)
- Statistical significance: p < 0.05, effect sizes, confidence intervals
- MRI parameters: Realistic field strengths (1.5T, 3T, 7T), sequences, timing
- Results: Specific percentages, measurements with units

**Output Format:**
{
  "impact": "40-word impact statement",
  "synopsis": "100-word synopsis",
  "keywords": ["keyword1", "keyword2", "keyword3", ...]
}

Generate the complete abstract based on the core idea:
`;
};
