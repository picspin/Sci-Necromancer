import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { baseCompile } from '@intlify/message-compiler';

function flattenKeys(value: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === 'object' && !Array.isArray(child)
      ? flattenKeys(child as Record<string, unknown>, fullKey)
      : [fullKey];
  });
}

function loadLocales() {
  const root = process.cwd();
  return {
    en: JSON.parse(
      fs.readFileSync(path.join(root, 'public/locales/en/translation.json'), 'utf8')
    ) as Record<string, unknown>,
    zh: JSON.parse(
      fs.readFileSync(path.join(root, 'public/locales/zh/translation.json'), 'utf8')
    ) as Record<string, unknown>,
  };
}

function flattenMessages(value: Record<string, unknown>): string[] {
  return Object.values(value).flatMap((child) =>
    child && typeof child === 'object' && !Array.isArray(child)
      ? flattenMessages(child as Record<string, unknown>)
      : typeof child === 'string'
        ? [child]
        : []
  );
}

describe('English and Chinese locale contract', () => {
  it('keeps the complete translation key set in parity', () => {
    const { en, zh } = loadLocales();

    expect(flattenKeys(zh).sort()).toEqual(flattenKeys(en).sort());
  });

  it('uses Vue I18n placeholders instead of nested mustache placeholders', () => {
    const { en, zh } = loadLocales();
    expect([...flattenMessages(en), ...flattenMessages(zh)]).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/\{\{[^}]+\}\}/)])
    );

    expect(() =>
      [...flattenMessages(en), ...flattenMessages(zh)].forEach((message) => baseCompile(message))
    ).not.toThrow();
  });
});
