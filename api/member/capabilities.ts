import type { VercelRequest, VercelResponse } from '../../backend/_types/vercel.js';
import {
  assertResearchAgent,
  listMemberCapabilities,
  resolveResearchToolKeys,
} from '../../backend/_capabilities/capabilityRegistry.js';
import { callMGAResearchAgent } from '../../backend/_generation/providers.js';
import { prepareMemberBlindReview } from '../../backend/_jev/blindPreflightWorkflow.js';
import { runManagedGeneration } from '../../backend/_generation/managedGeneration.js';
import { createMemberService, MemberServiceError } from '../../backend/_member/memberService.js';
import { prepareMemberApi, sendApiError } from '../../backend/_member/http.js';
import {
  createAdminSupabaseClient,
  createScopedMemberRpcClient,
  requireAuthenticatedUser,
} from '../../backend/_member/supabaseServer.js';

const MAX_PROMPT_BYTES = 50_000;

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!prepareMemberApi(request, response)) {
    return response.status(403).json({ error: 'origin_not_allowed' });
  }
  if (request.method === 'OPTIONS') return response.status(204).send('');
  if (!['GET', 'POST'].includes(request.method || '')) {
    return response.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    const admin = createAdminSupabaseClient();
    const user = await requireAuthenticatedUser(request, admin);
    if (request.method === 'GET') {
      return response.status(200).json({ capabilities: listMemberCapabilities() });
    }

    const idempotencyKey = request.headers['idempotency-key'];
    const capabilityId =
      typeof request.body?.capabilityId === 'string' ? request.body.capabilityId : '';
    const prompt = typeof request.body?.prompt === 'string' ? request.body.prompt.trim() : '';
    const rawCapabilityIds = request.body?.enabledCapabilityIds;
    const validCapabilityIdArray =
      Array.isArray(rawCapabilityIds) && rawCapabilityIds.every((id) => typeof id === 'string');
    const enabledCapabilityIds = validCapabilityIdArray ? (rawCapabilityIds as string[]) : [];

    if (
      typeof idempotencyKey !== 'string' ||
      !idempotencyKey ||
      !prompt ||
      Buffer.byteLength(prompt, 'utf8') > MAX_PROMPT_BYTES
    ) {
      throw new MemberServiceError('invalid_capability_request', 400);
    }
    if (!validCapabilityIdArray) {
      throw new MemberServiceError('invalid_capability_selection', 400);
    }
    assertResearchAgent(capabilityId);
    resolveResearchToolKeys(enabledCapabilityIds);

    const scopedClient = createScopedMemberRpcClient(admin, user.id);
    const member = createMemberService(scopedClient);
    const result = await runManagedGeneration(
      {
        idempotencyKey,
        taskKind: 'blind_review',
        provider: 'gemini-3.6-flash',
        completeWorkflow: true,
      },
      member,
      async () => {
        const blindReview = await prepareMemberBlindReview({
          prompt,
          context: request.body?.blindReviewContext,
          client: scopedClient,
          maxPromptBytes: MAX_PROMPT_BYTES,
        });
        const draft = await callMGAResearchAgent({
          prompt: blindReview.prompt,
          enabledCapabilityIds,
        });
        return blindReview.preflight ? { ...draft, jevPreflight: blindReview.preflight } : draft;
      }
    );
    return response.status(200).json(result);
  } catch (error) {
    return sendApiError(response, error);
  }
}

export const config = { maxDuration: 120 };
