import { describe, expect, it } from 'vitest';
import {
  hasEnabledCapabilityAdapter,
  isCapabilityGroupEnabled,
  normalizeCapabilitySettings,
  parseCapabilityManifest,
} from '../capabilityRegistry';

describe('capability registry', () => {
  it('migrates older settings to enabled Skills and MCP groups', () => {
    expect(normalizeCapabilitySettings(undefined)).toEqual({
      skillsEnabled: true,
      mcpEnabled: true,
      bundledBlindReviewSkill: true,
      managedEnabledIds: [],
      imported: [],
    });
  });

  it('loads a declarative external manifest without accepting executable commands', () => {
    const capability = parseCapabilityManifest(
      JSON.stringify({
        name: 'Literature verifier',
        kind: 'mcp',
        version: '1.0.0',
        description: 'Read-only verification adapter',
        homepage: 'https://example.org/verifier',
        adapter: 'image-generation',
        command: 'npx unsafe-package',
      }),
      'verifier.json'
    );

    expect(capability).toMatchObject({
      id: 'mcp-literature-verifier-1-0-0',
      name: 'Literature verifier',
      kind: 'mcp',
      enabled: false,
      source: 'verifier.json',
      adapter: 'image-generation',
    });
    expect(capability).not.toHaveProperty('command');
  });

  it('gates trusted imported adapters through their capability group', () => {
    const settings = {
      capabilities: {
        skillsEnabled: true,
        mcpEnabled: true,
        bundledBlindReviewSkill: true,
        managedEnabledIds: [],
        imported: [
          {
            id: 'mcp-image',
            name: 'Image adapter',
            kind: 'mcp' as const,
            adapter: 'image-generation' as const,
            source: 'image.json',
            enabled: true,
          },
        ],
      },
    };
    expect(isCapabilityGroupEnabled(settings, 'mcp')).toBe(true);
    expect(hasEnabledCapabilityAdapter(settings, 'mcp', 'image-generation')).toBe(true);
    settings.capabilities.mcpEnabled = false;
    expect(hasEnabledCapabilityAdapter(settings, 'mcp', 'image-generation')).toBe(false);
  });

  it('rejects invalid kinds and non-HTTPS homepages', () => {
    expect(() => parseCapabilityManifest('{"name":"Bad","kind":"plugin"}', 'bad.json')).toThrow();
    expect(() =>
      parseCapabilityManifest(
        '{"name":"Bad MCP","kind":"mcp","homepage":"http://example.org"}',
        'bad.json'
      )
    ).toThrow();
    expect(() =>
      parseCapabilityManifest(
        '{"name":"Wrong binding","kind":"skill","adapter":"image-generation"}',
        'wrong.json'
      )
    ).toThrow();
  });
});
