import type { AnalysisResult, Conference } from '../../types';
import { createAIAssistanceRecord, markTrustedAIAssistance } from '../compliance/aiDisclosure';
import { canUseJev, useMembership } from '../../src/composables/useMembership';

const JEV_ENABLED = import.meta.env.VITE_TYPESAFE_JEV_ENABLED?.trim() === 'true';
const JEV_CONFERENCES = new Set<Conference>(['ISMRM', 'JACC']);

export async function tryJevContentAnalysis(
  text: string,
  conference: Conference
): Promise<AnalysisResult | null> {
  if (!JEV_ENABLED || !JEV_CONFERENCES.has(conference) || !canUseJev()) return null;

  try {
    const result = await useMembership().memberApi.jevAnalyze({
      text,
      conference,
    });
    if (result.preflight.needsReview) return null;

    return markTrustedAIAssistance(
      result.analysis,
      createAIAssistanceRecord({
        provider: 'typesafe',
        providerDisplayName: 'TypeSafe',
        model: result.model,
        mode: 'standard',
        operations: [`${conference} Jev content classification`],
      })
    );
  } catch {
    // Jev is an optional fast path. Preserve the existing provider fallback when it is disabled,
    // unavailable, unauthenticated, or uncertain.
    return null;
  }
}
