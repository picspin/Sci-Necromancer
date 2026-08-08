import type { VercelRequest, VercelResponse } from '../../backend/_types/vercel.js';
import { createMemberService, MemberServiceError } from '../../backend/_member/memberService.js';
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
  if (request.method !== 'POST') return response.status(405).json({ error: 'method_not_allowed' });

  try {
    const admin = createAdminSupabaseClient();
    const user = await requireAuthenticatedUser(request, admin);
    if (!user.email || !user.email_confirmed_at) {
      throw new MemberServiceError('verified_email_required', 403);
    }
    const member = createMemberService(createScopedMemberRpcClient(admin, user.id));
    return response.status(200).json(await member.checkIn());
  } catch (error) {
    return sendApiError(response, error);
  }
}
