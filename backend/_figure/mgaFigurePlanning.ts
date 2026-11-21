import { getMGAConfig } from '../_generation/providers.js';
import { MemberServiceError } from '../_member/memberService.js';
import type { MemberTextModel } from '../../lib/llm/memberTextModels.js';

const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const unavailable = () => new MemberServiceError('data_figure_provider_unavailable', 503);

// One direct request, no SDK retries, inferred actual model or Google fallback.
export async function requestMGADataFigurePlan(
  request: { system: string; user: string },
  model: MemberTextModel
) {
  if (
    !request ||
    typeof request.system !== 'string' ||
    typeof request.user !== 'string' ||
    Buffer.byteLength(request.system, 'utf8') > 2048 ||
    Buffer.byteLength(request.user, 'utf8') > 40_000 ||
    (model !== 'deepseek-v4.1-flash' && model !== 'gpt-5.6-terra')
  )
    throw new MemberServiceError('invalid_data_figure_request', 400);
  try {
    const config = getMGAConfig();
    if (!config) throw unavailable();
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(60_000),
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model === 'gpt-5.6-terra' ? 'mga-gpt-terra-5.6' : model,
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.user },
        ],
        stream: false,
        response_format: { type: 'json_object' },
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw unavailable();
    }
    if (!response.body) throw unavailable();
    const length = response.headers.get('content-length');
    if (length && (!/^\d+$/.test(length) || Number(length) > 65_536)) {
      await response.body.cancel();
      throw unavailable();
    }
    const reader = response.body.getReader(),
      decoder = new TextDecoder('utf-8', { fatal: true });
    let bytes = 0,
      text = '';
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 65_536) {
          await reader.cancel();
          throw unavailable();
        }
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      reader.releaseLock();
    }
    const payload: unknown = JSON.parse(text);
    if (
      !record(payload) ||
      typeof payload.model !== 'string' ||
      !payload.model.trim() ||
      payload.model.trim().length > 128 ||
      !Array.isArray(payload.choices)
    )
      throw unavailable();
    const choice: unknown = payload.choices[0];
    if (
      !record(choice) ||
      (choice.finish_reason !== undefined && choice.finish_reason !== 'stop') ||
      !record(choice.message) ||
      typeof choice.message.content !== 'string' ||
      !choice.message.content.trim() ||
      choice.message.refusal ||
      (Array.isArray(choice.message.tool_calls) && choice.message.tool_calls.length)
    )
      throw unavailable();
    return {
      provider: 'mga' as const,
      model: payload.model.trim(),
      text: choice.message.content.trim(),
    };
  } catch {
    throw unavailable();
  }
}
