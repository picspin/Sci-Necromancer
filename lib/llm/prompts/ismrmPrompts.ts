import { Category, AbstractType, AbstractTypeSuggestion, Conference } from '../../../types';
import { getCreativeECRAbstractPrompt, getECRAbstractByTypePrompt } from './ecrPrompts';
import {
  abstractCategoryGuidance,
  callForAbstractsGuidance,
  categoryAndKeywordsList,
  getISMRMTypeGuidance,
  ISMRM_2027_RULES,
} from './ismrmData';

/**
 * ISMRM Prompt System and Guideline Router
 *
 * This module implements:
 * - Analysis and classification prompts for ISMRM abstracts
 * - Embedded annual ISMRM guidance and fallback public guideline loading
 * - Occam's Razor classification logic (simplest explanation preferred)
 * - Type suggestions based on study and author eligibility, not organ names
 * - Probability calculation with ≥30% threshold
 */

// ============================================================================
// GUIDELINE FILE LOADING
// ============================================================================

/**
 * Load guideline files from public/ directory
 */
export const loadGuidelineFile = async (filename: string): Promise<string> => {
  const embedded: Record<string, string> = {
    'ismrm abstract categories & keywords.md': categoryAndKeywordsList,
    'abstract category guidance.md': abstractCategoryGuidance,
    'call for abstracts global guidance.md': callForAbstractsGuidance,
    'impact & synopsis sections.md': callForAbstractsGuidance,
    'standard abstract guidance.md': getISMRMTypeGuidance('Standard Abstract'),
    'mri in clinical practice abstract guidance.md': getISMRMTypeGuidance(
      'MRI in Clinical Practice Abstract'
    ),
    'md-phd tandem abstract guidance.md': getISMRMTypeGuidance('MD-PhD Tandem Abstract'),
    'ISMRT abstract.md': getISMRMTypeGuidance('ISMRT Abstract'),
  };
  if (embedded[filename]) return embedded[filename];
  // In test environments, avoid fetch consumption to keep mocks for API calls
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    return '';
  }
  try {
    const response: any = await fetch(`/${filename}`);
    if (!response || typeof response.ok !== 'boolean' || !response.ok) {
      return '';
    }
    if (typeof response.text !== 'function') {
      return '';
    }
    return await response.text();
  } catch (error) {
    console.warn(`Failed to load guideline file: ${filename}`, error);
    return '';
  }
};

/**
 * Load multiple guideline files concurrently
 */
export const loadGuidelineFiles = async (filenames: string[]): Promise<Record<string, string>> => {
  const results = await Promise.all(
    filenames.map(async (filename) => ({
      filename,
      content: await loadGuidelineFile(filename),
    }))
  );

  return results.reduce(
    (acc, { filename, content }) => {
      acc[filename] = content;
      return acc;
    },
    {} as Record<string, string>
  );
};

// ============================================================================
// CATEGORY ANALYSIS PROMPT
// ============================================================================

/**
 * Generate prompt for analyzing text and identifying ISMRM categories
 * Implements Occam's Razor: prefer simpler, more direct classifications
 */
export const getCategoryAnalysisPrompt = async (text: string): Promise<string> => {
  const categoriesContent = await loadGuidelineFile('ismrm abstract categories & keywords.md');
  const categoryGuidance = await loadGuidelineFile('abstract category guidance.md');

  return `
You are an expert in ISMRM conference abstract classification. Your task is to analyze the provided research text and identify the most relevant categories and keywords.

**Classification Principles (Occam's Razor):**
- Prefer the simplest, most direct classification
- Choose the most specific category that fully encompasses the work
- Avoid over-complicating with too many secondary categories
- If work clearly fits one primary area, don't force additional categories

**Analysis Task:**
1. Read the text carefully to understand the core research focus
2. Identify the PRIMARY category and subcategory (the main focus)
3. Suggest a SECONDARY category/subcategory for author confirmation; it may share the primary category but must have a different subcategory
4. Include one General keyword and at most 5 total relevant keywords, from the list or custom source terms
5. Assign probability scores (0.0 to 1.0) for each category

**Probability Guidelines:**
- Primary category: typically 0.6-0.9 (high confidence)
- Secondary category: typically 0.3-0.6 (moderate relevance)
- Only include categories with probability ≥ 0.30 (30% threshold)
- Probabilities should reflect genuine relevance, not forced inclusion

**Category Reference:**
---
${categoriesContent}
---

**Selection Guidance:**
---
${categoryGuidance}
---

**Research Text to Analyze:**
---
${text}
---

**Output Format:**
Return a JSON object with:
{
  "categories": [
    {
      "name": "Category: Subcategory",
      "type": "main" | "sub" | "secondary",
      "probability": 0.0-1.0
    }
  ],
  "keywords": ["keyword1", "keyword2", ...]
}

**Important:**
- Only include categories with probability ≥ 0.30
- Be conservative: fewer, more accurate categories are better than many weak ones
- Keywords should be specific terms from the text, not generic descriptions
`;
};

// ============================================================================
// ABSTRACT TYPE ROUTING
// ============================================================================

/** Categories alone cannot establish clinical, Tandem or ISMRT eligibility. */
export const routeAbstractType = (_categories: Category[]): AbstractTypeSuggestion[] => [];

/**
 * Type eligibility requires source evidence, not category labels alone.
 */
export const getAbstractTypeRoutingPrompt = async (
  text: string,
  categories: Category[]
): Promise<string> => {
  const categoryNames = categories.map((c) => c.name).join(', ');

  return `
You are an expert in ISMRM abstract classification. Based on the research text and identified categories, determine the most appropriate abstract type(s).

**Identified Categories:** ${categoryNames}

**Abstract Type Definitions:**

1. **Standard Abstract**: Traditional research with completed results
   - Has Introduction, Methods, Results, Discussion, Conclusion
   - Reports completed work with data and findings
   - 750 words maximum

2. **MD-PhD Tandem Abstract**: Clinical/technical collaboration
   - Requires two joint first authors/presenters: a clinical expert and a technical expert
   - Only recommend if author-role evidence is provided; author verifies eligibility
   - Standard research body and Synopsis format; 750 words maximum

3. **MRI in Clinical Practice Abstract**: Clinical case or application
   - Demonstrates added value of MRI in patient care
   - Focuses on diagnosis, management, or treatment impact
   - Clinical Presentation and Assessment, Diagnosis and Treatment, Significance, at least 3 Key Points
   - Unstructured 100-word clinical Synopsis
   - 750 words maximum

4. **ISMRT Abstract**: For MR Technologists/Radiographers
   - Emphasizes practical application and workflow
   - Written for technologist audience
   - Separate ISMRT route; requires practicing technologist/radiographer eligibility and CV
   - Can be clinical practice or research focused; 750 words maximum

**Routing Rules:**
- Choose by study content and author eligibility, not by organ/category alone
- Standard research can belong to Body, Neuro or another clinical category
- Clinical Practice requires a de-identified case narrative or case series showing MRI care impact
- Interventional content alone does not establish ISMRT eligibility
- Registered Abstract is not a verified 2027 route; do not recommend it
- An idea without results is an incomplete draft, never a reason to invent findings

**Research Text:**
---
${text}
---

**Task:**
Analyze the text for:
1. Study maturity and supplied author-role evidence
2. Presence of actual results/data; identify missing information without inventing it
3. Clinical vs. technical focus
4. Target audience (researchers vs. technologists)

Return JSON:
{
  "suggestions": [
    {
      "type": "Abstract Type Name",
      "probability": 0.0-1.0,
      "reasoning": "Brief explanation"
    }
  ]
}

Only include types with probability ≥ 0.30. Sort by probability (highest first).
`;
};

// ============================================================================
// CLASSIFICATION WITH OCCAM'S RAZOR
// ============================================================================

/**
 * Apply Occam's Razor principle to category classification
 * Simplifies results by removing redundant or low-confidence categories
 */
export const applyOccamsRazor = (categories: Category[]): Category[] => {
  // Filter by threshold
  const filtered = categories.filter((c) => c.probability >= 0.3);

  // Sort by probability
  const sorted = filtered.sort((a, b) => b.probability - a.probability);

  // Apply simplification rules
  const simplified: Category[] = [];

  // Always keep the highest probability category
  if (sorted.length > 0) {
    simplified.push(sorted[0]);
  }

  // Add secondary categories only if they add meaningful information
  for (let i = 1; i < sorted.length; i++) {
    const category = sorted[i];

    // Skip if too similar to existing categories
    const isSimilar = simplified.some((existing) => {
      return existing.name.trim().toLowerCase() === category.name.trim().toLowerCase();
    });

    if (!isSimilar && category.probability >= 0.4) {
      simplified.push(category);
    }

    // Limit to 2-3 categories maximum (Occam's Razor)
    if (simplified.length >= 3) break;
  }

  return simplified;
};

/**
 * Calculate confidence score for classification
 * Higher score = more confident in the classification
 */
export const calculateClassificationConfidence = (categories: Category[]): number => {
  if (categories.length === 0) return 0;

  const mainCategory = categories.find((c) => c.type === 'main');
  if (!mainCategory) return 0;

  // High confidence if:
  // - Main category has high probability (>0.7)
  // - Clear separation between main and secondary (>0.2 difference)
  const mainProb = mainCategory.probability;
  const secondaryProb = categories.find((c) => c.type === 'secondary')?.probability || 0;
  const separation = mainProb - secondaryProb;

  let confidence = mainProb;

  // Bonus for clear separation
  if (separation > 0.2) {
    confidence = Math.min(confidence + 0.1, 1.0);
  }

  // Penalty for too many categories (violates Occam's Razor)
  if (categories.length > 3) {
    confidence *= 0.9;
  }

  return confidence;
};

// ============================================================================
// EXPORT
// ============================================================================

export default {
  loadGuidelineFile,
  loadGuidelineFiles,
  getCategoryAnalysisPrompt,
  routeAbstractType,
  getAbstractTypeRoutingPrompt,
  applyOccamsRazor,
  calculateClassificationConfidence,
};

// ============================================================================
// ALIAS EXPORTS FOR COMPATIBILITY
// ============================================================================

/**
 * Alias for getCategoryAnalysisPrompt - used by gemini.ts
 */
export const getAnalysisPrompt = getCategoryAnalysisPrompt;

/**
 * Generate prompt for abstract type suggestion
 * Alias that combines routing logic with text analysis
 */
export const getAbstractTypeSuggestionPrompt = async (
  text: string,
  categories: Category[],
  _keywords: string[]
): Promise<string> => {
  return getAbstractTypeRoutingPrompt(text, categories);
};

/**
 * Generate prompt for Impact & Synopsis (Step 2)
 */
export const getImpactSynopsisPrompt = async (
  text: string,
  categories: Category[],
  keywords: string[]
): Promise<string> => {
  const categoryNames = categories.map((c) => c.name).join(', ');
  const keywordList = keywords.join(', ');
  const impactGuidance = await loadGuidelineFile('impact & synopsis sections.md');

  return `
You are an expert academic writer specializing in ISMRM conference submissions.

**Task:** Generate an Impact statement and Synopsis from the provided research text.

**Context:**
- **Categories:** ${categoryNames}
- **Keywords:** ${keywordList}

**Impact & Synopsis Guidance:**
---
${impactGuidance}
---

**Requirements:**
${callForAbstractsGuidance}
1. **Impact** (40 words max): A compelling statement about the significance and potential impact of this research.
   - Answer: "What will be different because of this research? Who will care and why?"
   - Be specific and concrete, not vague

2. **Synopsis** (100 words max): A concise summary covering:
   - Motivation: Why was this work needed?
   - Goal(s): What did you aim to achieve?
   - Approach: How did you do it?
   - Results: What did you find?

**Source Text:**
---
${text}
---

**Output Format:**
Return a JSON object with:
{
  "impact": "40-word impact statement",
  "synopsis": "100-word synopsis"
}

Be specific, concrete, and highlight the novelty and significance of the work.
`;
};

/**
 * Generate prompt for final abstract generation
 * This integrates with the existing abstractSpecPrompts system
 */
export const getFinalAbstractPrompt = async (
  text: string,
  type: AbstractType,
  categories: Category[],
  keywords: string[],
  impact: string,
  synopsis: string
): Promise<string> => {
  if (type.startsWith('ECR ')) {
    return getECRAbstractByTypePrompt(text, impact, synopsis, type, categories, keywords);
  }
  const categoryNames = categories.map((c) => c.name).join(', ');
  const keywordList = keywords.join(', ');

  const guidance =
    ISMRM_2027_RULES.abstractTypes.includes(type) || type === 'Registered Abstract'
      ? getISMRMTypeGuidance(type)
      : '';
  const globalGuidance = await loadGuidelineFile('call for abstracts global guidance.md');

  return `
You are an expert academic writer specializing in ISMRM conference submissions.

**Task:** Generate a complete, publication-ready abstract body for the ISMRM conference.

**Abstract Type:** ${type}

**Context:**
- **Categories:** ${categoryNames}
- **Keywords:** ${keywordList}
- **Impact (already generated):** ${impact}
- **Synopsis (already generated):** ${synopsis}

**Type-Specific Guidance:**
---
${guidance}
---

**Global ISMRM Guidance:**
---
${globalGuidance}
---

**Source Text:**
---
${text}
---

**Requirements:**
1. Generate the complete abstract body following the structure for ${type}
2. Use the provided Impact and Synopsis as context
3. Follow the type-specific structure above; revise Impact/Synopsis to its format and limits, even if earlier drafts differ
4. Follow word limits and formatting requirements

**Output Format:**
Return a JSON object with:
{
  "abstract": "Complete abstract body with sections",
  "impact": "Source-grounded statement, at most 40 words",
  "synopsis": "At most 100 words, in the selected type-specific format",
  "keywords": ["${keywords.join('", "')}"]
}

Ensure the abstract is:
- Specific and concrete, not vague
- Follows ISMRM formatting requirements
- Uses clear, professional academic language
- Highlights the significance and novelty of the work
`;
};

/**
 * Generate prompt for creative abstract generation from a core idea
 */
export const getCreativeAbstractPrompt = async (
  coreIdea: string,
  conference?: Conference
): Promise<string> => {
  if (conference === 'ER') {
    return getCreativeECRAbstractPrompt(coreIdea);
  }
  const globalGuidance = await loadGuidelineFile('call for abstracts global guidance.md');
  const impactGuidance = await loadGuidelineFile('impact & synopsis sections.md');

  return `
You are an expert academic writer tasked with creatively expanding a core research idea into a complete ISMRM abstract.

**Core Idea:** "${coreIdea}"

**Global ISMRM Guidance:**
---
${globalGuidance}
---

**Impact & Synopsis Guidance:**
---
${impactGuidance}
---

**Task:**
1. Expand the core idea into a clearly labelled planning draft, not a submission-ready completed study
2. Do not fabricate research methods, participants, results, statistics, references or ethics approval; use [author to verify] for unknowns
3. Generate Impact (40 words max), Synopsis (100 words max), and Keywords (1-5)
4. Ensure the abstract follows ISMRM standards

**Output Format:**
Return a JSON object with:
{
  "impact": "40-word impact statement",
  "synopsis": "100-word synopsis covering Motivation, Goal(s), Approach, Results",
  "keywords": ["keyword1", "keyword2", ...]
}

Keep proposed work distinct from observed findings. The author must supply and verify missing information before submission.
`;
};
