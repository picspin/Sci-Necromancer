import { describe, expect, it } from 'vitest';
import { resolveLoadingScene } from './loadingScene';

describe('scientific loading scene resolver', () => {
  it.each([
    ['Analyzing content', 'dna'],
    ['正在分析内容', 'dna'],
    ['Generating abstract', 'cell'],
    ['正在生成摘要', 'cell'],
    ['Deep update in progress', 'orbital'],
    ['正在深度更新', 'orbital'],
    ['Processing manuscript.pdf', 'molecule'],
  ] as const)('maps %s to %s', (message, expected) => {
    expect(resolveLoadingScene(message)).toBe(expected);
  });
});
