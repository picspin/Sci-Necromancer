import { Category, AbstractTypeSuggestion } from '../../../types';

/**
 * ISMRM Prompt System and Guideline Router
 * 
 * This module implements:
 * - Analysis and classification prompts for ISMRM abstracts
 * - Guideline file loading from public/ directory
 * - Occam's Razor classification logic (simplest explanation preferred)
 * - Routing rules based on categories (body/neuro → Clinical Practice, etc.)
 * - Probability calculation with ≥30% threshold
 */

// ============================================================================
// GUIDELINE FILE LOADING
// ============================================================================

/**
 * Load guideline files from public/ directory
 */
export const loadGuidelineFile = async (filename: string): Promise<string> => {
  try {
    const response = await fetch(`/${filename}`);
    if (!response.ok) {
      throw new Error(`Failed to load ${filename}: ${response.statusText}`);
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
      content: await loadGuidelineFile(filename)
    }))
  );
  
  return results.reduce((acc, { filename, content }) => {
    acc[filename] = content;
    return acc;
  }, {} as Record<string, string>);
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
3. Identify a SECONDARY category and subcategory (if genuinely relevant)
4. Extract 3-7 specific keywords from the text
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

/**
 * Routing rules based on category analysis
 * Implements intelligent routing to suggest appropriate abstract types
 */
export const routeAbstractType = (categories: Category[]): AbstractTypeSuggestion[] => {
  const suggestions: AbstractTypeSuggestion[] = [];
  
  // Extract category names for analysis
  const categoryNames = categories.map(c => c.name.toLowerCase());
  const mainCategory = categories.find(c => c.type === 'main');
  
  // Rule 1: Body or Neuro categories → Clinical Practice Abstract
  const clinicalCategories = ['body', 'neuro', 'cardiovascular', 'musculoskeletal'];
  const hasClinicalFocus = categoryNames.some(name => 
    clinicalCategories.some(clinical => name.includes(clinical))
  );
  
  if (hasClinicalFocus) {
    const clinicalProb = mainCategory ? mainCategory.probability * 0.7 : 0.5;
    suggestions.push({
      type: 'MRI in Clinical Practice Abstract',
      probability: Math.min(clinicalProb, 0.85)
    });
  }
  
  // Rule 2: Methods/Technical focus → Standard Abstract
  const technicalCategories = [
    'acquisition & reconstruction',
    'analysis methods',
    'contrast mechanisms',
    'diffusion',
    'physics & engineering'
  ];
  const hasTechnicalFocus = categoryNames.some(name =>
    technicalCategories.some(tech => name.includes(tech))
  );
  
  if (hasTechnicalFocus) {
    const techProb = mainCategory ? mainCategory.probability * 0.8 : 0.6;
    suggestions.push({
      type: 'Standard Abstract',
      probability: Math.min(techProb, 0.9)
    });
  }
  
  // Rule 3: Interventional → ISMRT Abstract (technologist focus)
  const hasInterventional = categoryNames.some(name => name.includes('interventional'));
  if (hasInterventional) {
    suggestions.push({
      type: 'ISMRT Abstract',
      probability: 0.6
    });
  }
  
  // Rule 4: Future work indicators → Registered Abstract
  // This would need text analysis, so we provide a lower baseline probability
  suggestions.push({
    type: 'Registered Abstract',
    probability: 0.3
  });
  
  // Default: Standard Abstract if no specific routing matched
  if (suggestions.length === 0) {
    suggestions.push({
      type: 'Standard Abstract',
      probability: 0.7
    });
  }
  
  // Filter by threshold (≥30%) and sort by probability
  return suggestions
    .filter(s => s.probability >= 0.30)
    .sort((a, b) => b.probability - a.probability);
};

/**
 * Enhanced routing with text analysis for better Registered Abstract detection
 */
export const getAbstractTypeRoutingPrompt = async (
  text: string,
  categories: Category[]
): Promise<string> => {
  const categoryNames = categories.map(c => c.name).join(', ');
  
  return `
You are an expert in ISMRM abstract classification. Based on the research text and identified categories, determine the most appropriate abstract type(s).

**Identified Categories:** ${categoryNames}

**Abstract Type Definitions:**

1. **Standard Abstract**: Traditional research with completed results
   - Has Introduction, Methods, Results, Discussion, Conclusion
   - Reports completed work with data and findings
   - 750 words maximum

2. **Registered Abstract**: Prospective study not yet completed
   - States a clear, testable hypothesis
   - Describes methods in future tense
   - Work not yet completed but feasible by meeting date
   - 500 words maximum

3. **MRI in Clinical Practice Abstract**: Clinical case or application
   - Demonstrates added value of MRI in patient care
   - Focuses on diagnosis, management, or treatment impact
   - Includes clinical background and teaching points
   - 750 words maximum

4. **ISMRT Abstract**: For MR Technologists/Radiographers
   - Emphasizes practical application and workflow
   - Written for technologist audience
   - Can be clinical practice or research focused

**Routing Rules:**
- Body/Neuro/Cardiovascular/MSK categories → likely Clinical Practice
- Acquisition/Analysis/Physics categories → likely Standard
- Interventional category → consider ISMRT
- Future tense, hypothesis statements → Registered

**Research Text:**
---
${text}
---

**Task:**
Analyze the text for:
1. Tense (past = completed, future = prospective)
2. Presence of results/data (yes = Standard/Clinical, no = Registered)
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
  const filtered = categories.filter(c => c.probability >= 0.30);
  
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
    const isSimilar = simplified.some(existing => {
      const existingBase = existing.name.split(':')[0].trim();
      const categoryBase = category.name.split(':')[0].trim();
      return existingBase === categoryBase;
    });
    
    if (!isSimilar && category.probability >= 0.40) {
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
  
  const mainCategory = categories.find(c => c.type === 'main');
  if (!mainCategory) return 0;
  
  // High confidence if:
  // - Main category has high probability (>0.7)
  // - Clear separation between main and secondary (>0.2 difference)
  const mainProb = mainCategory.probability;
  const secondaryProb = categories.find(c => c.type === 'secondary')?.probability || 0;
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
  calculateClassificationConfidence
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
  keywords: string[]
): Promise<string> => {
  return getAbstractTypeRoutingPrompt(text, categories);
};

/**
 * Generate prompt for final abstract generation
 * This integrates with the existing abstractSpecPrompts system
 */
export const getFinalAbstractPrompt = async (
  text: string,
  type: string,
  categories: Category[],
  keywords: string[]
): Promise<string> => {
  const categoryNames = categories.map(c => c.name).join(', ');
  const keywordList = keywords.join(', ');
  
  // Load type-specific guidance
  let guidanceFile = '';
  switch (type) {
    case 'Standard Abstract':
      guidanceFile = 'standard abstract guidance.md';
      break;
    case 'Registered Abstract':
      guidanceFile = 'registered abstract guidance.md';
      break;
    case 'MRI in Clinical Practice Abstract':
      guidanceFile = 'mri in clinical practice abstract guidance.md';
      break;
    case 'ISMRT Abstract':
      guidanceFile = 'ISMRT abstract.md';
      break;
  }
  
  const guidance = guidanceFile ? await loadGuidelineFile(guidanceFile) : '';
  const globalGuidance = await loadGuidelineFile('call for abstracts global guidance.md');
  
  return `
You are an expert academic writer specializing in ISMRM conference submissions.

**Task:** Generate a complete, publication-ready abstract for the ISMRM conference.

**Abstract Type:** ${type}

**Context:**
- **Categories:** ${categoryNames}
- **Keywords:** ${keywordList}

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
1. Generate an Impact statement (40 words max)
2. Generate a Synopsis (100 words max) with: Motivation, Goal(s), Approach, Results
3. Confirm the keywords list: ${keywordList}

**Output Format:**
Return a JSON object with:
{
  "impact": "40-word impact statement",
  "synopsis": "100-word synopsis",
  "keywords": ["keyword1", "keyword2", ...]
}

Ensure the content is:
- Specific and concrete, not vague
- Follows ISMRM formatting requirements
- Uses clear, professional academic language
- Highlights the significance and novelty of the work
`;
};

/**
 * Generate prompt for creative abstract generation from a core idea
 */
export const getCreativeAbstractPrompt = async (coreIdea: string): Promise<string> => {
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
1. Expand the core idea into a plausible research study
2. Invent scientifically sound details (methods, results, etc.)
3. Generate Impact (40 words), Synopsis (100 words), and Keywords (3-7)
4. Ensure the abstract follows ISMRM standards

**Output Format:**
Return a JSON object with:
{
  "impact": "40-word impact statement",
  "synopsis": "100-word synopsis covering Motivation, Goal(s), Approach, Results",
  "keywords": ["keyword1", "keyword2", ...]
}

Be creative but scientifically plausible. The abstract should be publication-ready.
`;
};
