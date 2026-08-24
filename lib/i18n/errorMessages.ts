export type Translate = (key: string, params?: Record<string, unknown>) => string;

const CODE_TO_KEY: Record<string, string> = {
  'llm.api_key_missing': 'errors.api_key_missing',
  'blind_review.disabled': 'blind_review.disabled',
  'blind_review.no_content': 'blind_review.no_content',
  'blind_review.invalid_model_report': 'blind_review.invalid_model_report',
  'blind_review.external_request_failed': 'blind_review.external_request_failed',
  insufficient_bonus: 'errors.insufficient_bonus',
  member_insufficient_credits: 'errors.insufficient_bonus',
  unauthenticated: 'errors.member_login_required',
  member_generation_locked: 'errors.member_login_required',
  member_service_unavailable: 'errors.member_service_unavailable',
  turnstile_required: 'errors.turnstile_failed',
  turnstile_failed: 'errors.turnstile_failed',
  payment_service_unavailable: 'errors.payment_failed',
  payment_service_failed: 'errors.payment_failed',
  managed_provider_unavailable: 'errors.managed_provider_failed',
  managed_provider_failed: 'errors.managed_provider_failed',
  managed_provider_empty_output: 'errors.managed_provider_failed',
  invalid_capability_request: 'errors.invalid_capability_request',
  invalid_capability_selection: 'errors.invalid_capability_request',
  unsupported_capability: 'errors.invalid_capability_request',
  managed_image_too_large: 'errors.managed_image_too_large',
  managed_image_request_too_large: 'errors.managed_image_request_too_large',
  workflow_busy: 'errors.workflow_retry',
  workflow_completed: 'errors.workflow_retry',
  workflow_not_found: 'errors.workflow_retry',
  workflow_expired: 'errors.workflow_retry',
  workflow_exhausted: 'errors.workflow_retry',
  idempotency_key_conflict: 'errors.workflow_retry',
  invalid_workflow_transition: 'errors.workflow_retry',
  idempotency_key_refunded: 'errors.workflow_retry',
};

export function localizeError(
  error: unknown,
  t: Translate,
  fallbackKey = 'errors.unknown'
): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const code = message.split(':', 1)[0];
  if (CODE_TO_KEY[code]) return t(CODE_TO_KEY[code]);
  if (/api key|not configured|api call|valid response|network|fetch/i.test(message)) {
    return /api key|not configured/i.test(message)
      ? t('errors.api_key_missing')
      : t('errors.api_error');
  }
  const status = message.match(/\b(?:status\s*)?(\d{3})\b/i)?.[1];
  return status ? `${t(fallbackKey)} (${status})` : t(fallbackKey);
}
