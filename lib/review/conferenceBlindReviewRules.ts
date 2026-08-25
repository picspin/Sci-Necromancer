import type { Conference } from '@/types';
import { RSNA_RULESET } from '@/lib/conference/rsnaRules';
import { getOncologyProfile } from '@/lib/conference/oncologyRules';

type ReviewConference = Exclude<Conference, 'IMAGE' | 'JACC' | 'ESC'>;

export function getConferenceBlindReviewRules(conference: ReviewConference): string {
  if (conference === 'ISMRM') {
    return [
      'ISMRM platform-configured rule set (no verified rule version is stored; authors must recheck the official call):',
      '- Source: https://www.ismrm.org/26m/call/',
      '- Abstract body: maximum 300 words; impact statement: 40 words; synopsis: 100 words.',
      '- Submission types: Standard Abstract, MRI in Clinical Practice Abstract, ISMRT Abstract, and Registered Abstract.',
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
      'ECR platform-configured rule set (no verified rule version is stored; authors must recheck the official call):',
      '- Source: https://www.myesr.org/abstractsubmission',
      '- Abstract body: maximum 280 words; title: maximum 200 characters; impact statement: 50 words; synopsis: 100 words.',
      '- Title: no full stop, trade names, or special symbols.',
      '- Required content includes purpose/learning objective, methods/background, results/findings, conclusions, limitations, and funding.',
      '- Use British English; spell out numbers below 10; each section must be a complete paragraph ending with a full stop.',
      '- Maximum 9 authors; up to 10 images for posters; up to 3 keywords per column with one keyword per category mandatory.',
      '- Declare conflicts of interest for every author; assess anonymity, ethics approval, mandatory limitations/funding, and study-specific reporting requirements.',
    ].join('\n');
  }

  const profile = getOncologyProfile(conference);
  const submissionRules = profile.submissionTypes
    .map((type) => `${type.id}: ${type.requiredSections.join(', ')}`)
    .join('; ');
  const conferenceSpecificRules =
    conference === 'ASCO'
      ? '- ASCO tables: at most one table with no more than 10 rows.'
      : '- ESMO limits: at most one table of no more than 600 characters; no more than 20 authors; clinical or translational patient-data abstracts require an independent practicing physician or investigator as presenter; AI use affecting research data must be described in Methods.';
  return [
    `${profile.ruleVersion} platform profile (authors must recheck the official call):`,
    `- Combined title, abstract body, and table text: maximum ${profile.characterLimitExcludingSpaces} characters excluding spaces.`,
    `- Submission contracts: ${submissionRules}.`,
    `- Presentation preference: ${profile.presentationPreference}.`,
    '- Trial-in-progress abstracts must not include results or preliminary data. Case reports and figures are not allowed; at least one keyword is required.',
    conferenceSpecificRules,
    '- Assess anonymity, patient-data handling, ethics, conflicts, funding, AI-method disclosure, study maturity, and reporting-guideline fit.',
  ].join('\n');
}
