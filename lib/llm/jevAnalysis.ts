import type { AnalysisResult, Conference } from '../../types';
import { createAIAssistanceRecord, markTrustedAIAssistance } from '../compliance/aiDisclosure';
import { canUseJev, useMembership } from '../../src/composables/useMembership';
import {
  abandonManagedTextWorkflow,
  beginManagedTextWorkflow,
  registerManagedTextWorkflow,
} from './managedTextWorkflow';
import { getLockedTextModel } from './textModelWorkflow';

const JEV_CONFERENCES = new Set<Conference>(['ISMRM', 'RSNA', 'ER', 'ASCO', 'ESMO', 'JACC']);
const inFlightAnalysis = new Map<string, Promise<AnalysisResult>>();

export function canUseJevForConference(conference: Conference): boolean {
  return JEV_CONFERENCES.has(conference) && canUseJev();
}

export async function analyzeJevContent(
  text: string,
  conference: Conference,
  workflowContext: string
): Promise<AnalysisResult> {
  if (!canUseJevForConference(conference)) throw new Error('typesafe_jev_unavailable');
  const existing = inFlightAnalysis.get(workflowContext);
  if (existing) return existing;

  const operation = (async () => {
    const lockedModel = getLockedTextModel(workflowContext);
    if (
      lockedModel?.source !== 'managed' ||
      (lockedModel.model !== 'glm-5.2' && lockedModel.model !== 'gpt-5.6-luna')
    )
      throw new Error('typesafe_jev_unavailable');
    // A Jev analysis begins a fresh no-charge staged workflow, even if a prior
    // LLM analysis for this context exists. The server binds the key to its own
    // canonical digest and remains authoritative for future generation charges.
    abandonManagedTextWorkflow(workflowContext);
    const clientKey = beginManagedTextWorkflow(workflowContext);
    const result = await useMembership().memberApi.jevAnalyze({
      text,
      conference,
      idempotencyKey: clientKey,
      model: lockedModel.model,
    });
    registerManagedTextWorkflow(workflowContext, clientKey, result.workflowId, result.workflow);

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
  })();
  inFlightAnalysis.set(workflowContext, operation);
  try {
    return await operation;
  } finally {
    if (inFlightAnalysis.get(workflowContext) === operation)
      inFlightAnalysis.delete(workflowContext);
  }
}
