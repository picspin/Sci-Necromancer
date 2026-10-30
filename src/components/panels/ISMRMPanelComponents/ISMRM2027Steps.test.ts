import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import AnalysisStep from './AnalysisStep.vue';
import TypeSuggestionStep from './TypeSuggestionStep.vue';

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));

describe('ISMRM 2027 selections', () => {
  it('exposes Tandem in the manual fallback and hides legacy Registered recommendations', () => {
    const fallback = mount(TypeSuggestionStep, { props: { suggestions: [] } });
    expect(fallback.text()).toContain('MD-PhD Tandem Abstract');
    expect(fallback.text()).not.toContain('Registered Abstract');
    const legacy = mount(TypeSuggestionStep, {
      props: { suggestions: [{ type: 'Registered Abstract', probability: 0.9 }] },
    });
    expect(legacy.text()).not.toContain('Registered Abstract');
    expect(legacy.text()).toContain('Standard Abstract');
  });

  it('allows manual recovery and two different subcategories in one category', async () => {
    const wrapper = mount(AnalysisStep, {
      props: {
        result: { categories: [], keywords: [] },
        impact: '',
        synopsis: '',
        jevClassificationOnly: true,
      },
    });
    expect(
      (wrapper.get('[data-test="confirm-ismrm-analysis"]').element as HTMLButtonElement).disabled
    ).toBe(true);
    await wrapper.get('#ismrm-primary').setValue('Body: Kidney');
    await wrapper.get('#ismrm-secondary').setValue('Body: Metabolism');
    await wrapper.get('#ismrm-custom-keyword').setValue('Renal metabolism');
    await wrapper.get('[data-test="add-ismrm-keyword"]').trigger('click');
    await wrapper.get('[data-test="confirm-ismrm-analysis"]').trigger('click');
    expect(wrapper.emitted('confirm')?.[0]?.[0]).toEqual([
      { name: 'Body: Kidney', type: 'main', probability: 1 },
      { name: 'Body: Metabolism', type: 'secondary', probability: 1 },
    ]);
    expect(wrapper.emitted('confirm')?.[0]?.[1]).toEqual(['Renal metabolism']);
  });

  it('rejects duplicate subcategories and lets authors remove excess model keywords', async () => {
    const wrapper = mount(AnalysisStep, {
      props: {
        result: { categories: [], keywords: ['a', 'b', 'c', 'd', 'e', 'f'] },
        impact: 'MRI matters.',
        synopsis: 'MRI study.',
      },
    });
    await wrapper.get('#ismrm-primary').setValue('Body: Kidney');
    await wrapper.get('#ismrm-secondary').setValue('Body: Kidney');
    expect(
      (wrapper.get('[data-test="confirm-ismrm-analysis"]').element as HTMLButtonElement).disabled
    ).toBe(true);
    await wrapper.get('#ismrm-secondary').setValue('Body: Spleen');
    expect(
      (wrapper.get('[data-test="confirm-ismrm-analysis"]').element as HTMLButtonElement).disabled
    ).toBe(true);
    await wrapper.get('[data-test="selected-ismrm-keyword-f"]').trigger('click');
    expect(
      (wrapper.get('[data-test="confirm-ismrm-analysis"]').element as HTMLButtonElement).disabled
    ).toBe(false);
  });
});
