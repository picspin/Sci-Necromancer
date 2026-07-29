import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { VercelRequest } from '@vercel/node';
import { MemberServiceError, type MemberRpcClient } from './memberService.js';

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new MemberServiceError('member_service_unavailable', 503);
  return value;
}

export function createAdminSupabaseClient(): SupabaseClient {
  return createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function bearerToken(request: VercelRequest): string {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    throw new MemberServiceError('unauthenticated', 401);
  }
  const token = authorization.slice('Bearer '.length).trim();
  if (!token) throw new MemberServiceError('unauthenticated', 401);
  return token;
}

export async function requireAuthenticatedUser(
  request: VercelRequest,
  admin = createAdminSupabaseClient()
): Promise<User> {
  const { data, error } = await admin.auth.getUser(bearerToken(request));
  if (error || !data.user) throw new MemberServiceError('unauthenticated', 401);
  return data.user;
}

export function createScopedMemberRpcClient(
  admin: Pick<SupabaseClient, 'rpc'>,
  userId: string
): MemberRpcClient {
  return {
    rpc<T = unknown>(name: string, args: Record<string, unknown> = {}) {
      return admin.rpc(name, { p_user_id: userId, ...args }) as unknown as PromiseLike<{
        data: T | null;
        error: { message?: string } | null;
      }>;
    },
  };
}
