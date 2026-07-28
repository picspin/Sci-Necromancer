import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function flattenKeys(value: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === 'object' && !Array.isArray(child)
      ? flattenKeys(child as Record<string, unknown>, fullKey)
      : [fullKey];
  });
}

describe('English and Chinese locale contract', () => {
  it('keeps the complete translation key set in parity', () => {
    const root = process.cwd();
    const en = JSON.parse(
      fs.readFileSync(path.join(root, 'public/locales/en/translation.json'), 'utf8')
    ) as Record<string, unknown>;
    const zh = JSON.parse(
      fs.readFileSync(path.join(root, 'public/locales/zh/translation.json'), 'utf8')
    ) as Record<string, unknown>;

    expect(flattenKeys(zh).sort()).toEqual(flattenKeys(en).sort());
  });
});
