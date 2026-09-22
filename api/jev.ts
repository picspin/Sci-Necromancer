import type { VercelRequest, VercelResponse } from '../backend/_types/vercel.js';
import { prepareMemberApi } from '../backend/_member/http.js';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!prepareMemberApi(request, response))
    return response.status(403).json({ error: 'origin_not_allowed' });
  if (request.method === 'OPTIONS') return response.status(204).send('');
  if (request.method !== 'POST') return response.status(405).json({ error: 'method_not_allowed' });
  if (process.env.TYPESAFE_JEV_ENABLED !== 'true') {
    return response.status(404).json({ error: 'typesafe_jev_disabled' });
  }
  // This public route must not become a TypeSafe data egress path. A protected,
  // server-owned member workflow will replace it before Jev can be enabled.
  return response.status(503).json({ error: 'typesafe_jev_member_workflow_unavailable' });
}

export const config = { maxDuration: 20 };
