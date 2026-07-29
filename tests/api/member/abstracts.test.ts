import { describe, expect, it } from 'vitest';
import { sanitizeAbstractPayload } from '../../../api/member/abstracts';

describe('member abstract cloud payload', () => {
  it('keeps only generated abstract fields and recursively drops sensitive extras', () => {
    const result = sanitizeAbstractPayload({
      abstractType: 'RSNA Science Abstract',
      originalText: 'private source',
      apiKey: 'secret',
      keywords: ['MRI'],
      abstractData: {
        abstract: 'Generated abstract',
        impact: 'Impact',
        synopsis: 'Synopsis',
        keywords: ['MRI'],
        image: 'data:image/png;base64,secret',
        nested: { originalText: 'private source' },
      },
    });

    expect(JSON.stringify(result)).not.toMatch(/private source|apiKey|base64|nested/);
    expect(result).toMatchObject({
      abstractType: 'RSNA Science Abstract',
      abstractData: { abstract: 'Generated abstract' },
    });
  });
});
