import { afterEach, describe, expect, it, vi } from 'vitest';
import { ISMRMModule } from '../../conference/modules/ISMRMModule';
import { getConferenceBlindReviewRules } from '../../review/conferenceBlindReviewRules';
import {
  getAnalysisPrompt,
  getAbstractTypeRoutingPrompt,
  getCreativeAbstractPrompt,
  getFinalAbstractPrompt,
  routeAbstractType,
  applyOccamsRazor,
} from './ismrmPrompts';
import { getAbstractByTypePrompt, getCreativeAbstractByTypePrompt } from './abstractSpecPrompts';
import { callForAbstractsGuidance, categoryAndKeywordsList } from './ismrmData';
import type { AbstractType, Category } from '../../../types';
import { GuidelineService } from '../../conference/GuidelineService';

afterEach(() => vi.unstubAllGlobals());

describe('ISMRM 2027 rule parity', () => {
  const module = new ISMRMModule();
  const draft = {
    title: 'MRI study',
    abstract: 'MRI '.repeat(750).trim(),
    impact: 'Useful MRI finding.',
    synopsis: 'A source-grounded summary.',
    keywords: ['MRI'],
  };

  it('uses the current call and offers Tandem but not the unconfirmed Registered route', () => {
    expect(module.submissionUrl).toBe('https://www.ismrm.org/27m/call/');
    expect(module.abstractTypes).toContain('MD-PhD Tandem Abstract');
    expect(module.abstractTypes).not.toContain('Registered Abstract');
    expect(module.guidelines.wordLimits.abstract).toBe(750);
  });

  it('accepts 750 body words, excludes references, and rejects 751', () => {
    expect(module.validateAbstract(draft).isValid).toBe(true);
    expect(
      module.validateAbstract({
        ...draft,
        abstract: `${draft.abstract}\nREFERENCES\n${'citation '.repeat(100)}`,
      }).isValid
    ).toBe(true);
    expect(module.validateAbstract({ ...draft, abstract: `${draft.abstract} extra` }).isValid).toBe(
      false
    );
  });

  it('enforces title and portal keyword limits without banning custom keywords', () => {
    expect(module.validateAbstract({ ...draft, title: 'x'.repeat(126) }).isValid).toBe(false);
    expect(
      module.validateAbstract({ ...draft, keywords: ['a', 'b', 'c', 'd', 'e', 'f'] }).isValid
    ).toBe(false);
    expect(
      module.validateAbstract({ ...draft, keywords: ['A custom research keyword'] }).isValid
    ).toBe(true);
  });

  it('has the complete 2027 coded taxonomy and independent general keywords', () => {
    expect(module.getCategories()).toHaveLength(184);
    for (const name of [
      'Body: Metabolism',
      'Body: Kidney',
      'Body: Spleen',
      'Cardiovascular: Myocardial Infarct',
      'Contrast Mechanisms: Diffusion',
      'Diffusion: Exchange',
      'Diffusion: Diffusion Time Dependence',
      'Neuro: Vascular Dementia',
    ]) {
      expect(module.getCategories().map((c) => c.name)).toContain(name);
    }
    expect(module.getKeywords()).toContain('Age');
    expect(module.getKeywords()).toContain('High Field');
    expect(module.getKeywords()).toHaveLength(96);
    expect(new Set(module.getKeywords()).size).toBe(96);
    expect(new Set(module.getCategories().map((c) => c.name)).size).toBe(184);
    expect(categoryAndKeywordsList).toContain('419');
  });

  it('retains distinct subcategories from the same primary category', () => {
    expect(
      applyOccamsRazor([
        { name: 'Body: Kidney', type: 'main', probability: 0.9 },
        { name: 'Body: Metabolism', type: 'secondary', probability: 0.6 },
      ])
    ).toHaveLength(2);
    expect(routeAbstractType([]).some((s) => s.type === 'Registered Abstract')).toBe(false);
  });

  it('embeds current guidance without depending on browser-only relative fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const prompt = await getAnalysisPrompt('MRI renal metabolism study');
    expect(prompt).toContain('2027');
    expect(prompt).toContain('Diffusion Time Dependence');
    expect(prompt).toContain('one General keyword');
    expect(prompt).not.toContain('3-7');
    expect(callForAbstractsGuidance).not.toContain('200-250');
    expect(callForAbstractsGuidance).toContain('Deep Dive into New Dimensions');
  });

  it('routes by study/author evidence rather than organ names or future tense', async () => {
    const prompt = await getAbstractTypeRoutingPrompt('MRI study', []);
    expect(prompt).toContain('MD-PhD Tandem Abstract');
    expect(prompt).toContain('clinical expert');
    expect(prompt).not.toContain('future = prospective');
    expect(prompt).not.toContain('likely Clinical Practice');
    expect(routeAbstractType([{ name: 'Body: Kidney', type: 'main', probability: 0.9 }])).toEqual(
      []
    );
  });

  it('does not reuse an unexpired 2026 browser guideline cache', async () => {
    GuidelineService.clearCache('ISMRM');
    localStorage.setItem(
      'guideline_ISMRM',
      JSON.stringify({ content: 'ISMRM 2026 Cape Town', timestamp: Date.now() })
    );
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: true, text: async () => 'ISMRM-2027-2026-10-11 current guidance' })
    );
    expect(await GuidelineService.loadGuideline('ISMRM')).toContain('ISMRM-2027-2026-10-11');
    GuidelineService.clearCache('ISMRM');
  });

  it.each([
    getFinalAbstractPrompt,
    async (
      text: string,
      type: AbstractType,
      cats: Category[],
      keys: string[],
      impact: string,
      synopsis: string
    ) => getAbstractByTypePrompt(text, impact, synopsis, type, cats, keys),
  ])('keeps the clinical synopsis unstructured in each generation path', async (generate) => {
    const prompt = await generate(
      'MRI changed care.',
      'MRI in Clinical Practice Abstract',
      [],
      ['MRI'],
      '',
      ''
    );
    expect(prompt).toContain('Clinical Presentation and Assessment');
    expect(prompt).toContain('unstructured');
    expect(prompt).toContain('750');
    expect(prompt).toContain('Acknowledgements');
  });

  it('creative drafts do not invent submission-ready experimental results', async () => {
    for (const prompt of [
      await getCreativeAbstractPrompt('Renal MRI'),
      await getCreativeAbstractByTypePrompt('Renal MRI', 'Standard Abstract'),
    ]) {
      expect(prompt).toContain('[author to verify]');
      expect(prompt).not.toMatch(/Invent scientifically|Invent plausible|Invent plausible data/i);
    }
  });

  it('rejects the historical Registered route for new 2027 generation', async () => {
    await expect(
      getFinalAbstractPrompt('MRI study', 'Registered Abstract', [], [], '', '')
    ).rejects.toThrow('not a verified ISMRM 2027');
    await expect(
      getAbstractByTypePrompt('MRI study', '', '', 'Registered Abstract', [], [])
    ).rejects.toThrow('not a verified ISMRM 2027');
  });

  it('uses the same current limits and type-specific rules for blind review', () => {
    const rules = getConferenceBlindReviewRules('ISMRM');
    expect(rules).toContain('2027');
    expect(rules).toContain('750');
    expect(rules).toContain('MD-PhD Tandem');
    expect(rules).toContain('unstructured');
    expect(rules).not.toContain('maximum 300');
  });
});
