// This file centralizes the detailed guideline information for ISMRM.
// In a real application, this might be loaded from external markdown files.

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

export const humanizationGuidelines = `
Writing Style and Humanization Guidelines:

**Core Principle:** The final text must be indistinguishable from that written by a human expert. Balance formal academic writing with clear, direct expression.

**Style Rules:**
1.  **Clarity & Conciseness:** Ensure every sentence has a clear subject. Avoid long, complex, or nested sentences. Use short sentences where possible to improve readability.
2.  **Rhythm Control:** Vary sentence structure and length to create a natural reading rhythm. Avoid a monotonous, flat narrative.

**Constraints:**
1.  **Faithfulness to Original Meaning:** Core information, key data, and scientific intent must not be altered or omitted.
2.  **Style Consistency:** The writing style must align with the formal, scientific context of an ISMRM abstract.
3.  **Natural Expression:** Prioritize sincere, organic phrasing. Avoid excessive embellishment or technical flair that obscures meaning.
4.  **Logical Rigor:** The optimization process must not disrupt the original text's logical structure.

**Eliminate AI-Generated Tone:**
-   **Strictly Prohibited Phrases:** You MUST NOT use common AI colloquialisms or sentence starters. For example, completely avoid:
    -   "It is worth noting that..."
    -   "It is not difficult to find..."
    -   "Based on the above analysis..."
    -   "In conclusion, this study demonstrates..." (be more direct)
    -   "The findings of this study suggest..."
    -   "This paper explores..."
-   **Directness:** Instead of saying "Results indicated that...", say "We found that...". Be direct and active.
`;
