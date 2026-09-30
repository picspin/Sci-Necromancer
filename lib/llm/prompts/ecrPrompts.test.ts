import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCreativeECRAbstractPrompt, getECRAbstractByTypePrompt } from './ecrPrompts';

afterEach(() => vi.unstubAllGlobals());

describe('ECR 2027 writing prompts', () => {
  it('keeps standard polishing source-grounded and uses conditional fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ text: async () => 'ECR 2027 test guidance' })
    );

    const prompt = await getECRAbstractByTypePrompt(
      'MRI detected nodules in 20 patients.',
      '',
      '',
      'ECR Research Presentation',
      [],
      ['MRI']
    );

    expect(prompt).toContain('ECR 2027 ABSTRACT STRUCTURE');
    expect(prompt).toContain('conditional fields');
    expect(prompt).toContain('No references, acknowledgements, graphics, tables or figures');
    expect(prompt).toContain('never invent it');
    expect(prompt).toContain('9-minute oral presentation');
    expect(prompt).not.toContain('5-minute oral presentation');
  });

  it('does not invite fabricated scientific results from a core idea', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ text: async () => 'ECR 2027 test guidance' })
    );

    const prompt = await getCreativeECRAbstractPrompt('MRI screening of pulmonary nodules');

    expect(prompt).toContain('[author to verify]');
    expect(prompt).toContain(
      'Do not fabricate research methods, participants, results, statistics or ethics approval'
    );
    expect(prompt).not.toContain('Invent realistic');
    expect(prompt).toContain('ESR portal AI-use checkbox');
  });
});
