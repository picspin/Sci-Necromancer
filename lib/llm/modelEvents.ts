export const BYOK_TEXT_FAILURE_EVENT = 'sci-necromancer:byok-text-failed';

export function announceByokTextFailure(workflowContext?: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(BYOK_TEXT_FAILURE_EVENT, { detail: { workflowContext } }));
}
