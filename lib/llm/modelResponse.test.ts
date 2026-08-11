import { describe, expect, it } from 'vitest';
import { parseStructuredModelOutput } from './modelResponse';

describe('structured model output parsing', () => {
  it('preserves a top-level array when explanatory text precedes it', () => {
    expect(
      parseStructuredModelOutput('Here is the result: [{"type":"Standard Abstract"}]')
    ).toEqual([{ type: 'Standard Abstract' }]);
  });

  it('extracts an object from a fenced or explanatory response', () => {
    expect(parseStructuredModelOutput('Result: {"keywords":["MRI"]}')).toEqual({
      keywords: ['MRI'],
    });
  });
});
