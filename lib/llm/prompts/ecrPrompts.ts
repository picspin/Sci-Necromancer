import { AbstractType, Category, WritingStyleConfig } from '../../../types';
import { generateWritingStylePrompt, DEFAULT_WRITING_STYLE } from '../writingStyleEnhancer';

/**
 * ECR (European Congress of Radiology) specific prompts
 * Following ESR guidelines for abstract submission
 */

// EQUATOR Network research type guidelines
export const EQUATOR_GUIDELINES = {
  'case-control': {
    checklist: 'STROBE',
    url: 'https://www.equator-network.org/reporting-guidelines/strobe/',
    description: 'STrengthening the Reporting of OBservational studies in Epidemiology',
  },
  'cross-sectional': {
    checklist: 'STROBE',
    url: 'https://www.equator-network.org/reporting-guidelines/strobe/',
    description: 'STrengthening the Reporting of OBservational studies in Epidemiology',
  },
  diagnostic: {
    checklist: 'STARD',
    url: 'https://www.equator-network.org/reporting-guidelines/stard/',
    description: 'Standards for Reporting of Diagnostic Accuracy Studies',
  },
  prognostic: {
    checklist: 'STARD',
    url: 'https://www.equator-network.org/reporting-guidelines/stard/',
    description: 'Standards for Reporting of Diagnostic Accuracy Studies',
  },
  experimental: {
    checklist: 'ARRIVE',
    url: 'https://www.equator-network.org/reporting-guidelines/arrive/',
    description: 'Animal Research: Reporting of In Vivo Experiments',
  },
  observational: {
    checklist: 'STROBE',
    url: 'https://www.equator-network.org/reporting-guidelines/strobe/',
    description: 'STrengthening the Reporting of OBservational studies in Epidemiology',
  },
  rct: {
    checklist: 'CONSORT',
    url: 'https://www.equator-network.org/reporting-guidelines/consort/',
    description: 'CONsolidated Standards of Reporting Trials',
  },
};

// Load ECR guidance file content
const loadECRGuidanceFile = async (): Promise<string> => {
  try {
    const response = await fetch('/ECR-abstract-submission-guidelines.md');
    return await response.text();
  } catch (error) {
    console.warn('Failed to load ECR guidance file', error);
    return '';
  }
};

/**
 * Generate Impact & Synopsis for ECR abstracts
 */
export const getECRImpactSynopsisPrompt = (
  text: string,
  categories: Category[],
  keywords: string[],
  researchType?: string,
  writingStyle: WritingStyleConfig = DEFAULT_WRITING_STYLE
): string => {
  const categoryNames = categories.map((c) => c.name).join(', ');
  const keywordList = keywords.join(', ');

  const equatorGuidance = researchType
    ? Object.entries(EQUATOR_GUIDELINES).find(([key]) =>
        researchType.toLowerCase().includes(key)
      )?.[1]
    : null;

  return `
You are an expert academic writer specialising in ECR (European Congress of Radiology) submissions.
Your task is to generate an Impact statement and Synopsis from the provided research text.

**Task:**
Generate two sections:
1. **Impact** (50 words max): A compelling statement about the clinical significance and potential impact of this research for radiological practice.
2. **Synopsis** (100 words max): A concise summary covering the Purpose, Methods, Results, and Conclusions.

**Context:**
- **Identified Categories:** ${categoryNames}
- **Identified Keywords:** ${keywordList}
${equatorGuidance ? `- **Research Type Guideline:** Follow ${equatorGuidance.checklist} (${equatorGuidance.description})` : ''}

**ECR-Specific Guidelines:**
- Use British English spelling (e.g., "tumour", "centre", "analyse", "randomised")
- Focus on clinical relevance to radiological practice
- Be specific with imaging modalities and techniques
- Include quantitative data where available

${generateWritingStylePrompt(writingStyle)}

**Source Text:**
---
${text}
---

Return a JSON object with two fields: "impact" (string) and "synopsis" (string).
`;
};

/**
 * Generate full ECR abstract based on selected type
 */
export const getECRAbstractByTypePrompt = async (
  text: string,
  impact: string,
  synopsis: string,
  type: AbstractType,
  categories: Category[],
  keywords: string[],
  researchType?: string,
  writingStyle: WritingStyleConfig = DEFAULT_WRITING_STYLE
): Promise<string> => {
  const categoryNames = categories.map((c) => c.name).join(', ');
  const keywordList = keywords.join(', ');

  const guidanceContent = await loadECRGuidanceFile();

  const equatorGuidance = researchType
    ? Object.entries(EQUATOR_GUIDELINES).find(([key]) =>
        researchType.toLowerCase().includes(key)
      )?.[1]
    : null;

  let specificInstructions = '';

  switch (type) {
    case 'ECR Research Presentation':
      specificInstructions = `
**Abstract Type: Research Presentation (RP)**

Your abstract must follow this structure:
- **PURPOSE**: State the aim of the study clearly
- **METHODS AND MATERIALS**: Describe study design, population, imaging protocol, and analysis methods
- **RESULTS**: Present key findings with quantitative data (statistics, p-values, confidence intervals)
- **CONCLUSIONS**: Summarise implications for radiological practice

**Presentation Format:**
- 5-minute oral presentation followed by 2-minute discussion
- May be considered for poster if not accepted for oral

**Word Limit:** Maximum 280 words
`;
      break;

    case 'ECR Clinical Trials in Radiology':
      specificInstructions = `
**Abstract Type: Clinical Trials in Radiology (CTiR)**

Your abstract must include:
- **PURPOSE**: Clear statement of trial objectives
- **METHODS AND MATERIALS**: Trial design, randomisation, blinding, endpoints
- **RESULTS**: Primary and secondary outcomes with statistical analysis
- **CONCLUSIONS**: Clinical implications and future directions

**Eligibility Requirements:**
- Multicentre studies (design/baseline/results)
- Randomised single-centre studies with results

**Presentation Format:**
- 8-minute presentation followed by 4-minute discussion

**Word Limit:** Maximum 280 words
`;
      break;

    case 'ECR EPOS Scientific Poster':
      specificInstructions = `
**Abstract Type: EPOS Scientific Poster**

Your abstract must follow this structure:
- **PURPOSE**: Research question and objectives
- **METHODS AND MATERIALS**: Study design, patient selection, imaging technique
- **RESULTS**: Key findings with supporting data
- **CONCLUSIONS**: Clinical significance and take-home message

**EPOS Features:**
- Electronic Presentation Online System
- Up to 10 images can be uploaded
- Opportunity for EPOS on the GO/EPOS PULSE live presentation

**Word Limit:** Maximum 280 words
`;
      break;

    case 'ECR EPOS Educational Poster':
      specificInstructions = `
**Abstract Type: EPOS Educational Poster**

Your abstract must focus on:
- **LEARNING OBJECTIVES**: What the viewer will learn
- **BACKGROUND**: Context and importance of the topic
- **FINDINGS/PROCEDURE DETAILS**: Key educational content
- **CONCLUSIONS**: Summary of learning points

**Educational Focus:**
- Teaching cases and pictorial reviews
- Technical aspects and protocols
- Imaging patterns and differential diagnosis

**Word Limit:** Maximum 280 words
`;
      break;

    case 'ECR Student Presentation':
      specificInstructions = `
**Abstract Type: Student Presentation**

Suitable topics include:
- University projects and research
- AI-related papers
- Sustainability in radiology
- First imaging research papers

Your abstract should:
- **PURPOSE**: State the objective of your project
- **METHODS**: Describe your approach
- **RESULTS**: Present your findings
- **CONCLUSIONS**: Summarise what you learned and implications

**Word Limit:** Maximum 280 words
`;
      break;

    default:
      specificInstructions = `
**Abstract Type: ${type}**

Generate a well-structured ECR abstract following standard scientific writing conventions.
Use the Purpose, Methods/Materials, Results, Conclusions structure.
**Word Limit:** Maximum 280 words
`;
  }

  return `
You are an expert academic writer tasked with generating a publication-ready abstract for the European Congress of Radiology (ECR).

**Context:**
- **Abstract Type:** ${type}
- **Categories:** ${categoryNames}
- **Keywords:** ${keywordList}
- **Impact Statement (already generated):** ${impact}
- **Synopsis (already generated):** ${synopsis}
${equatorGuidance ? `- **Research Type:** Following ${equatorGuidance.checklist} guidelines` : ''}

${specificInstructions}

**ECR Formatting Requirements:**
- Use British English spelling throughout (tumour, centre, analyse, characterise, randomised)
- Numbers less than 10 spelled out; 10 and above written numerically
- Each section must be a complete paragraph ending with a full stop
- No trade symbols (®, ™, ©) or company names
- Include quantitative results where possible

**Reference: ECR Submission Guidelines**
---
${guidanceContent}
---

${equatorGuidance ? `**EQUATOR Network Guidance:**\nFollow ${equatorGuidance.checklist} checklist for reporting ${equatorGuidance.description}\nReference: ${equatorGuidance.url}` : ''}

${generateWritingStylePrompt(writingStyle)}

**Source Text:**
---
${text}
---

**Task:**
Generate the complete abstract body following the structure for ${type}.
Return a JSON object with:
- "abstract": the full abstract text with proper sections (max 280 words)
- "impact": use the provided impact statement
- "synopsis": use the provided synopsis
- "keywords": array of ${keywords.length} keywords
- "title": a concise title (max 200 characters, no full stop at end, lowercase except first word and proper nouns)

The abstract should be publication-ready and strictly adhere to ECR word limits and British English spelling.
`;
};

/**
 * Creative mode: Generate ECR abstract from core idea
 */
export const getCreativeECRAbstractPrompt = async (
  coreIdea: string,
  type: AbstractType = 'ECR Research Presentation',
  researchType?: string,
  writingStyle: WritingStyleConfig = DEFAULT_WRITING_STYLE
): Promise<string> => {
  const guidanceContent = await loadECRGuidanceFile();

  const equatorGuidance = researchType
    ? Object.entries(EQUATOR_GUIDELINES).find(([key]) =>
        researchType.toLowerCase().includes(key)
      )?.[1]
    : null;

  let typeInstructions = '';
  switch (type) {
    case 'ECR Research Presentation':
      typeInstructions = `
Generate an ECR Research Presentation abstract with:
- PURPOSE, METHODS AND MATERIALS, RESULTS, CONCLUSIONS
- 280 words maximum
- Invent plausible imaging data and statistical results
`;
      break;
    case 'ECR Clinical Trials in Radiology':
      typeInstructions = `
Generate an ECR Clinical Trials abstract with:
- PURPOSE, METHODS AND MATERIALS (trial design), RESULTS, CONCLUSIONS
- 280 words maximum
- Multicentre or randomised design
- Include primary/secondary endpoints
`;
      break;
    case 'ECR EPOS Scientific Poster':
      typeInstructions = `
Generate an ECR EPOS Scientific Poster abstract with:
- PURPOSE, METHODS AND MATERIALS, RESULTS, CONCLUSIONS
- 280 words maximum
- Suitable for visual presentation
`;
      break;
    case 'ECR EPOS Educational Poster':
      typeInstructions = `
Generate an ECR EPOS Educational Poster abstract with:
- LEARNING OBJECTIVES, BACKGROUND, FINDINGS, CONCLUSIONS
- 280 words maximum
- Educational focus with clear teaching points
`;
      break;
    default:
      typeInstructions = `Generate a well-structured ECR abstract with 280 words maximum`;
  }

  return `
You are an expert academic writer tasked with creatively expanding a core idea into a full ECR abstract.

**Core Idea:** "${coreIdea}"

**Abstract Type:** ${type}

${typeInstructions}

**ECR Requirements:**
- British English spelling (tumour, centre, analyse, randomised)
- Numbers < 10 spelled out; >= 10 written numerically
- No trade symbols or company names
- Each section ends with a full stop

${equatorGuidance ? `**EQUATOR Network Guidance:**\nFollow ${equatorGuidance.checklist} checklist: ${equatorGuidance.url}` : ''}

**Reference: ECR Guidelines**
---
${guidanceContent}
---

${generateWritingStylePrompt(writingStyle)}

**Task:**
1. Expand the core idea into a complete, scientifically plausible ECR abstract
2. Invent realistic imaging protocols, patient numbers, and statistical findings
3. Generate Impact (50 words), Synopsis (100 words), and Keywords (3-5)
4. Create a title (max 200 characters, no full stop, lowercase except first word)

Return a JSON object with:
- "abstract": full abstract text (max 280 words)
- "impact": 50-word impact statement
- "synopsis": 100-word synopsis
- "keywords": array of 3-5 keywords
- "title": concise title following ECR format
`;
};

/**
 * Analyze content for ECR submission categories and research type
 */
export const getECRAnalysisPrompt = (text: string): string => {
  return `
You are an expert in radiology research classification for ECR (European Congress of Radiology) submissions.

Analyze the following research text and extract:

1. **Categories**: Identify relevant ECR categories from:
   - Organ systems: Abdominal Viscera, Breast, Cardiac, Chest, Head and Neck, Musculoskeletal, Neuro, Oncologic Imaging, Paediatric, Urogenital, Vascular
   - Modalities: CT, MRI, Ultrasound, Conventional Radiography, Mammography, Fluoroscopy, Hybrid Imaging
   - Applications: AI/Machine Learning, Contrast Media, Emergency Radiology, Interventional, Radiation Protection, Radiomics, Sustainability

2. **Keywords**: Extract 3-5 relevant keywords for the abstract

3. **Research Type**: Classify the study design:
   - Case-control study (use STROBE)
   - Cross-sectional study (use STROBE)
   - Diagnostic or prognostic study (use STARD)
   - Experimental/animal study (use ARRIVE)
   - Observational/cohort study (use STROBE)
   - Randomised controlled trial (use CONSORT)

4. **Suggested Abstract Type**:
   - ECR Research Presentation (5-min oral)
   - ECR Clinical Trials in Radiology (8-min oral, for trials)
   - ECR EPOS Scientific Poster
   - ECR EPOS Educational Poster
   - ECR Student Presentation

**Text to analyze:**
---
${text}
---

Return a JSON object with:
- "categories": array of objects with {name: string, type: "main"|"sub"|"secondary", probability: number}
- "keywords": array of strings
- "researchType": string (one of the study types above)
- "equatorGuideline": {checklist: string, url: string}
- "suggestedAbstractTypes": array of {type: string, probability: number}
`;
};
