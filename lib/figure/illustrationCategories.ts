/** The bounded schematic families shared by the member UI and server-side Jev contract. */
export const ILLUSTRATION_CATEGORY_IDS = [
  'graphical-abstract',
  'mechanism-pathway',
  'clinical-workflow',
  'study-design',
  'molecular-cellular',
  'imaging-anatomy',
  'ai-model-pipeline',
] as const;

export type IllustrationCategoryId = (typeof ILLUSTRATION_CATEGORY_IDS)[number];
