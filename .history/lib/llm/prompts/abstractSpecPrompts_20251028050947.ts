import { AbstractType, Category, WritingStyleConfig } from '../../../types';
import { generateWritingStylePrompt, DEFAULT_WRITING_STYLE } from '../writingStyleEnhancer';

// Load guidance files content
const loadGuidanceFile = async (filename: string): Promise<string> => {
  try {
    const response = await fetch(`/${filename}`);
    return await response.text();
  } catch (error) {
    console.warn(`Failed to load guidance file: ${filename}`, error);
    return '';
  }
};

// Generate Impact & Synopsis from original text
export const getImpactSynopsisPrompt = (
  text: string, 
  categories: Category[], 
  keywords: string[],
  writingStyle: WritingStyleConfig = DEFAULT_WRITING_STYLE
): string => {
  const categoryNames = categories.map(c => c.name).join(', ');
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
    -   The Synopsis should include: Motivation, Goal(s), Approach, and Results
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
  const categoryNames = categories.map(c => c.name).join(', ');
  const keywordList = keywords.join(', ');

  let guidanceContent = '';
  let specificInstructions = '';

  switch (type) {
    case 'Standard Abstract':
      guidanceContent = await loadGuidanceFile('standard abstract guidance.md');
      specificInstructions = `
        **Abstract Type: Standard Abstract**
        
        Your abstract must follow this structure:
        - **INTRODUCTION**: Why was this study performed? What problem are you addressing?
        - **METHODS**: How did you study this problem?
        - **RESULTS**: Report the data, analyses and/or outcomes
        - **DISCUSSION**: How do you interpret the results?
        - **CONCLUSION**: What is the relevance to clinical practice or future research?
        
        **Word Limits:**
        - Body of Abstract: 750 words maximum (references not included)
        - Use the provided Impact (40 words) and Synopsis (100 words) as context
        
        **Style Requirements:**
        - Use clear section headings
        - Be specific with numbers, statistics, and results
        - Include appropriate references in superscript format
        - Avoid vague statements
      `;
      break;

    case 'Registered Abstract':
      guidanceContent = await loadGuidanceFile('registered abstract guidance.md');
      specificInstructions = `
        **Abstract Type: Registered Abstract**
        
        Your abstract must include:
        - **INTRODUCTION**: Motivation for the study
        - **HYPOTHESIS**: Explicit, testable hypothesis
        - **METHODS**: Detailed experimental methods and study design
        - **STATISTICAL METHODS**: Sample size calculation, effect size estimation, analysis plan
        
        **Critical Requirements:**
        - State a clear, testable hypothesis
        - Describe methods in future tense (work not yet completed)
        - Include explicit protocol for hypothesis evaluation
        - Show feasibility to complete in time for the meeting
        
        **Word Limits:**
        - Total: 500 words maximum (not 750)
        - Only 2 figures/tables allowed
      `;
      break;

    case 'MRI in Clinical Practice Abstract':
      guidanceContent = await loadGuidanceFile('mri in clinical practice abstract guidance.md');
      specificInstructions = `
        **Abstract Type: MRI in Clinical Practice Abstract**
        
        Your abstract must follow this structure:
        - **BACKGROUND**: Clinical presentation and assessment
        - **TEACHING POINT**: How MRI was applied uniquely
        - **DIAGNOSIS AND TREATMENT**: Final diagnosis and confirmation method
        - **SIGNIFICANCE**: Impact of MRI on diagnosis/management
        - **KEY POINTS**: At least 3 key points about the disease and MR imaging
        
        **Focus:**
        - Demonstrate added value of MRI in patient care
        - Highlight unique diagnostic or management insights from MRI
        - Emphasize how MRI changed diagnostic certainty, management, or outcomes
        
        **Word Limits:**
        - Body: 750 words maximum
        - Up to 5 figures with captions
      `;
      break;

    case 'ISMRT Abstract':
      guidanceContent = await loadGuidanceFile('ISMRT abstract.md');
      specificInstructions = `
        **Abstract Type: ISMRT Abstract**
        
        Choose one focus:
        
        **Clinical Practice Focus:**
        - Background justification and purpose
        - Teaching point
        - Summary or conclusions
        
        **Research Focus:**
        - Background justification and purpose
        - Methods (study design)
        - Results
        - Conclusions
        
        **Requirements:**
        - Written for MR Technologists/Radiographers
        - Emphasize practical application and workflow
        - Clear organization and soundness of methods
        - Originality and importance to the profession
      `;
      break;

    default:
      specificInstructions = `
        **Abstract Type: ${type}**
        
        Generate a well-structured academic abstract following standard scientific writing conventions.
      `;
  }

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
    
    **Humanization Guidelines (CRITICAL):**
    - Use clear, direct language
    - Avoid AI-like phrases: "It is worth noting that...", "Based on the above analysis...", "It is not difficult to find..."
    - Be specific and concrete with data and results
    - Use active voice where appropriate
    - Vary sentence structure for natural rhythm
    
    **Source Text:**
    ---
    ${text}
    ---
    
    **Task:**
    Generate the complete abstract body following the structure for ${type}.
    Return a JSON object with:
    - "abstract": the full abstract text with proper sections
    - "impact": use the provided impact statement
    - "synopsis": use the provided synopsis
    - "keywords": array of ${keywordList.split(', ').length} keywords
    
    The abstract should be publication-ready and adhere strictly to the word limits and formatting requirements.
  `;
};

// Creative mode: Generate everything from a core idea
export const getCreativeAbstractByTypePrompt = async (
  coreIdea: string,
  type: AbstractType
): Promise<string> => {
  let guidanceContent = '';
  let specificInstructions = '';

  switch (type) {
    case 'Standard Abstract':
      guidanceContent = await loadGuidanceFile('standard abstract guidance.md');
      specificInstructions = `
        Generate a Standard Abstract with:
        - INTRODUCTION, METHODS, RESULTS, DISCUSSION, CONCLUSION
        - 750 words maximum
        - Invent plausible data and results
      `;
      break;

    case 'Registered Abstract':
      guidanceContent = await loadGuidanceFile('registered abstract guidance.md');
      specificInstructions = `
        Generate a Registered Abstract with:
        - INTRODUCTION, HYPOTHESIS, METHODS, STATISTICAL METHODS
        - 500 words maximum
        - Clear testable hypothesis
        - Methods in future tense
      `;
      break;

    case 'MRI in Clinical Practice Abstract':
      guidanceContent = await loadGuidanceFile('mri in clinical practice abstract guidance.md');
      specificInstructions = `
        Generate a Clinical Practice Abstract with:
        - BACKGROUND, TEACHING POINT, DIAGNOSIS AND TREATMENT, SIGNIFICANCE, KEY POINTS
        - Focus on patient care impact
        - 750 words maximum
      `;
      break;

    case 'ISMRT Abstract':
      guidanceContent = await loadGuidanceFile('ISMRT abstract.md');
      specificInstructions = `
        Generate an ISMRT Abstract with either:
        - Clinical Practice Focus OR Research Focus
        - Written for technologists/radiographers
        - Practical application emphasis
      `;
      break;

    default:
      specificInstructions = `Generate a well-structured abstract for ${type}`;
  }

  return `
    You are an expert academic writer tasked with creatively expanding a core idea into a full, publication-ready abstract.
    
    **Core Idea:** "${coreIdea}"
    
    **Abstract Type:** ${type}
    
    ${specificInstructions}
    
    **Reference: Type-Specific Guidance**
    ---
    ${guidanceContent}
    ---
    
    **Task:**
    1. Expand the core idea into a complete abstract
    2. Invent plausible, scientifically sound details
    3. Generate Impact (40 words), Synopsis (100 words), and Keywords (3-7)
    4. Follow the structure and requirements for ${type}
    
    **Humanization Guidelines:**
    - Clear, direct language
    - Avoid AI clichés
    - Specific, concrete details
    - Natural, varied sentence structure
    
    Return a JSON object with:
    - "abstract": full abstract text
    - "impact": 40-word impact statement
    - "synopsis": 100-word synopsis
    - "keywords": array of 3-7 keywords
  `;
};
