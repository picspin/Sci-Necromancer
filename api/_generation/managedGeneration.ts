import type { ManagedTaskKind, ManagedWorkflowOperation } from '../_member/memberService.js';
import { MemberServiceError } from '../_member/memberService.js';
import { assertBlindReviewAssessment } from '../../lib/review/blindReview.js';

export type ManagedProvider = 'gemini-3.6-flash' | 'nano-banana-pro' | 'gpt-image-2';

interface WalletBoundary {
  reserveTask(
    idempotencyKey: string,
    taskKind: ManagedTaskKind
  ): Promise<{
    taskId: string;
    bonusBalance: number;
    callCount?: number;
    generationCount?: number;
    deepUpdateCount?: number;
  }>;
  continueWorkflow(
    taskId: string,
    operation: ManagedWorkflowOperation
  ): Promise<{
    taskId: string;
    bonusBalance: number;
    callCount?: number;
    generationCount?: number;
    deepUpdateCount?: number;
  }>;
  settleTask(
    taskId: string,
    success: boolean,
    completeWorkflow: boolean
  ): Promise<{ status: string; bonusBalance: number }>;
}

export interface ManagedGenerationRequest {
  idempotencyKey: string;
  taskKind: ManagedTaskKind;
  provider: ManagedProvider;
  completeWorkflow: boolean;
  workflowId?: string;
  workflowOperation?: ManagedWorkflowOperation;
}

export interface ManagedGenerationOutput {
  type: 'text' | 'image';
  text?: string;
  base64?: string;
  mimeType?: string;
}

function assertDeliverableOutput(output: ManagedGenerationOutput, taskKind: ManagedTaskKind): void {
  if (output.type === 'image' && (!output.base64 || output.base64.length > 3_500_000)) {
    throw new MemberServiceError('managed_image_too_large', 502);
  }
  if (output.type === 'text' && (!output.text || output.text.length > 500_000)) {
    throw new MemberServiceError('managed_provider_empty_output', 502);
  }
  if (taskKind === 'blind_review' && output.type === 'text') {
    try {
      const normalized = output
        .text!.trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '');
      output.text = JSON.stringify(assertBlindReviewAssessment(JSON.parse(normalized)));
    } catch {
      throw new MemberServiceError('blind_review_invalid_model_response', 502);
    }
  }
}

export async function runManagedGeneration(
  request: ManagedGenerationRequest,
  wallet: WalletBoundary,
  callSelectedProvider: () => Promise<ManagedGenerationOutput>
) {
  const reservation =
    request.workflowId && request.workflowOperation
      ? await wallet.continueWorkflow(request.workflowId, request.workflowOperation)
      : await wallet.reserveTask(request.idempotencyKey, request.taskKind);
  try {
    const output = await callSelectedProvider();
    assertDeliverableOutput(output, request.taskKind);
    const settlement = await wallet.settleTask(reservation.taskId, true, request.completeWorkflow);
    return {
      output,
      bonusBalance: settlement.bonusBalance,
      workflowId: reservation.taskId,
      workflow: {
        callCount: reservation.callCount ?? 1,
        generationCount: reservation.generationCount ?? 0,
        deepUpdateCount: reservation.deepUpdateCount ?? 0,
      },
    };
  } catch (providerError) {
    try {
      await wallet.settleTask(reservation.taskId, false, request.completeWorkflow);
    } catch (refundError) {
      console.error('Failed to refund managed generation task:', refundError);
    }
    throw providerError;
  }
}
