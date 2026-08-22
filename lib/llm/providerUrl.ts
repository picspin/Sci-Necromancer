export function anthropicApiUrl(
  configuredBaseUrl: string | undefined,
  resource: 'messages' | 'models'
): string {
  const base = (configuredBaseUrl?.trim() || 'https://api.anthropic.com').replace(/\/+$/, '');
  return `${base.endsWith('/v1') ? base : `${base}/v1`}/${resource}`;
}
