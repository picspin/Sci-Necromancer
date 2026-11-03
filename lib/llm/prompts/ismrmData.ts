// Verified against ISMRM 2027 official pages and category PDF on 2026-10-11.
// Embedded so server-side generation does not rely on browser-relative fetch.
import type { AbstractType } from '../../../types.js';
import { generateWritingStylePrompt, DEFAULT_WRITING_STYLE } from '../writingStyleEnhancer.js';

export const ISMRM_2027_RULES = {
  version: 'ISMRM-2027-2026-10-11',
  submissionUrl: 'https://www.ismrm.org/27m/call/',
  categoriesUrl: 'https://www.ismrm.org/27/docs/27m_categories_and_keywords.pdf',
  abstractTypes: [
    'Standard Abstract',
    'MRI in Clinical Practice Abstract',
    'MD-PhD Tandem Abstract',
    'ISMRT Abstract',
  ] as AbstractType[],
  wordLimits: { abstract: 750, impact: 40, synopsis: 100 },
  titleCharacters: 125,
  maxKeywords: 5,
} as const;

// Columns: official code | category | subcategory. General keywords are
// independent, not assigned to the category on the same printed PDF row.
const categoryRows = `
101 | Acquisition & Reconstruction | AI methods
102 | Acquisition & Reconstruction | Non-AI methods
103 | Acquisition & Reconstruction | Artifacts and Correction Strategies
104 | Acquisition & Reconstruction | Image Reconstruction: AI
105 | Acquisition & Reconstruction | Image Reconstruction: Non-AI
106 | Acquisition & Reconstruction | Motion Correction: Neuro
107 | Acquisition & Reconstruction | Motion Correction: Non-Neuro
108 | Acquisition & Reconstruction | New Signal Preparation Schemes
109 | Acquisition & Reconstruction | Pulse Sequence Design and Spatial Encoding Methods
110 | Acquisition & Reconstruction | Pulse Sequence Design: Neuro
111 | Acquisition & Reconstruction | Pulse Sequence Design: Non-Neuro
112 | Acquisition & Reconstruction | Signal Modeling
113 | Acquisition & Reconstruction | Subsampling: Parallel Imaging, Compressed Sensing & Low-Rank Modeling
114 | Acquisition & Reconstruction | Quantitative Imaging: Relaxometry, Multi-Parametric, MR Fingerprinting, & Synthetic MRI
115 | Acquisition & Reconstruction | Quantitative Imaging: Head and neck
116 | Acquisition & Reconstruction | Quantitative Imaging: Chest, Abdomen, & Pelvis
117 | Acquisition & Reconstruction | Quantitative Imaging: Spine, MSK, Others
118 | Acquisition & Reconstruction | Spectroscopy & Spectroscopic Imaging
119 | Acquisition & Reconstruction | Open Source Software, Sequences, & Reconstruction Algorithms
301 | Analysis Methods | Data Processing
302 | Analysis Methods | Radiomics
303 | Analysis Methods | Software Tools
304 | Analysis Methods | Visualization
305 | Analysis Methods | Image Registration and Alignment
306 | Analysis Methods | Image Enhancement
307 | Analysis Methods | Image Synthesis and Translation
308 | Analysis Methods | Segmentation and Detection
309 | Analysis Methods | Classification and Prediction
310 | Analysis Methods | Multi-Modal Learning with LLMs/VLMs
311 | Analysis Methods | Generative Models
312 | Analysis Methods | Foundation Models
401 | Body | Biliary
402 | Body | Body Composition
403 | Body | Breast
404 | Body | Chest/Thorax
405 | Body | Digestive
406 | Body | Endocrine
407 | Body | Fetal
408 | Body | Liver
409 | Body | Lung
410 | Body | Metabolism
411 | Body | Pancreas
412 | Body | Pelvis
413 | Body | Placenta
414 | Body | Prostate
415 | Body | Urogenital
416 | Body | Uterus
417 | Body | Vessels
418 | Body | Whole Body Imaging
419 | Body | Kidney
420 | Body | Spleen
501 | Cardiovascular | Arrhythmia
502 | Cardiovascular | Atherosclerosis
503 | Cardiovascular | Flow
504 | Cardiovascular | Heart Failure
505 | Cardiovascular | Hematology, Oncology
506 | Cardiovascular | Inflammation, Infiltration
507 | Cardiovascular | Myocardium
508 | Cardiovascular | Valves
509 | Cardiovascular | Vascular and Vessel Wall
510 | Cardiovascular | Myocardial Infarct
601 | Contrast Mechanisms | Arterial Spin Labelling
602 | Contrast Mechanisms | CEST / APT / NOE
603 | Contrast Mechanisms | Contrast Agents
604 | Contrast Mechanisms | Deuterium
605 | Contrast Mechanisms | Elastography
606 | Contrast Mechanisms | Electromagnetic Tissue Properties
607 | Contrast Mechanisms | Electron Paramagnetic Resonance
608 | Contrast Mechanisms | Fat & Fat/Water Separation
609 | Contrast Mechanisms | Hybrid Imaging
610 | Contrast Mechanisms | Hyperpolarized MR (Gas)
611 | Contrast Mechanisms | Hyperpolarized MR (Non-Gas)
612 | Contrast Mechanisms | Magnetization Transfer
613 | Contrast Mechanisms | Microstructure
614 | Contrast Mechanisms | Molecular Imaging
615 | Contrast Mechanisms | Multi-Contrast
616 | Contrast Mechanisms | Non-Proton
617 | Contrast Mechanisms | Novel Contrast Mechanisms
618 | Contrast Mechanisms | Oxygenation
619 | Contrast Mechanisms | Relaxometry
620 | Contrast Mechanisms | Spectroscopy
621 | Contrast Mechanisms | Susceptibility/QSM
622 | Contrast Mechanisms | Thermometry
623 | Contrast Mechanisms | Velocity/Flow
624 | Contrast Mechanisms | Perfusion
625 | Contrast Mechanisms | Diffusion
701 | Diffusion | Diffusion Acquisition
702 | Diffusion | Diffusion Analysis & Visualization
703 | Diffusion | Diffusion Modeling
704 | Diffusion | Diffusion Reconstruction
705 | Diffusion | Diffusion Software
706 | Diffusion | DWI/DTI/DKI
707 | Diffusion | IVIM
708 | Diffusion | Microstructure
709 | Diffusion | Simulation/Validation
710 | Diffusion | Tractography
711 | Diffusion | Exchange
712 | Diffusion | Relaxation
713 | Diffusion | Diffusion Time Dependence
801 | Brain Function and fMRI | fMRI Acquisition
802 | Brain Function and fMRI | fMRI Analysis
803 | Brain Function and fMRI | Functional Connectivity
804 | Brain Function and fMRI | Task/Intervention Based fMRI
805 | Brain Function and fMRI | fMRI & Neuromodulation
901 | Interventional | Devices
902 | Interventional | MR-Guided Focused Ultrasound
903 | Interventional | MR-Guided Interventions
904 | Interventional | MR-Guided Radiotherapy
905 | Interventional | Other Interventional
906 | Interventional | Thermometry/Thermotherapy
907 | Interventional | MR-Guided Neuromodulation
1001 | Musculoskeletal | Bone
1002 | Musculoskeletal | Cartilage
1003 | Musculoskeletal | Whole Joint
1004 | Musculoskeletal | Muscle
1005 | Musculoskeletal | Neurography
1006 | Musculoskeletal | Osteoarthritis
1007 | Musculoskeletal | Other Musculoskeletal
1008 | Musculoskeletal | Functional/Dynamic
1009 | Musculoskeletal | Tendon/Ligament
1101 | Neuro | Aging
1102 | Neuro | Alzheimer's Disease
1103 | Neuro | Blood Vessels
1104 | Neuro | Dementia
1105 | Neuro | Development
1106 | Neuro | Epilepsy
1107 | Neuro | Gray Matter
1108 | Neuro | Head & Neck/ENT
1109 | Neuro | Hydrocephalus
1110 | Neuro | Infectious Disease
1111 | Neuro | Multiple Sclerosis
1112 | Neuro | Neurofluids
1113 | Neuro | Neuroinflammation
1114 | Neuro | Neurotherapeutics
1115 | Neuro | Neurotransmission
1116 | Neuro | Other Neurodegeneration
1117 | Neuro | Parkinson's Disease
1118 | Neuro | Peripheral Nerves
1119 | Neuro | Psychiatric Disorders
1120 | Neuro | Spinal Cord
1121 | Neuro | Stroke and Cerebrovascular Disorders
1122 | Neuro | Traumatic Brain Injury
1123 | Neuro | Tumors
1124 | Neuro | White Matter
1125 | Neuro | Neuromodulation
1126 | Neuro | Vascular Dementia
1201 | Pediatrics | Adolescents
1202 | Pediatrics | Body
1203 | Pediatrics | Cancer
1204 | Pediatrics | Cardiovascular
1205 | Pediatrics | Fetal
1206 | Pediatrics | Genetics
1207 | Pediatrics | MSK
1208 | Pediatrics | Neonatal
1209 | Pediatrics | Neuro
1210 | Pediatrics | Normal Development
1211 | Pediatrics | Prenatal
1212 | Pediatrics | Rare Disease
1301 | Physics & Engineering | Bioeffects & Magnetic Fields
1302 | Physics & Engineering | Gradients
1303 | Physics & Engineering | High-Field MRI
1304 | Physics & Engineering | Hybrid & Novel Systems Technology
1305 | Physics & Engineering | In Silico
1306 | Physics & Engineering | Interventional Devices
1307 | Physics & Engineering | Low-Field MRI
1308 | Physics & Engineering | Magnets (B0)
1309 | Physics & Engineering | Multimodal
1310 | Physics & Engineering | New Devices
1311 | Physics & Engineering | Non-Array RF Coils, Antennas & Waveguides
1312 | Physics & Engineering | Parallel Transmit & Multiband
1313 | Physics & Engineering | PET/MR
1314 | Physics & Engineering | Phantoms
1315 | Physics & Engineering | RF Arrays & Systems
1316 | Physics & Engineering | RF Pulse Design & Fields
1317 | Physics & Engineering | Safety
1318 | Physics & Engineering | Shims
1319 | Physics & Engineering | System Imperfections
1320 | Physics & Engineering | Whole Body
1401 | Preclinical Animal & in vitro MR | Biology, Models, Methods
1402 | Preclinical Animal & in vitro MR | Biomarkers
1403 | Preclinical Animal & in vitro MR | Large Animals, Nonhuman Primates
1404 | Preclinical Animal & in vitro MR | Other Preclinical
1405 | Preclinical Animal & in vitro MR | Probes & Targets
1406 | Preclinical Animal & in vitro MR | Small Animals
`;

export const ISMRM_SUBCATEGORIES = categoryRows
  .trim()
  .split('\n')
  .map((row) => {
    const [code, category, subcategory] = row.split(' | ');
    return { code, category, subcategory, name: `${category}: ${subcategory}` };
  });

export const ISMRM_GENERAL_KEYWORDS = [
  'Abbreviated/Rapid MRI',
  'Acquisition Methods',
  'Adnexa',
  'Age',
  'Analysis/Processing',
  'Angiography',
  'Animals',
  'Arrhythmia',
  'Bladder',
  'Blood',
  'Brain',
  'Brain Connectivity',
  'Cardiomyopathy',
  'Cell Tracking & Reporter Genes',
  'CEST & MT',
  'Challenges',
  'Compressed Sensing',
  'Contrast Mechanisms',
  'COVID-19',
  'Data Acquisition',
  'Data Analysis',
  'Degenerative',
  'Diabetes',
  'Diagnosis/Prediction',
  'Diffusion',
  'Diffusion Denoising',
  'Drug Development',
  'Drugs',
  'DSC & DCE Perfusion',
  'Effective Connectivity',
  'Ex-Vivo Applications',
  'Female',
  'fMRI (resting state)',
  'fMRI (task based)',
  'Focused Ultrasound',
  'Genetic Diseases',
  'Glymphatics',
  'Health Care Economics',
  'Heart',
  'Hematologic',
  'High Field',
  'Hypertension',
  'Infection',
  'Ischemia',
  'Joints',
  'Kidney',
  'Language Models',
  'Large animals, nonhuman primates',
  'Low Field',
  'Male',
  'Metabolism',
  'Modelling',
  'MR Fingerprinting',
  'MR Fingerprinting/Synthetic MR',
  'MR Value',
  'Myelography',
  'Nerves',
  'Nervous system',
  'Neurodegeneration',
  'Neuroscience',
  'New Trajectories & Spatial Encoding Methods',
  'Parallel Imaging',
  'Pediatric',
  'Permeability',
  'Phantom',
  'Pharmacology',
  'Precision & Accuracy',
  'Preclinical',
  'Preclinical image analysis',
  'Prevention',
  'Probes and Targets',
  'Quantitative',
  'Radiotherapy',
  'Relaxation',
  'Reproductive',
  'Rheumatoid Arthritis',
  'Screening',
  'Signal Representations',
  'Simulations',
  'Skeletal',
  'Sparse & Low-Rank Models',
  'Spectroscopy',
  'Structural Connectivity',
  'Surgery',
  'Thorax',
  'Thrombo-Embolic',
  'Tissue Characterization',
  'Toxicity',
  'Tractography & Fibre Modelling',
  'Translational Studies',
  'Transplantation',
  'Trauma',
  'Treatment',
  'Treatment Response',
  'Validation',
  'Vessel Wall',
];

export const callForAbstractsGuidance = `
ISMRM 2027 (ISMRM-2027-2026-10-11; verified 2026-10-11).
Official call: https://www.ismrm.org/27m/call/
Vancouver, Canada; meeting 8–13 May 2027; submission window 1–28 October 2026.
Title <=125 characters; English body <=750 words excluding References; Impact <=40 words; Synopsis <=100 words.
Up to 5 review figures, captions <=500 characters each, plus one separate caption-free mobile-legible Preview Figure (not reviewed).
Select primary and secondary category/subcategory pairs; category may repeat, subcategory must differ. Select one General keyword (official or custom); ECHO permits up to 5 keywords.
Standard Synopsis uses Motivation, Goals, Approach, Results; clinical Synopsis is unstructured.
Funding, code, data and supporting links belong only in separate Acknowledgements, hidden from reviewers. Keep platform/model AI disclosure separate from reviewed prose; authors check the portal placement.
Original source-supported work only. Do not invent participants, methods, results, statistics, references, consent or ethics approval. Mark missing facts [author to verify].
AI assistance is allowed, never authorship; humans verify integrity, privacy, consent, conflicts and evidence-based claims.
MD-PhD Tandem requires a clinical expert and technical expert as joint first authors/presenters; do not infer or invent their eligibility.
Deep Dive into New Dimensions is an optional Standard presentation consideration, not an abstract type or guaranteed session assignment. Author selects it in ECHO; focus may be spatial, temporal, velocity, exchange or another quantitative biomarker dimension.
Registered Abstract is not listed in the verified 2027 call. Historical drafts remain readable, not a verified current submission route.
Recheck official ECHO requirements before submission. Official pages contain conflicting withdrawal dates; do not invent a deadline/timezone.
`;

export const abstractCategoryGuidance = `
ISMRM 2027 classification: suggest both category/subcategory pairs using the official coded list.
Both may share a category but must use different subcategories; do not drop a secondary choice solely for sharing the primary category.
Return canonical "Category: Subcategory" names. Include one General keyword; recommend at most 5 source-relevant keywords, allowing custom terms.
Do not confuse organ/category classification with abstract type eligibility. A Body/Neuro research study can be Standard; Clinical Practice requires case-based MRI care impact.
`;

export const categoryAndKeywordsList = `
ISMRM 2027 official category/subcategory codes:
Source: ${ISMRM_2027_RULES.categoriesUrl}
${categoryRows}
General keywords (independent of categories):
${ISMRM_GENERAL_KEYWORDS.join(', ')}
`;

export function getISMRMTypeGuidance(type: AbstractType): string {
  if (type === 'Registered Abstract')
    throw new Error(
      'Registered Abstract is not a verified ISMRM 2027 submission type; choose a current type.'
    );
  if (type === 'MRI in Clinical Practice Abstract')
    return `
Clinical Presentation and Assessment; Diagnosis and Treatment; Significance; Key Points (at least 3); References if supplied.
Describe de-identified clinical history, MR field strength, coils, sequences, relevant parameters/contrast, diagnostic confirmation and management impact only when supplied.
Use a <=100-word unstructured clinical Synopsis, not Motivation/Goals/Approach/Results headings. Revise the earlier synopsis into this format.
Impact <=40 words describes changes to diagnosis, management or outcomes. Body <=750 words; title <=125 characters.
`;
  if (type === 'MD-PhD Tandem Abstract')
    return `
MD-PhD Tandem Abstract: standard research format, <=750-word body excluding References, <=125-character title.
Suggested sections: INTRODUCTION, METHODS, RESULTS, DISCUSSION, CONCLUSION; supplied REFERENCES in numerical order with superscript citations.
Synopsis <=100 words total across Motivation, Goals, Approach, Results; Impact <=40 words.
Two joint first authors/presenters: one clinical expert and one technical expert. Authors must confirm eligibility; never invent roles or credentials.
Both present jointly; an oral slot allows five minutes each. Presentation assignment remains AMPC's decision.
`;
  if (type === 'ISMRT Abstract')
    return `
Separate 2027 ISMRT track for practicing MR technologists/radiographers or equivalent; author confirms eligibility and CV/resume.
Clinical Practice Focus: Background/Introduction, Teaching Point, Summary/Conclusions.
Research Focus: Background/Purpose, Methods, Results, Conclusions. Include supplied References.
Body <=750 words excluding References; title <=125 characters; Impact <=40 words; Synopsis <=100 words across Motivation, Goals, Approach, Results.
The official page has stale dates and inconsistent Sustainability/presentation language; do not invent a Sustainability template or eligibility.
`;
  if (type === 'Standard Abstract')
    return `
Standard Abstract: suggested INTRODUCTION, METHODS, RESULTS, DISCUSSION, CONCLUSION, plus supplied REFERENCES.
These sections are recommended, not an absolute submission rejection rule. Body <=750 words excluding References; title <=125 characters.
Synopsis <=100 words across Motivation, Goals, Approach, Results; Impact <=40 words. Use substantive supplied results; numerical superscript citations follow source order.
`;
  return `Abstract Type: ${type}. Follow its conference-specific structure and limits.`;
}

export const humanizationGuidelines = generateWritingStylePrompt(DEFAULT_WRITING_STYLE);
