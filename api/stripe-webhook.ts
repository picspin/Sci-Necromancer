import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MemberServiceError } from './_member/memberService.js';
import { sendApiError } from './_member/http.js';
import { createAdminSupabaseClient } from './_member/supabaseServer.js';
import { mapStripeEvent, verifyStripeSignature } from './_stripe/stripeWebhook.js';

async function readRawBody(request: VercelRequest): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return response.status(405).json({ error: 'method_not_allowed' });

  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    const signature = request.headers['stripe-signature'];
    if (!secret || typeof signature !== 'string') {
      throw new MemberServiceError('payment_service_unavailable', 503);
    }
    const rawBody = await readRawBody(request);
    if (!verifyStripeSignature(rawBody, signature, secret)) {
      throw new MemberServiceError('invalid_stripe_signature', 400);
    }
    const adjustment = mapStripeEvent(JSON.parse(rawBody));
    if (!adjustment) return response.status(200).json({ received: true, applied: false });

    const admin = createAdminSupabaseClient();
    const { data, error } = await admin.rpc('admin_apply_stripe_event', {
      p_event_id: adjustment.eventId,
      p_event_type: adjustment.eventType,
      p_adjustment_id: adjustment.adjustmentId,
      p_payment_intent_id: adjustment.paymentIntentId,
      p_user_id: adjustment.userId,
      p_bonus: adjustment.bonus,
    });
    if (error) throw error;
    return response.status(200).json({ received: true, result: data });
  } catch (error) {
    return sendApiError(response, error);
  }
}

export const config = { api: { bodyParser: false } };
