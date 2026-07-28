export type Translate = (key: string, params?: Record<string, unknown>) => string;

const CODE_TO_KEY: Record<string, string> = {
  'llm.api_key_missing': 'errors.api_key_missing',
  'blind_review.disabled': 'blind_review.disabled',
  'blind_review.no_content': 'blind_review.no_content',
  'blind_review.invalid_model_report': 'blind_review.invalid_model_report',
  'blind_review.external_request_failed': 'blind_review.external_request_failed',
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
