import { describe, expect, it } from 'vitest';
import { ASCOModule } from '../modules/ASCOModule';
import { ESMOModule } from '../modules/ESMOModule';

describe('oncology conference modules', () => {
  it('exposes ASCO and ESMO as available rule-aware conference modules', () => {
    const asco = new ASCOModule();
    const esmo = new ESMOModule();

    expect(asco.id).toBe('ASCO');
    expect(esmo.id).toBe('ESMO');
    expect(asco.abstractTypes).toContain('ASCO Trials in Progress');
    expect(esmo.abstractTypes).toContain('ESMO Late-Breaking Abstract');
    expect(asco.getCategories()).toContainEqual(
      expect.objectContaining({ name: 'Breast Cancer', type: 'main' })
    );
    expect(esmo.getCategories()).toContainEqual(
      expect.objectContaining({ name: 'AI for diagnostics and profiling', type: 'main' })
    );
    expect(asco.isAvailable()).toBe(true);
    expect(esmo.isAvailable()).toBe(true);
  });
});
