export type ManagedTextOperation =
  | 'analysis'
  | 'synopsis'
  | 'type'
  | 'generation'
  | 'regeneration'
  | 'deep_update';

interface ActiveWorkflow {
  clientKey: string;
  serverId?: string;
  updatedAt: number;
}

const workflows = new Map<string, ActiveWorkflow>();

function createKey(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `managed-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function contextKey(context: string): string {
  return context;
}

function pruneExpired(): void {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [key, workflow] of workflows) {
    if (workflow.updatedAt < cutoff) workflows.delete(key);
  }
}

export function beginManagedTextWorkflow(context: string): string {
  pruneExpired();
  const clientKey = createKey();
  workflows.set(contextKey(context), { clientKey, updatedAt: Date.now() });
  return clientKey;
}

export function acquireManagedTextCall(
  stage: 'analysis' | 'synopsis' | 'type' | 'generation',
  context: string,
  standaloneOperation?: 'regeneration' | 'deep_update'
): { idempotencyKey: string; operation: ManagedTextOperation; workflowId?: string } {
  pruneExpired();
  if (standaloneOperation) {
    return { idempotencyKey: createKey(), operation: standaloneOperation };
  }
  const workflow = workflows.get(contextKey(context));
  if (workflow) {
    workflow.updatedAt = Date.now();
    return {
      idempotencyKey: workflow.clientKey,
      operation: stage,
      workflowId: workflow.serverId,
    };
  }
  return { idempotencyKey: createKey(), operation: 'regeneration' };
}

export function registerManagedTextWorkflow(
  context: string,
  clientKey: string,
  serverId: string
): void {
  const key = contextKey(context);
  const workflow = workflows.get(key);
  if (workflow?.clientKey === clientKey) {
    workflow.serverId = serverId;
    workflow.updatedAt = Date.now();
  }
}

export function completeManagedTextWorkflow(clientKey?: string): void {
  if (!clientKey) {
    workflows.clear();
    return;
  }
  for (const [key, workflow] of workflows) {
    if (workflow.clientKey === clientKey) workflows.delete(key);
  }
}

export function abandonManagedTextWorkflow(context: string): void {
  workflows.delete(contextKey(context));
}
