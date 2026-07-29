import type {
  CapabilityAdapter,
  CapabilityKind,
  CapabilitySettings,
  ImportedCapability,
  Settings,
} from '@/types';

const CAPABILITY_ADAPTERS = new Set<CapabilityAdapter>([
  'academic-abstract-blind-review',
  'image-generation',
]);

export const DEFAULT_CAPABILITY_SETTINGS: CapabilitySettings = {
  skillsEnabled: true,
  mcpEnabled: true,
  bundledBlindReviewSkill: true,
  managedEnabledIds: [],
  imported: [],
};

function cleanText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim().slice(0, maxLength);
  return cleaned || undefined;
}

function safeHttpsUrl(value: unknown): string | undefined {
  const text = cleanText(value, 1000);
  if (!text) return undefined;
  const url = new URL(text);
  if (url.protocol !== 'https:') throw new Error('capabilities.https_required');
  return url.toString();
}

function cleanAdapter(value: unknown): CapabilityAdapter | undefined {
  const adapter = cleanText(value, 80) as CapabilityAdapter | undefined;
  return adapter && CAPABILITY_ADAPTERS.has(adapter) ? adapter : undefined;
}

function adapterMatchesKind(adapter: CapabilityAdapter, kind: CapabilityKind): boolean {
  return (
    (adapter === 'academic-abstract-blind-review' && kind === 'skill') ||
    (adapter === 'image-generation' && kind === 'mcp')
  );
}

function capabilityId(kind: CapabilityKind, name: string, version?: string): string {
  const slug = [kind, name, version]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
  if (!slug) throw new Error('capabilities.invalid_manifest');
  return slug;
}

export function parseCapabilityManifest(json: string, source: string): ImportedCapability {
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new Error('capabilities.invalid_json');
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('capabilities.invalid_manifest');
  }
  const name = cleanText(manifest.name, 100);
  const kind = manifest.kind;
  if (!name || (kind !== 'skill' && kind !== 'mcp')) {
    throw new Error('capabilities.invalid_manifest');
  }
  const version = cleanText(manifest.version, 40);
  const adapter = cleanAdapter(manifest.adapter);
  if (adapter && !adapterMatchesKind(adapter, kind)) {
    throw new Error('capabilities.invalid_manifest');
  }
  return {
    id: capabilityId(kind, name, version),
    name,
    kind,
    ...(version ? { version } : {}),
    ...(cleanText(manifest.description, 500)
      ? { description: cleanText(manifest.description, 500) }
      : {}),
    ...(manifest.homepage ? { homepage: safeHttpsUrl(manifest.homepage) } : {}),
    ...(adapter ? { adapter } : {}),
    source: cleanText(source, 200) || 'manifest.json',
    enabled: false,
  };
}

export function normalizeCapabilitySettings(
  value?: Partial<CapabilitySettings>
): CapabilitySettings {
  const imported = Array.isArray(value?.imported)
    ? value.imported
        .filter(
          (item): item is ImportedCapability =>
            Boolean(item) &&
            typeof item.id === 'string' &&
            typeof item.name === 'string' &&
            (item.kind === 'skill' || item.kind === 'mcp')
        )
        .slice(0, 20)
        .map((item) => {
          const adapter = cleanAdapter(item.adapter);
          return {
            id: cleanText(item.id, 100)!,
            name: cleanText(item.name, 100)!,
            kind: item.kind,
            ...(cleanText(item.version, 40) ? { version: cleanText(item.version, 40) } : {}),
            ...(cleanText(item.description, 500)
              ? { description: cleanText(item.description, 500) }
              : {}),
            ...(adapter && adapterMatchesKind(adapter, item.kind) ? { adapter } : {}),
            source: cleanText(item.source, 200) || 'manifest.json',
            enabled: Boolean(item.enabled),
          };
        })
    : [];
  return {
    skillsEnabled: value?.skillsEnabled !== false,
    mcpEnabled: value?.mcpEnabled !== false,
    bundledBlindReviewSkill: value?.bundledBlindReviewSkill !== false,
    managedEnabledIds: Array.isArray(value?.managedEnabledIds)
      ? [
          ...new Set(
            value.managedEnabledIds
              .filter((id): id is string => typeof id === 'string')
              .map((id) => id.trim().slice(0, 100))
              .filter(Boolean)
          ),
        ].slice(0, 20)
      : [],
    imported,
  };
}

export function isCapabilityGroupEnabled(
  settings: Pick<Settings, 'capabilities'>,
  kind: CapabilityKind
): boolean {
  const capabilities = normalizeCapabilitySettings(settings.capabilities);
  return kind === 'skill' ? capabilities.skillsEnabled : capabilities.mcpEnabled;
}

export function hasEnabledCapabilityAdapter(
  settings: Pick<Settings, 'capabilities'>,
  kind: CapabilityKind,
  adapter: CapabilityAdapter
): boolean {
  const capabilities = normalizeCapabilitySettings(settings.capabilities);
  if (!(kind === 'skill' ? capabilities.skillsEnabled : capabilities.mcpEnabled)) return false;
  return capabilities.imported.some(
    (capability) => capability.kind === kind && capability.enabled && capability.adapter === adapter
  );
}
