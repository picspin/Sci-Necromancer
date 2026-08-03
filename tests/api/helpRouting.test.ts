import { describe, expect, it } from 'vitest';
import vercel from '../../vercel.json';

describe('documentation assistant deployment route', () => {
  it('rewrites the public help endpoint to the existing generation function', () => {
    expect(vercel.rewrites).toContainEqual({ source: '/api/help', destination: '/api/generate' });
  });
});
