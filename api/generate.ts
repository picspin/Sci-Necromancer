import type { VercelRequest, VercelResponse } from '../backend/_types/vercel.js';
import { callManagedProvider, type ProviderImageInput } from '../backend/_generation/providers.js';
import {
  runManagedGeneration,
  type ManagedProvider,
} from '../backend/_generation/managedGeneration.js';
import {
  createMemberService,
  MemberServiceError,
  type ManagedTaskKind,
  type ManagedWorkflowOperation,
} from '../backend/_member/memberService.js';
import { prepareMemberApi, sendApiError } from '../backend/_member/http.js';
import {
  createAdminSupabaseClient,
  createScopedMemberRpcClient,
  requireAuthenticatedUser,
} from '../backend/_member/supabaseServer.js';

const PROVIDERS = new Set<ManagedProvider>(['gemini-3.6-flash', 'nano-banana-pro', 'gpt-image-2']);
const TASK_KINDS = new Set<ManagedTaskKind>([
  'analysis_generation',
  'regeneration',
  'deep_update',
  'image_generation',
  'blind_review',
]);
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type GenerationOperation =
  | 'analysis'
  | ManagedWorkflowOperation
  | 'regeneration'
  | 'deep_update'
  | 'image_generation'
  | 'blind_review';

export function assertGenerationRoute(
  provider: ManagedProvider,
  operation: GenerationOperation,
  workflowId?: string
): void {
  const isTextProvider = provider === 'gemini-3.6-flash';
  const hasWorkflow = Boolean(workflowId);
  const valid =
    (operation === 'analysis' && isTextProvider && !hasWorkflow) ||
    (operation === 'generation' && isTextProvider && hasWorkflow) ||
    ((operation === 'regeneration' || operation === 'deep_update') && isTextProvider) ||
    (operation === 'blind_review' && isTextProvider && !hasWorkflow) ||
    (operation === 'image_generation' && !isTextProvider && !hasWorkflow);
  if (!valid) throw new MemberServiceError('invalid_generation_request', 400);
}

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
    const continuingWorkflow = Boolean(workflowId);
    const taskKind: ManagedTaskKind =
      operation === 'image_generation'
        ? 'image_generation'
        : operation === 'blind_review'
          ? 'blind_review'
          : operation === 'deep_update'
            ? continuingWorkflow
              ? 'analysis_generation'
              : 'deep_update'
            : operation === 'regeneration'
              ? continuingWorkflow
                ? 'analysis_generation'
                : 'regeneration'
              : 'analysis_generation';
    const workflowOperation =
      continuingWorkflow && ['generation', 'regeneration', 'deep_update'].includes(operation)
        ? (operation as ManagedWorkflowOperation)
        : undefined;
    const completeWorkflow = !continuingWorkflow && operation !== 'analysis';
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
    assertGenerationRoute(provider, operation, workflowId);
    if (
      (workflowOperation && !workflowId) ||
      (workflowId && (!workflowOperation || !UUID_PATTERN.test(workflowId)))
    ) {
      throw new MemberServiceError('invalid_generation_request', 400);
    }
    if (
      ![
        'analysis',
        'generation',
        'regeneration',
        'deep_update',
        'image_generation',
        'blind_review',
      ].includes(operation)
    ) {
      throw new MemberServiceError('invalid_generation_request', 400);
    }
    const images = parseImages(request.body?.images);
    const admin = createAdminSupabaseClient();
    const user = await requireAuthenticatedUser(request, admin);
    const member = createMemberService(createScopedMemberRpcClient(admin, user.id));
    const result = await runManagedGeneration(
      { idempotencyKey, taskKind, provider, completeWorkflow, workflowId, workflowOperation },
      member,
      () =>
        callManagedProvider({
          provider,
          prompt,
          images,
          size: request.body?.size,
          reasoning: operation === 'deep_update' ? 'high' : 'default',
        })
    );
    return response.status(200).json(result);
  } catch (error) {
    return sendApiError(response, error);
  }
}

export const config = { maxDuration: 120 };
