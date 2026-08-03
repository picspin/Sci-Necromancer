import type { AbstractType } from '../../../types';
import { BaseOncologyConferenceModule } from '../BaseOncologyConferenceModule';

const ESMO_CATEGORIES = [
  'AI for diagnostics and profiling',
  'AI for clinical workflows and decision-making',
  'AI for clinical research and drug development',
  'Basic science',
  'New diagnostic tools',
  'Pathology and molecular pathology',
  'Translational research and biomarkers',
  'Breast cancer, early stage',
  'Advanced breast cancer, other',
  'HER2+ breast cancer',
  'HR+ breast cancer',
  'Triple negative breast cancer',
  'CNS tumours',
  'Developmental therapeutics',
  'Biliary tract cancer incl cholangiocarcinoma',
  'Hepatocellular carcinoma',
  'Oesophagogastric cancer',
  'Pancreatic cancer',
  'Colon cancer',
  'Rectal and anal cancer',
  'Germ cell/testicular and penile cancer',
  'Localised/locally advanced prostate cancer',
  'Metastatic prostate cancer',
  'Renal cancer',
  'Urothelial cancer',
  'Gynaecological cancers',
  'Haematological malignancies',
  'Head and neck cancer excluding thyroid',
  'Investigational immunotherapy',
  'Melanoma',
  'Non-melanoma skin tumours',
  'Endocrine tumours',
  'Neuroendocrine tumours',
  'Thyroid cancer',
  'NSCLC early stage',
  'NSCLC locally advanced',
  'NSCLC metastatic',
  'SCLC',
  'Thoracic malignancies other',
  'Policy',
  'Sarcoma',
  'Early detection and intervention',
  'Primary prevention',
  'Secondary prevention and intervention',
  'Palliative care',
  'Psycho-oncology',
  'Supportive care',
  'Cancer nursing (EONS)',
  'Miscellaneous',
] as const;

export class ESMOModule extends BaseOncologyConferenceModule {
  readonly id = 'ESMO' as const;
  readonly name = 'ESMO Congress';
  readonly submissionUrl = 'https://www.esmo.org/meeting-calendar/esmo-congress-2026';
  readonly abstractTypes: AbstractType[] = [
    'ESMO Regular Abstract',
    'ESMO Late-Breaking Intent',
    'ESMO Late-Breaking Abstract',
    'ESMO Trial in Progress',
  ];
  readonly categories = ESMO_CATEGORIES;
  readonly keywords = [
    'Clinical Trial',
    'Translational Research',
    'Biomarker',
    'Immunotherapy',
    'Molecular Profiling',
    'Real-World Data',
    'Patient-Reported Outcomes',
    'Artificial Intelligence',
    'Supportive Care',
    'Precision Medicine',
  ] as const;

  override getColorScheme() {
    return { primary: '#72246c', secondary: '#9d4b96', accent: '#e1a82b' };
  }
}
