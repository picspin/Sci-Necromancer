import type { VercelRequest, VercelResponse } from '../../backend/_types/vercel.js';
import { MemberServiceError } from '../../backend/_member/memberService.js';
import { prepareMemberApi, sendApiError } from '../../backend/_member/http.js';
import {
  createAdminSupabaseClient,
  requireAuthenticatedUser,
} from '../../backend/_member/supabaseServer.js';

const MAX_PAYLOAD_BYTES = 10_000;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

const stringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

function sanitizeCategories(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const category = asRecord(item);
        return category && typeof category.name === 'string'
          ? [
              {
                name: category.name,
                ...(typeof category.type === 'string' ? { type: category.type } : {}),
                ...(typeof category.probability === 'number'
                  ? { probability: category.probability }
                  : {}),
              },
            ]
          : [];
      })
    : [];
}

function sanitizeRsna(value: unknown): Record<string, unknown> | undefined {
  const rsna = asRecord(value);
  if (!rsna) return undefined;
  const safe: Record<string, unknown> = {};
  for (const key of [
    'track',
    'contentType',
    'primaryPresentationFormat',
    'cuttingEdgeTopic',
    'confidence',
    'ruleVersion',
  ]) {
    if (typeof rsna[key] === 'string' || typeof rsna[key] === 'number') safe[key] = rsna[key];
  }
  for (const key of [
    'alternativePresentationFormats',
    'reportingGuidelines',
    'rationale',
    'warnings',
  ]) {
    safe[key] = stringArray(rsna[key]);
  }
  return safe;
}

export function sanitizeAbstractPayload(value: unknown): Record<string, unknown> {
  const payload = asRecord(value);
  const abstractData = asRecord(payload?.abstractData);
  if (
    !payload ||
    typeof payload.abstractType !== 'string' ||
    !abstractData ||
    typeof abstractData.abstract !== 'string' ||
    !Array.isArray(payload.keywords)
  ) {
    throw new MemberServiceError('invalid_abstract', 400);
  }
  const safeAbstractData: Record<string, unknown> = {
    abstract: abstractData.abstract,
    impact: typeof abstractData.impact === 'string' ? abstractData.impact : '',
    synopsis: typeof abstractData.synopsis === 'string' ? abstractData.synopsis : '',
    keywords: stringArray(abstractData.keywords),
    categories: sanitizeCategories(abstractData.categories),
    presentationGuidance: stringArray(abstractData.presentationGuidance),
    complianceWarnings: stringArray(abstractData.complianceWarnings),
  };
  if (typeof abstractData.title === 'string') safeAbstractData.title = abstractData.title;
  const abstractRsna = sanitizeRsna(abstractData.rsna);
  if (abstractRsna) safeAbstractData.rsna = abstractRsna;
  const rsna = sanitizeRsna(payload.rsna);
  return {
    abstractType: payload.abstractType,
    abstractData: safeAbstractData,
    categories: sanitizeCategories(payload.categories),
    keywords: stringArray(payload.keywords),
    ...(rsna ? { rsna } : {}),
  };
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!prepareMemberApi(request, response))
    return response.status(403).json({ error: 'origin_not_allowed' });
  if (request.method === 'OPTIONS') return response.status(204).send('');

  try {
    const admin = createAdminSupabaseClient();
    const user = await requireAuthenticatedUser(request, admin);

    if (request.method === 'GET') {
      const rawOffset = Array.isArray(request.query.offset)
        ? request.query.offset[0]
        : request.query.offset;
      const offset = Math.max(0, Math.min(Number.parseInt(rawOffset || '0', 10) || 0, 100_000));
      const { data, error } = await admin
        .from('member_abstracts')
        .select('id,client_id,title,conference,payload,created_at,updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .range(offset, offset + 24);
      if (error) throw error;
      return response.status(200).json({ abstracts: data, hasMore: (data?.length || 0) === 25 });
    }

    if (request.method === 'POST') {
      const clientId =
        typeof request.body?.clientId === 'string' ? request.body.clientId.trim() : '';
      const title =
        typeof request.body?.title === 'string' ? request.body.title.trim().slice(0, 500) : '';
      const conference =
        typeof request.body?.conference === 'string'
          ? request.body.conference.trim().slice(0, 40)
          : '';
      const payload = sanitizeAbstractPayload(request.body?.payload);
      const expectedUpdatedAt = request.body?.expectedUpdatedAt;
      if (!clientId || clientId.length > 128 || !conference) {
        throw new MemberServiceError('invalid_abstract', 400);
      }
      if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > MAX_PAYLOAD_BYTES) {
        throw new MemberServiceError('abstract_too_large', 413);
      }
      if (
        expectedUpdatedAt !== null &&
        expectedUpdatedAt !== undefined &&
        typeof expectedUpdatedAt !== 'string'
      ) {
        throw new MemberServiceError('invalid_abstract_version', 400);
      }
      const isUpdate = typeof expectedUpdatedAt === 'string';
      const { data, error } = await admin.rpc('save_member_abstract', {
        p_user_id: user.id,
        p_client_id: clientId,
        p_title: title,
        p_conference: conference,
        p_payload: payload,
        p_expected_updated_at: expectedUpdatedAt ?? null,
      });
      if (error) {
        if (error.message.includes('abstract_quota_exceeded')) {
          throw new MemberServiceError('abstract_quota_exceeded', 409);
        }
        if (error.message.includes('abstract_too_large')) {
          throw new MemberServiceError('abstract_too_large', 413);
        }
        if (error.message.includes('abstract_conflict')) {
          throw new MemberServiceError('abstract_conflict', 409);
        }
        throw error;
      }
      return response.status(isUpdate ? 200 : 201).json(data);
    }

    if (request.method === 'DELETE') {
      const clientId = typeof request.body?.clientId === 'string' ? request.body.clientId : '';
      if (!clientId) throw new MemberServiceError('invalid_abstract_id', 400);
      const { error } = await admin
        .from('member_abstracts')
        .delete()
        .eq('client_id', clientId)
        .eq('user_id', user.id);
      if (error) throw error;
      return response.status(204).send('');
    }

    return response.status(405).json({ error: 'method_not_allowed' });
  } catch (error) {
    return sendApiError(response, error);
  }
}
