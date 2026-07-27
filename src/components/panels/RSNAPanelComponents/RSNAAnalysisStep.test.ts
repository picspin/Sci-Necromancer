import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import type { AnalysisResult } from '@/types';
import RSNAAnalysisStep from './RSNAAnalysisStep.vue';

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale: { value: 'en' },
    t: (key: string) =>
      ({
        'rsna.regular': 'Regular Call',
        'rsna.science': 'Science',
        'rsna.formats.scientific_paper': 'Scientific Paper',
      })[key] ?? key,
  }),
}));

const result: AnalysisResult = {
  categories: [
    { name: 'Neuroradiology', type: 'main', probability: 0.82 },
    { name: 'Physics', type: 'main', probability: 0.61 },
  ],
  keywords: ['MRI', 'Artificial Intelligence/Machine Learning', 'Validation Studies'],
  rsna: {
    track: 'regular',
    contentType: 'science',
    primaryPresentationFormat: 'scientific-paper',
    alternativePresentationFormats: ['digital-presentation'],
    reportingGuidelines: ['TRIPOD+AI for Abstracts'],
    confidence: 0.82,
    rationale: ['Hypothesis-driven prediction model'],
    warnings: ['Detailed 2026 rules are provisional.'],
    ruleVersion: 'RSNA-2026-provisional-2023-fallback',
  },
};

describe('RSNAAnalysisStep', () => {
  it('shows the three-layer recommendation and confirms exactly one category', async () => {
    const wrapper = mount(RSNAAnalysisStep, { props: { result } });

    expect(wrapper.text()).toContain('Regular Call');
    expect(wrapper.text()).toContain('Science');
    expect(wrapper.text()).toContain('Scientific Paper');
    expect(wrapper.text()).toContain('TRIPOD+AI for Abstracts');

    const categoryInputs = wrapper.findAll('input[name="rsna-category"]');
    expect(categoryInputs).toHaveLength(2);
    expect((categoryInputs[0].element as HTMLInputElement).checked).toBe(true);

    await wrapper.get('[data-test="confirm-rsna-analysis"]').trigger('click');
    const confirmation = wrapper.emitted('confirm')?.[0];
    expect(confirmation?.[0]).toMatchObject({ name: 'Neuroradiology' });
    expect(confirmation?.[1]).toEqual([
      'MRI',
      'Artificial Intelligence/Machine Learning',
      'Validation Studies',
    ]);
    expect(confirmation?.[2]).toMatchObject({
      track: 'regular',
      contentType: 'science',
      primaryPresentationFormat: 'scientific-paper',
    });
  });
});
