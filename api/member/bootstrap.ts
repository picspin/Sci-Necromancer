import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MemberServiceError } from '../_member/memberService';
import { prepareMemberApi, sendApiError, verifyTurnstile } from '../_member/http';
import { createAdminSupabaseClient, requireAuthenticatedUser } from '../_member/supabaseServer';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!prepareMemberApi(request, response))
    return response.status(403).json({ error: 'origin_not_allowed' });
  if (request.method === 'OPTIONS') return response.status(204).send('');
  if (request.method !== 'POST') return response.status(405).json({ error: 'method_not_allowed' });

  try {
    await verifyTurnstile(request, request.body?.turnstileToken);
    const admin = createAdminSupabaseClient();
    const user = await requireAuthenticatedUser(request, admin);
    if (!user.email || !user.email_confirmed_at) {
      throw new MemberServiceError('verified_email_required', 403);
    }
    const { data, error } = await admin.rpc('admin_claim_signup_bonus', { p_user_id: user.id });
    if (error) throw error;
    return response.status(200).json(data);
  } catch (error) {
    return sendApiError(response, error);
  }
}
