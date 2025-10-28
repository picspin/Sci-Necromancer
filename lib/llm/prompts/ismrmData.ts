// This file centralizes the detailed guideline information for ISMRM.
// In a real application, this might be loaded from external markdown files.

import { generateWritingStylePrompt, DEFAULT_WRITING_STYLE } from '../writingStyleEnhancer';

export const callForAbstractsGuidance = `
ISMRM Global Guidance for Abstract Submission:
1.  **Title:** Concise, specific, and representative of the research.
2.  **Authors & Affiliations:** List all authors and their primary institutional affiliations.
3.  **Impact Statement:** A short (approx. 50 words) statement summarizing the 'so what' of the study. It should be compelling and highlight the significance of the findings.
4.  **Synopsis:** A longer (approx. 200-250 words) structured summary including Introduction, Methods, Results, and Conclusion.
    -   **Introduction:** State the hypothesis or purpose of the study.
    -   **Methods:** Describe the experimental methods, including techniques, subjects, and data analysis procedures.
    -   **Results:** Present the main findings of the study, supported by data.
    -   **Conclusion:** Summarize the study's conclusions and their implications.
5.  **Figures & Tables:** Include figures and tables to illustrate results, with clear captions.
6.  **References:** Provide references where appropriate.
`;

export const abstractCategoryGuidance = `
Guidance for Abstract Category & Keyword Analysis:
Your task is to analyze the provided text and identify the most relevant scientific categories and keywords based on the ISMRM classification system.

1.  **Read the Text:** Thoroughly read the abstract text to understand its core topic, methods, and findings.
2.  **Identify Main Category:** Determine the primary field of research. This is the 'main' category. Examples: 'Neuro', 'Body', 'Cardiovascular'.
3.  **Identify Subcategories:** Identify more specific sub-fields. These are the 'sub' categories. Example: For 'Neuro', a subcategory could be 'fMRI', 'DTI', or 'Spectroscopy'.
4.  **Identify Secondary Categories:** Identify any other relevant but less central topics. These are 'secondary' categories.
5.  **Extract Keywords:** Pull out 3-7 specific terms that are crucial to the study. These should include the imaging technique, the anatomy or disease studied, and the main concept being investigated.
6.  **Assign Probabilities:** For each identified category, estimate a probability of relevance (0.0 to 1.0). The main category should have the highest probability.
7.  **Format Output:** Present the results in a structured JSON format.
`;

export const categoryAndKeywordsList = `
Partial List of ISMRM Abstract Categories & Keywords for Routing:

**Main Categories:**
-   Neuro
-   Body
-   Cardiovascular
-   Musculoskeletal (MSK)
-   Interventional
-   Preclinical & Basic Science
-   Data Analysis & Reconstruction
-   Engineering

**Subcategories (Examples):**
-   (Neuro): fMRI, DTI, Perfusion, Spectroscopy, Brain, Spine
-   (Body): Abdomen, Pelvis, Liver, Prostate, Oncology
-   (Cardiovascular): Heart, Vessels, Flow, Myocardium
-   (MSK): Cartilage, Muscle, Bone, Joints
-   (Data Analysis): Machine Learning, AI, Deep Learning, Image Reconstruction, Quantitative Imaging

**Keywords (Examples):**
-   Techniques: Diffusion, BOLD, T1 mapping, T2 mapping, CEST, MR-PET
-   Anatomy: Hippocampus, Kidney, Aorta, Knee
-   Pathology: Tumor, Stroke, Infarction, Arthritis
-   Concepts: Accuracy, Reproducibility, Contrast, Resolution
`;

// Humanization guidelines are now generated dynamically from writingStyleEnhancer
// This ensures consistency across all prompts
export const humanizationGuidelines = generateWritingStylePrompt(DEFAULT_WRITING_STYLE);