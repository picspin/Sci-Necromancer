import type { AIAssistanceRecord, AIProvider } from '../../types';

export interface TextModelSnapshot {
  source: 'byok' | 'managed';
  provider: AIProvider | 'mga';
  providerDisplayName?: string;
  model: string;
}

const lockedModels = new Map<string, TextModelSnapshot>();
const assistanceRecords = new Map<string, AIAssistanceRecord[]>();
export const TEXT_MODEL_WORKFLOW_EVENT = 'sci-necromancer:text-model-workflow-changed';

function announceChange(context?: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TEXT_MODEL_WORKFLOW_EVENT, { detail: { context } }));
}

export function lockTextModelForAnalysis(
  context: string,
  snapshot: TextModelSnapshot
): TextModelSnapshot {
  const existing = lockedModels.get(context);
  if (existing) return { ...existing };
  lockedModels.set(context, { ...snapshot });
  announceChange(context);
  return { ...snapshot };
}

export function getLockedTextModel(context: string): TextModelSnapshot | null {
  const snapshot = lockedModels.get(context);
  return snapshot ? { ...snapshot } : null;
}

export function recordTextWorkflowAssistance(context: string, record: AIAssistanceRecord): void {
  const records = assistanceRecords.get(context) ?? [];
  assistanceRecords.set(context, [...records, record]);
  announceChange(context);
}

export function getTextWorkflowAssistance(context: string): AIAssistanceRecord[] {
  return (assistanceRecords.get(context) ?? []).map((record) => ({ ...record }));
}

function clearTextModelWorkflow(context: string): void {
  lockedModels.delete(context);
  assistanceRecords.delete(context);
  announceChange(context);
}

export function completeTextModelGeneration(context: string): void {
  clearTextModelWorkflow(context);
}

export function releaseTextModelWorkflow(context: string): void {
  clearTextModelWorkflow(context);
}

export function clearTextModelWorkflows(): void {
  lockedModels.clear();
  assistanceRecords.clear();
  announceChange();
}
