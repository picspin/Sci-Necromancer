import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createMemberService } from '../_member/memberService.js';
import { prepareMemberApi, sendApiError, verifyTurnstile } from '../_member/http.js';
import {
  createAdminSupabaseClient,
  createScopedMemberRpcClient,
  requireAuthenticatedUser,
} from '../_member/supabaseServer.js';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!prepareMemberApi(request, response))
    return response.status(403).json({ error: 'origin_not_allowed' });
  if (request.method === 'OPTIONS') return response.status(204).send('');
  if (request.method !== 'POST') return response.status(405).json({ error: 'method_not_allowed' });

  try {
    await verifyTurnstile(request, request.body?.turnstileToken);
    const admin = createAdminSupabaseClient();
    const user = await requireAuthenticatedUser(request, admin);
    const member = createMemberService(createScopedMemberRpcClient(admin, user.id));
    return response.status(200).json(await member.checkIn());
  } catch (error) {
    return sendApiError(response, error);
  }
}
