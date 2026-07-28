import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callManagedProvider, type ProviderImageInput } from './_generation/providers';
import { runManagedGeneration, type ManagedProvider } from './_generation/managedGeneration';
import {
  createMemberService,
  MemberServiceError,
  type ManagedTaskKind,
  type ManagedWorkflowOperation,
} from './_member/memberService';
import { prepareMemberApi, sendApiError } from './_member/http';
import {
  createAdminSupabaseClient,
  createScopedMemberRpcClient,
  requireAuthenticatedUser,
} from './_member/supabaseServer';

const PROVIDERS = new Set<ManagedProvider>(['gemini-3.6-flash', 'nano-banana-pro', 'gpt-image-2']);
const TASK_KINDS = new Set<ManagedTaskKind>([
  'analysis_generation',
  'regeneration',
  'deep_update',
  'image_generation',
]);
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type GenerationOperation =
  | 'analysis'
  | ManagedWorkflowOperation
  | 'regeneration'
  | 'deep_update'
  | 'image_generation';

function parseImages(value: unknown): ProviderImageInput[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 8) {
    throw new MemberServiceError('invalid_images', 400);
  }
  const images = value.map((item) => {
    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.data !== 'string' ||
      candidate.data.length > 2_800_000 ||
      typeof candidate.mimeType !== 'string' ||
      !IMAGE_TYPES.has(candidate.mimeType)
    ) {
      throw new MemberServiceError('invalid_images', 400);
    }
    return { data: candidate.data, mimeType: candidate.mimeType };
  });
  if (images.reduce((total, image) => total + image.data.length, 0) > 3_200_000) {
    throw new MemberServiceError('managed_image_request_too_large', 413);
  }
  return images;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!prepareMemberApi(request, response))
    return response.status(403).json({ error: 'origin_not_allowed' });
  if (request.method === 'OPTIONS') return response.status(204).send('');
  if (request.method !== 'POST') return response.status(405).json({ error: 'method_not_allowed' });

  try {
    const idempotencyKey = request.headers['idempotency-key'];
    const prompt = typeof request.body?.prompt === 'string' ? request.body.prompt.trim() : '';
    const provider = request.body?.provider as ManagedProvider;
    const operation = request.body?.operation as GenerationOperation;
    const workflowId =
      typeof request.body?.workflowId === 'string' ? request.body.workflowId : undefined;
    const taskKind: ManagedTaskKind =
      operation === 'image_generation'
        ? 'image_generation'
        : operation === 'deep_update'
          ? 'deep_update'
          : operation === 'regeneration'
            ? 'regeneration'
            : 'analysis_generation';
    const workflowOperation = ['synopsis', 'type', 'generation'].includes(operation)
      ? (operation as ManagedWorkflowOperation)
      : undefined;
    const completeWorkflow = [
      'generation',
      'regeneration',
      'deep_update',
      'image_generation',
    ].includes(operation);
    if (
      typeof idempotencyKey !== 'string' ||
      !idempotencyKey ||
      !prompt ||
      prompt.length > 100_000
    ) {
      throw new MemberServiceError('invalid_generation_request', 400);
    }
    if (!PROVIDERS.has(provider) || !TASK_KINDS.has(taskKind)) {
      throw new MemberServiceError('invalid_generation_request', 400);
    }
    if (
      (workflowOperation && !workflowId) ||
      (workflowId && (!workflowOperation || !UUID_PATTERN.test(workflowId)))
    ) {
      throw new MemberServiceError('invalid_generation_request', 400);
    }
    if (
      ![
        'analysis',
        'synopsis',
        'type',
        'generation',
        'regeneration',
        'deep_update',
        'image_generation',
      ].includes(operation)
    ) {
      throw new MemberServiceError('invalid_generation_request', 400);
    }
    if (provider === 'gemini-3.6-flash' && taskKind === 'image_generation') {
      throw new MemberServiceError('invalid_generation_request', 400);
    }
    if (provider !== 'gemini-3.6-flash' && taskKind !== 'image_generation') {
      throw new MemberServiceError('invalid_generation_request', 400);
    }

    const images = parseImages(request.body?.images);
    const admin = createAdminSupabaseClient();
    const user = await requireAuthenticatedUser(request, admin);
    const member = createMemberService(createScopedMemberRpcClient(admin, user.id));
    const result = await runManagedGeneration(
      { idempotencyKey, taskKind, provider, completeWorkflow, workflowId, workflowOperation },
      member,
      () => callManagedProvider({ provider, prompt, images, size: request.body?.size })
    );
    return response.status(200).json(result);
  } catch (error) {
    return sendApiError(response, error);
  }
}

export const config = { maxDuration: 120 };
