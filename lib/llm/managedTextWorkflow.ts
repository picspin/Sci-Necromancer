export type ManagedTextOperation = 'analysis' | 'generation' | 'regeneration' | 'deep_update';

interface ActiveWorkflow {
  clientKey: string;
  serverId?: string;
  analysisCount?: number;
  callCount?: number;
  generationCount?: number;
  deepUpdateCount?: number;
  updatedAt: number;
}

const workflows = new Map<string, ActiveWorkflow>();
const forcedStandalone = new Map<string, 'regeneration' | 'deep_update'>();
const STORAGE_KEY = 'sci-managed-workflows-v2';
let hydrated = false;

function createKey(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `managed-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function contextKey(context: string): string {
  let hash = 2166136261;
  for (let index = 0; index < context.length; index += 1) {
    hash ^= context.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `workflow-${(hash >>> 0).toString(36)}-${context.length}`;
}

function hydrate(): void {
  if (hydrated) return;
  hydrated = true;
  try {
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]') as Array<
      [string, ActiveWorkflow]
    >;
    for (const [key, workflow] of stored) {
      if (workflow?.clientKey && Number.isFinite(workflow.updatedAt)) workflows.set(key, workflow);
    }
  } catch {
    // Session persistence is a UX aid; the server remains authoritative.
  }
}

function persist(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...workflows.entries()]));
  } catch {
    // Private browsing/storage denial must not break generation.
  }
}

function pruneExpired(): void {
  hydrate();
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [key, workflow] of workflows) {
    if (workflow.updatedAt < cutoff) workflows.delete(key);
  }
  persist();
}

export function beginManagedTextWorkflow(context: string): string {
  pruneExpired();
  const key = contextKey(context);
  const active = workflows.get(key);
  if (active && (active.generationCount ?? 0) === 0 && (active.deepUpdateCount ?? 0) === 0) {
    active.updatedAt = Date.now();
    persist();
    return active.clientKey;
  }
  const clientKey = createKey();
  workflows.set(key, { clientKey, analysisCount: 0, updatedAt: Date.now() });
  persist();
  return clientKey;
}

export function acquireManagedTextCall(
  stage: 'analysis' | 'generation',
  context: string,
  standaloneOperation?: 'regeneration' | 'deep_update'
): { idempotencyKey: string; operation: ManagedTextOperation; workflowId?: string } {
  pruneExpired();
  const workflow = workflows.get(contextKey(context));
  const forcedOperation = forcedStandalone.get(contextKey(context));
  if (forcedOperation) {
    forcedStandalone.delete(contextKey(context));
    return { idempotencyKey: createKey(), operation: forcedOperation };
  }
  if (workflow) {
    workflow.updatedAt = Date.now();
    persist();
    return {
      idempotencyKey: workflow.clientKey,
      operation: standaloneOperation || stage,
      workflowId: workflow.serverId,
    };
  }
  if (standaloneOperation) {
    return { idempotencyKey: createKey(), operation: standaloneOperation };
  }
  return { idempotencyKey: createKey(), operation: 'regeneration' };
}

export function forceNextManagedTextCallStandalone(
  context: string,
  operation: 'regeneration' | 'deep_update'
): void {
  forcedStandalone.set(contextKey(context), operation);
}

export function registerManagedTextWorkflow(
  context: string,
  clientKey: string,
  serverId: string,
  counters?: {
    analysisCount: number;
    callCount: number;
    generationCount: number;
    deepUpdateCount: number;
  }
): void {
  const key = contextKey(context);
  const workflow = workflows.get(key);
  if (workflow?.clientKey === clientKey) {
    workflow.serverId = serverId;
    if (counters) Object.assign(workflow, counters);
    workflow.updatedAt = Date.now();
    persist();
  }
}

export function getManagedTextWorkflowState(context: string): ActiveWorkflow | null {
  pruneExpired();
  const workflow = workflows.get(contextKey(context));
  return workflow ? { ...workflow } : null;
}

export function managedTextCallRequiresNewCharge(
  context: string,
  operation: 'regeneration' | 'deep_update'
): boolean {
  const workflow = getManagedTextWorkflowState(context);
  if (!workflow?.serverId) return false;
  return operation === 'regeneration'
    ? (workflow.generationCount ?? 0) >= 1
    : (workflow.deepUpdateCount ?? 0) >= 1;
}

export function getManagedAnalysisRetryNotice(
  context: string
): 'one_free_remaining' | 'charge_applies' | null {
  const workflow = getManagedTextWorkflowState(context);
  if (!workflow?.serverId || (workflow.generationCount ?? 0) > 0) return null;
  if ((workflow.analysisCount ?? 0) === 1) return 'one_free_remaining';
  if ((workflow.analysisCount ?? 0) >= 2) return 'charge_applies';
  return null;
}

export async function prepareManagedTextReentry(
  context: string,
  operation: 'regeneration' | 'deep_update',
  chooseAction: () => Promise<'reanalyze' | 'continue' | 'cancel'>,
  restartAnalysis: () => Promise<void>
): Promise<boolean> {
  if (!managedTextCallRequiresNewCharge(context, operation)) return true;
  const choice = await chooseAction();
  if (choice === 'cancel') return false;
  if (choice === 'reanalyze') {
    await restartAnalysis();
    return false;
  }
  forceNextManagedTextCallStandalone(context, operation);
  return true;
}

export function completeManagedTextWorkflow(clientKey?: string): void {
  if (!clientKey) {
    workflows.clear();
    persist();
    return;
  }
  for (const [key, workflow] of workflows) {
    if (workflow.clientKey === clientKey) workflows.delete(key);
  }
  persist();
}

export function abandonManagedTextWorkflow(context: string): void {
  workflows.delete(contextKey(context));
  persist();
}
