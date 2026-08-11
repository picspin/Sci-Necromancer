import { describe, expect, it } from 'vitest';
import { ESCModule } from '../modules/ESCModule';

describe('ESC release state', () => {
  it('keeps the unfinished conference module unavailable', () => {
    expect(new ESCModule().isAvailable()).toBe(false);
  });
});
