import type { Conference } from '@/types';
import { RSNA_RULESET } from '@/lib/conference/rsnaRules';
import { getOncologyProfile } from '@/lib/conference/oncologyRules';

type ReviewConference = Exclude<Conference, 'IMAGE' | 'JACC' | 'ESC'>;

export function getConferenceBlindReviewRules(conference: ReviewConference): string {
  if (conference === 'ISMRM') {
    return [
      'ISMRM current platform rule set:',
      '- Abstract body: maximum 300 words; impact statement: 40 words; synopsis: 100 words.',
      '- Use a clear structured format and include quantitative results where possible.',
      '- Assess anonymity, ethics, consent, conflicts, funding, and reporting-guideline fit.',
    ].join('\n');
  }

  if (conference === 'RSNA') {
    return [
      `RSNA ${RSNA_RULESET.meetingYear} current platform rule set (${RSNA_RULESET.status}; authors must recheck the official call):`,
      `- Science abstract: ${RSNA_RULESET.science.abstractCharactersExcludingSpaces} characters excluding spaces; Clinical Relevance: ${RSNA_RULESET.science.clinicalRelevanceCharacters} characters.`,
      `- Science sections: ${RSNA_RULESET.science.sections.join(', ')}.`,
      `- Education exhibit: ${RSNA_RULESET.education.abstractCharacters} characters; sections: ${RSNA_RULESET.education.sections.join(', ')}.`,
      '- Assess anonymity, category/format fit, ethics, statistics, and source-grounded claims.',
    ].join('\n');
  }

  if (conference === 'ER') {
    return [
      'ECR current platform rule set:',
      '- Abstract body: maximum 280 words; title: maximum 200 characters.',
      '- Required content includes purpose/learning objective, methods/background, results/findings, conclusions, limitations, and funding.',
      '- Use British English; assess anonymity, conflicts, ethics, keywords, author limits, and study-specific reporting requirements.',
    ].join('\n');
  }

  const profile = getOncologyProfile(conference);
  const submissionRules = profile.submissionTypes
    .map((type) => `${type.id}: ${type.requiredSections.join(', ')}`)
    .join('; ');
  return [
    `${profile.ruleVersion} current platform rule set:`,
    `- Title, abstract body, and table text: maximum ${profile.characterLimitExcludingSpaces} characters excluding spaces.`,
    `- Submission contracts: ${submissionRules}.`,
    `- Presentation preference: ${profile.presentationPreference}.`,
    '- Assess anonymity, patient-data handling, ethics, conflicts, funding, AI-method disclosure, study maturity, and reporting-guideline fit.',
  ].join('\n');
}
