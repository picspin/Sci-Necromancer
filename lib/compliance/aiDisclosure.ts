export const AI_DISCLOSURE_VERSION = '2026-07-28';
export const AI_DISCLOSURE_STORAGE_KEY = 'sci-necromancer.ai-disclosure';
export const AI_DISCLOSURE_REQUIRED_EVENT = 'sci-necromancer:ai-disclosure-required';
export const AI_EXPORT_DISCLAIMER =
  'AI-assisted draft - verification required. This service does not guarantee factual accuracy, originality, compliance, acceptance, publication, or presentation assignment. The author must independently verify all facts, statistics, citations, permissions, privacy, ethics, disclosures, and current official requirements before use.';

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
