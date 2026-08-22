import type { AIAssistanceRecord, GenerationMode } from '../../types';

export const AI_DISCLOSURE_VERSION = '2026-07-28';
export const AI_DISCLOSURE_STORAGE_KEY = 'sci-necromancer.ai-disclosure';
export const AI_DISCLOSURE_REQUIRED_EVENT = 'sci-necromancer:ai-disclosure-required';
export const AI_EXPORT_DISCLAIMER =
  'AI-assisted draft - verification required. This service does not guarantee factual accuracy, originality, compliance, acceptance, publication, or presentation assignment. The author must independently verify all facts, statistics, citations, permissions, privacy, ethics, disclosures, and current official requirements before use.';

export const AI_ASSISTANCE_BOUNDARIES = [
  'source data',
  'factual claims',
  'statistics',
  'references',
  'ethics and consent requirements',
  'permissions',
  'current submission requirements',
] as const;

const AI_ASSISTANCE_PLATFORM: AIAssistanceRecord['platform'] = {
  name: 'Sci-Necromancer',
  project: 'picspin/Sci-Necromancer',
  url: 'https://www.rad-sci.org',
};

export function createAIAssistanceRecord(input: {
  provider: AIAssistanceRecord['provider'];
  providerDisplayName?: string;
  model: string;
  mode: GenerationMode;
  operations: string[];
  modelType?: AIAssistanceRecord['modelType'];
  methodsDisclosureRequired?: boolean;
  generatedAt?: string;
}): AIAssistanceRecord {
  return {
    disclosureVersion: 'jama-2026-v1',
    platform: AI_ASSISTANCE_PLATFORM,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    provider: input.provider,
    providerDisplayName: input.providerDisplayName ?? providerNames[input.provider],
    model: input.model,
    modelType: input.modelType ?? 'large-language-model',
    mode: input.mode,
    operations: [...new Set(input.operations)],
    boundaries: [...AI_ASSISTANCE_BOUNDARIES],
    methodsDisclosureRequired: input.methodsDisclosureRequired ?? false,
    authorVerificationRequired: true,
  };
}

const providerNames: Record<AIAssistanceRecord['provider'], string> = {
  google: 'Google',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  mga: 'MGA',
};

function formatList(values: string[], conjunction: 'and' | 'or'): string {
  if (values.length < 2) return values[0] ?? '';
  if (values.length === 2) return `${values[0]} ${conjunction} ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, ${conjunction} ${values.at(-1)}`;
}

export function buildAIAcknowledgement(record: AIAssistanceRecord): string {
  const platform = record.platform ?? AI_ASSISTANCE_PLATFORM;
  const modelType = (record.modelType ?? 'large-language-model').replace(/-/g, ' ');
  const operations = formatList(
    record.operations?.length ? record.operations : ['AI assistance'],
    'and'
  );
  const boundaries = formatList(
    record.boundaries?.length ? record.boundaries : [...AI_ASSISTANCE_BOUNDARIES],
    'or'
  );
  const providerName =
    record.providerDisplayName ?? providerNames[record.provider] ?? String(record.provider);
  const generatedDate = record.generatedAt?.slice(0, 10) || 'an unrecorded date';
  return [
    `The authors used ${platform.name} (PicSpin project: ${platform.project}; ${platform.url}) with the ${record.model} ${modelType} provided through ${providerName} on ${generatedDate} to assist with ${operations}.`,
    `The system was used only as an assistive tool and did not independently verify ${boundaries}; it did not assume authorship or scientific responsibility.`,
    'The authors reviewed the AI-assisted content and take full responsibility for its accuracy, integrity, originality, and compliance.',
  ].join(' ');
}

export function buildMethodsDisclosureNote(record: AIAssistanceRecord): string | null {
  return record.methodsDisclosureRequired
    ? 'Because AI assistance formed part of the research process, its use should also be described in the Methods section; an acknowledgment alone is not sufficient.'
    : null;
}

export function collectAIAssistanceRecords(input: {
  aiAssistance?: AIAssistanceRecord;
  aiAssistanceRecords?: AIAssistanceRecord[];
}): AIAssistanceRecord[] {
  const records = [input.aiAssistance, ...(input.aiAssistanceRecords ?? [])].filter(
    (record): record is AIAssistanceRecord => Boolean(record)
  );
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = [
      record.provider,
      record.providerDisplayName,
      record.model,
      record.modelType,
      record.generatedAt,
      record.operations?.join('|'),
    ].join('::');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const TRUSTED_AI_ASSISTANCE = Symbol('sci-necromancer.trusted-ai-assistance');

export function markTrustedAIAssistance<T extends object>(value: T, record: AIAssistanceRecord): T {
  Object.defineProperty(value, TRUSTED_AI_ASSISTANCE, {
    value: record,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return value;
}

export function getTrustedAIAssistance(value: object): AIAssistanceRecord | undefined {
  return (value as { [TRUSTED_AI_ASSISTANCE]?: AIAssistanceRecord })[TRUSTED_AI_ASSISTANCE];
}

interface StoredAIDisclosureAcceptance {
  version: string;
  acceptedAt: string;
}

const getStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
};

export const hasAcceptedAIDisclosure = (): boolean => {
  const storage = getStorage();
  if (!storage) return false;

  try {
    const saved = storage.getItem(AI_DISCLOSURE_STORAGE_KEY);
    if (!saved) return false;
    const acceptance = JSON.parse(saved) as StoredAIDisclosureAcceptance;
    return acceptance.version === AI_DISCLOSURE_VERSION && Boolean(acceptance.acceptedAt);
  } catch {
    return false;
  }
};

export const acceptAIDisclosure = (): void => {
  getStorage()?.setItem(
    AI_DISCLOSURE_STORAGE_KEY,
    JSON.stringify({ version: AI_DISCLOSURE_VERSION, acceptedAt: new Date().toISOString() })
  );
};

export const clearAIDisclosureAcceptance = (): void => {
  getStorage()?.removeItem(AI_DISCLOSURE_STORAGE_KEY);
};

export const requireAIDisclosureAcceptance = (): void => {
  if (hasAcceptedAIDisclosure()) return;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AI_DISCLOSURE_REQUIRED_EVENT));
  }
  throw new Error('AI_DISCLOSURE_REQUIRED');
};
