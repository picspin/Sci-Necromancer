import { createHash } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '../backend/_types/vercel.js';
import { createJevGenerationWorkflow } from '../backend/_jev/generationWorkflow.js';
import { createJevMemberPolicy } from '../backend/_jev/memberPolicy.js';
import { runJevPostCheckPipeline } from '../backend/_jev/postCheckPipeline.js';
import { prepareMemberBlindReview } from '../backend/_jev/blindPreflightWorkflow.js';
import { createJevVersionStore } from '../backend/_jev/versionStore.js';
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
import { prepareMemberApi, sendApiError, verifyTurnstile } from '../backend/_member/http.js';
import {
  createAdminSupabaseClient,
  createScopedMemberRpcClient,
  requireAuthenticatedUser,
} from '../backend/_member/supabaseServer.js';
import {
  answerDocumentationRequest,
  documentationRequestNeedsModel,
  validateDocumentationQuestion,
} from '../backend/_help/documentationAssistant.js';
import { reserveHelpUsage, settleHelpUsage } from '../backend/_help/helpUsage.js';
import { relayAnthropicRequest } from '../backend/_generation/anthropicByok.js';

const PROVIDERS = new Set<ManagedProvider>(['gemini-3.6-flash', 'nano-banana-pro', 'gpt-image-2']);
const TEXT_MODELS = new Set(['glm-5.2', 'gpt-5.6-luna']);
const NANO_BANANA_MODELS = new Set(['gemini-3.1-flash-image', 'gemini-3-pro-image']);
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
    (operation === 'analysis' && isTextProvider && hasWorkflow) ||
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

  if (request.body?.capability === 'anthropic_byok') {
    try {
      const result = await relayAnthropicRequest({
        resource: request.body?.resource,
        baseUrl: request.body?.baseUrl,
        apiKey: request.body?.apiKey,
        body: request.body?.body,
      });
      return response.status(result.status).json(result.payload);
    } catch (error) {
      return sendApiError(response, error);
    }
  }

  if (request.body?.capability === 'documentation_assistant') {
    const idempotencyKey = request.headers['idempotency-key'];
    const requestId =
      typeof idempotencyKey === 'string' && idempotencyKey
        ? idempotencyKey
        : globalThis.crypto.randomUUID();
    const validationError = validateDocumentationQuestion(request.body?.question);
    if (validationError) return response.status(400).json({ error: validationError });
    if (!documentationRequestNeedsModel(request.body)) {
      return response
        .status(200)
        .json({ ...(await answerDocumentationRequest(request.body)), requestId });
    }
    if (typeof idempotencyKey !== 'string' || !idempotencyKey) {
      return response.status(400).json({ error: 'help_idempotency_required' });
    }
    try {
      const turnstileToken = request.body?.turnstileToken;
      const turnstileVerified =
        typeof turnstileToken === 'string' && Boolean(turnstileToken.trim());
      if (turnstileVerified) await verifyTurnstile(request, turnstileToken);
      const reservation = await reserveHelpUsage(request, idempotencyKey, turnstileVerified);
      if (reservation.requiresTurnstile) {
        return response
          .status(400)
          .json({ error: 'turnstile_required', remaining: reservation.remaining });
      }
      if (!reservation.allowed) {
        return response.status(429).json({ error: 'help_rate_limited', remaining: 0 });
      }
      if (reservation.idempotent) {
        return response.status(409).json({
          error: 'help_request_already_processed',
          requestId,
          remaining: reservation.remaining,
        });
      }
      const result = await answerDocumentationRequest(request.body);
      const succeeded = result.mode === 'assisted';
      await settleHelpUsage(reservation, succeeded);
      return response.status(200).json({
        ...result,
        requestId,
        remaining: succeeded ? reservation.remaining : reservation.remaining + 1,
      });
    } catch (error) {
      return sendApiError(response, error);
    }
  }

  try {
    const idempotencyKey = request.headers['idempotency-key'];
    const providerRequestId =
      typeof request.headers['x-vercel-id'] === 'string'
        ? request.headers['x-vercel-id']
        : globalThis.crypto.randomUUID();
    const prompt = typeof request.body?.prompt === 'string' ? request.body.prompt.trim() : '';
    const provider = request.body?.provider as ManagedProvider;
    const model = typeof request.body?.model === 'string' ? request.body.model : undefined;
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
      continuingWorkflow &&
      ['analysis', 'generation', 'regeneration', 'deep_update'].includes(operation)
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
    if (
      (provider === 'gemini-3.6-flash' && model && !TEXT_MODELS.has(model)) ||
      (provider === 'nano-banana-pro' && model && !NANO_BANANA_MODELS.has(model)) ||
      (provider === 'gpt-image-2' && model)
    ) {
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
    const scopedClient = createScopedMemberRpcClient(admin, user.id);
    const member = createMemberService(scopedClient);
    let providerPrompt = prompt;
    let isJevWorkflow = false;
    let jevSourceText = '';
    let jevConference = '';
    if (workflowId && workflowOperation) {
      const sourceText =
        typeof request.body?.sourceText === 'string' ? request.body.sourceText.trim() : '';
      if (sourceText.length > 80_000)
        throw new MemberServiceError('invalid_generation_request', 400);
      const conference =
        typeof request.body?.conference === 'string' ? request.body.conference : '';
      isJevWorkflow = await createJevGenerationWorkflow(scopedClient).assertContext(
        workflowId,
        {
          sourceHash: sourceText
            ? createHash('sha256').update(sourceText, 'utf8').digest('hex')
            : '',
          conference,
          model: model ?? '',
        },
        workflowOperation
      );
      if (isJevWorkflow && !prompt.includes(sourceText)) {
        providerPrompt = `${prompt}\n\nAUTHOR SOURCE — preserve its facts:\n${sourceText}`;
      }
      if (isJevWorkflow) {
        jevSourceText = sourceText;
        jevConference = conference;
      }
    }
    const postCheckDeadline = Date.now() + 110_000;
    const remainingPostCheckMs = () => postCheckDeadline - Date.now();
    const result = await runManagedGeneration(
      { idempotencyKey, taskKind, provider, completeWorkflow, workflowId, workflowOperation },
      member,
      async () => {
        const blindReview =
          operation === 'blind_review'
            ? await prepareMemberBlindReview({
                prompt: providerPrompt,
                context: request.body?.blindReviewContext,
                client: scopedClient,
                maxPromptBytes: 100_000,
              })
            : { prompt: providerPrompt, preflight: undefined };
        const draft = await callManagedProvider({
          provider,
          model,
          requestId: providerRequestId,
          prompt: blindReview.prompt,
          images,
          size: request.body?.size,
          reasoning: operation === 'deep_update' ? 'high' : 'default',
        });
        if (operation === 'blind_review') {
          return blindReview.preflight ? { ...draft, jevPreflight: blindReview.preflight } : draft;
        }
        if (
          process.env.TYPESAFE_JEV_POST_CHECK_ENABLED !== 'true' ||
          !isJevWorkflow ||
          !workflowId ||
          (workflowOperation !== 'generation' && workflowOperation !== 'deep_update') ||
          draft.type !== 'text' ||
          !draft.text
        )
          return draft;

        let skipReason:
          'consent_revoked' | 'consent_unavailable' | 'time_budget_exhausted' | undefined;
        try {
          const consent = await createJevMemberPolicy(scopedClient).getConsent();
          if (!consent.accepted) skipReason = 'consent_revoked';
        } catch {
          skipReason = 'consent_unavailable';
        }
        if (!skipReason && remainingPostCheckMs() < 15_000) skipReason = 'time_budget_exhausted';
        const { output, version } = await runJevPostCheckPipeline({
          sourceText: jevSourceText,
          conference: jevConference,
          draft: { ...draft, type: 'text', text: draft.text },
          skipReason,
          remainingMs: remainingPostCheckMs,
          revise: (correctionPrompt) =>
            callManagedProvider({
              provider,
              model,
              requestId: `${providerRequestId}-jev-revision`,
              prompt: correctionPrompt,
              images: [],
              reasoning: 'high',
              timeoutMs: Math.min(50_000, remainingPostCheckMs() - 18_000),
            }),
        });
        await createJevVersionStore(scopedClient).persistVersion({
          ...version,
          taskId: workflowId,
          operation: workflowOperation,
          userId: user.id,
        });
        return {
          ...output,
          jevReview: {
            versionId: version.id,
            status: version.status,
            ...(version.unavailableReason ? { unavailableReason: version.unavailableReason } : {}),
            generationModels: version.generationModels,
            generationCalls: version.generationCalls,
            ...(version.initialCheck || version.finalCheck
              ? { checkerModel: (version.finalCheck ?? version.initialCheck)!.model }
              : {}),
          },
        };
      }
    );
    return response.status(200).json(result);
  } catch (error) {
    return sendApiError(response, error);
  }
}

export const config = { maxDuration: 120 };
