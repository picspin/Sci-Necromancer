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

  // ECR Unified Structure - Required for all abstract types
  const ecrStructure = `
**ECR ABSTRACT STRUCTURE (REQUIRED):**
Your abstract MUST include ALL of the following sections with headers in uppercase:

1. **PURPOSE or LEARNING OBJECTIVE**: State the aim of the study / What the viewer will learn (1-2 sentences)

2. **METHODS or BACKGROUND**: Describe study design, population, imaging protocol, and analysis methods OR provide context and importance of the topic (2-3 sentences)

3. **RESULTS or FINDINGS**: Present key findings with quantitative data (statistics, p-values, confidence intervals) OR key educational content (2-3 sentences)

4. **CONCLUSIONS**: Summarise implications for radiological practice OR summary of learning points (1-2 sentences)

5. **LIMITATIONS**: State limitations of the study (1 sentence, mandatory for research, optional for educational)

6. **FUNDING for this study**: Declare funding sources. If none, state "No funding was received for this study." (1 sentence, mandatory)

**ECR WORD LIMIT:** STRICTLY MAXIMUM 280 WORDS (abstract body only, excluding title and keywords)

**BRITISH ENGLISH SPELLING:** tumour, centre, analyse, colour, randomised, characterise, optimise

**NUMBERS:** Spell out numbers less than 10; use numerals for 10 and above

**TITLE REQUIREMENTS:** Maximum 200 characters, no full stop at end, no trade names or special symbols (®, ™, ©)
`;

  switch (type) {
    case 'ECR Research Presentation':
      specificInstructions = `
**Abstract Type: Research Presentation (RP)**

${ecrStructure}

**Presentation Format:**
- 5-minute oral presentation followed by 2-minute discussion
- May be considered for poster if not accepted for oral
`;
      break;

    case 'ECR Clinical Trials in Radiology':
      specificInstructions = `
**Abstract Type: Clinical Trials in Radiology (CTiR)**

${ecrStructure}

**Clinical Trial Requirements:**
- Emphasise trial design, randomisation, and statistical methodology
- Report primary and secondary outcomes with statistical significance

**Presentation Format:**
- 8-minute presentation followed by 4-minute discussion
`;
      break;

    case 'ECR EPOS Scientific Poster':
      specificInstructions = `
**Abstract Type: EPOS Scientific Poster**

${ecrStructure}

**EPOS Features:**
- Electronic Presentation Online System
- Up to 10 images can be uploaded
- Suitable for visual presentation with data
`;
      break;

    case 'ECR EPOS Educational Poster':
      specificInstructions = `
**Abstract Type: EPOS Educational Poster**

${ecrStructure}

**Educational Focus:**
- Emphasise LEARNING OBJECTIVES and CONCLUSIONS for teaching
- BACKGROUND provides context and importance
- FINDINGS/PROCEDURE DETAILS for key educational content
- LIMITATIONS and FUNDING still required

**Suitable Topics:**
- Teaching cases and pictorial reviews
- Technical aspects and protocols
- Imaging patterns and differential diagnosis
`;
      break;

    case 'ECR Student Presentation':
      specificInstructions = `
**Abstract Type: Student Presentation**

${ecrStructure}

**Suitable Topics:**
- University projects and research
- AI-related papers
- Sustainability in radiology
- First imaging research papers
`;
      break;

    default:
      specificInstructions = `
**Abstract Type: ${type}**

${ecrStructure}
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

  // ECR Unified Structure - Required for all abstract types
  const ecrStructure = `
**ECR ABSTRACT STRUCTURE (REQUIRED):**
Your abstract MUST include ALL of the following sections with headers in uppercase:

1. **PURPOSE or LEARNING OBJECTIVE**
2. **METHODS or BACKGROUND**
3. **RESULTS or FINDINGS**
4. **CONCLUSIONS**
5. **LIMITATIONS** (mandatory for research)
6. **FUNDING for this study** (mandatory, e.g., "No funding was received for this study.")

**STRICT WORD LIMIT:** 280 words maximum

**BRITISH ENGLISH:** tumour, centre, analyse, colour, randomised
**NUMBERS:** <10 spelled out; >=10 numerals
**TITLE:** max 200 characters, no full stop, no trade symbols
`;

  switch (type) {
    case 'ECR Research Presentation':
      typeInstructions = `
**Abstract Type: Research Presentation**

${ecrStructure}

Focus: 5-minute oral presentation suitable content
`;
      break;
    case 'ECR Clinical Trials in Radiology':
      typeInstructions = `
**Abstract Type: Clinical Trials in Radiology**

${ecrStructure}

Focus: Trial design, randomisation, primary/secondary outcomes
`;
      break;
    case 'ECR EPOS Scientific Poster':
      typeInstructions = `
**Abstract Type: EPOS Scientific Poster**

${ecrStructure}

Focus: Visual presentation with data
`;
      break;
    case 'ECR EPOS Educational Poster':
      typeInstructions = `
**Abstract Type: EPOS Educational Poster**

${ecrStructure}

Focus: Learning objectives, teaching points, educational content
`;
      break;
    case 'ECR Student Presentation':
      typeInstructions = `
**Abstract Type: Student Presentation**

${ecrStructure}

Focus: University projects, first research papers
`;
      break;
    default:
      typeInstructions = `
**Abstract Type: ${type}**

${ecrStructure}
`;
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
