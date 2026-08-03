import type { AbstractType } from '../../../types';
import { BaseOncologyConferenceModule } from '../BaseOncologyConferenceModule';

const ASCO_CATEGORIES = [
  'Breast Cancer',
  'Central Nervous System Tumors',
  'Developmental Therapeutics',
  'Gastrointestinal Cancer—Colorectal and Anal',
  'Gastrointestinal Cancer—Gastroesophageal, Pancreatic, and Hepatobiliary',
  'Genitourinary Cancer—Kidney and Bladder',
  'Genitourinary Cancer—Prostate, Testicular, and Penile',
  'Gynecologic Cancer',
  'Head and Neck Cancer',
  'Health Services Research and Quality Improvement',
  'Hematologic Malignancies',
  'Lung Cancer—Non-Small Cell',
  'Lung Cancer—Small Cell/Other Thoracic Cancers',
  'Melanoma/Skin Cancers',
  'Pediatric Oncology',
  'Prevention, Risk Reduction, and Genetics',
  'Sarcoma',
  'Symptoms and Survivorship',
] as const;

export class ASCOModule extends BaseOncologyConferenceModule {
  readonly id = 'ASCO' as const;
  readonly name = 'ASCO Annual Meeting';
  readonly submissionUrl =
    'https://www.asco.org/annual-meeting/abstracts-presentations/submission-details/requirements';
  readonly abstractTypes: AbstractType[] = [
    'ASCO Regular Abstract',
    'ASCO Late-Breaking Shell',
    'ASCO Late-Breaking Abstract',
    'ASCO Trials in Progress',
  ];
  readonly categories = ASCO_CATEGORIES;
  readonly keywords = [
    'Clinical Trial',
    'Biomarker',
    'Immunotherapy',
    'Targeted Therapy',
    'Overall Survival',
    'Progression-Free Survival',
    'Real-World Evidence',
    'Quality of Life',
    'Screening',
    'Precision Oncology',
  ] as const;

  override getColorScheme() {
    return { primary: '#1f6fa9', secondary: '#56a0d3', accent: '#f1b82d' };
  }
}
