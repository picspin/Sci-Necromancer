import type { VercelRequest, VercelResponse } from '../../backend/_types/vercel.js';
import { createMemberService } from '../../backend/_member/memberService.js';
import { prepareMemberApi, sendApiError } from '../../backend/_member/http.js';
import {
  createAdminSupabaseClient,
  createScopedMemberRpcClient,
  requireAuthenticatedUser,
} from '../../backend/_member/supabaseServer.js';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!prepareMemberApi(request, response))
    return response.status(403).json({ error: 'origin_not_allowed' });
  if (request.method === 'OPTIONS') return response.status(204).send('');
  if (request.method !== 'GET') return response.status(405).json({ error: 'method_not_allowed' });

  try {
    const admin = createAdminSupabaseClient();
    const user = await requireAuthenticatedUser(request, admin);
    const member = createMemberService(createScopedMemberRpcClient(admin, user.id));
    if (user.email && user.email_confirmed_at) await member.bootstrapVerifiedAccount();
    return response.status(200).json(await member.getStatus());
  } catch (error) {
    return sendApiError(response, error);
  }
}
