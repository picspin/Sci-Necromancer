import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MemberServiceError } from '../_member/memberService';
import { prepareMemberApi, sendApiError } from '../_member/http';
import { createAdminSupabaseClient, requireAuthenticatedUser } from '../_member/supabaseServer';
import { STRIPE_API_VERSION } from '../_stripe/stripeWebhook';

function requiredStripeEnv(name: 'STRIPE_SECRET_KEY' | 'APP_PUBLIC_URL'): string {
  const value = process.env[name]?.trim();
  if (!value) throw new MemberServiceError('payment_service_unavailable', 503);
  return value;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!prepareMemberApi(request, response))
    return response.status(403).json({ error: 'origin_not_allowed' });
  if (request.method === 'OPTIONS') return response.status(204).send('');
  if (request.method !== 'POST') return response.status(405).json({ error: 'method_not_allowed' });

  try {
    const bonus = request.body?.bonus;
    if (!Number.isSafeInteger(bonus) || bonus < 10 || bonus > 10_000) {
      throw new MemberServiceError('invalid_checkout_amount', 400);
    }
    const admin = createAdminSupabaseClient();
    const user = await requireAuthenticatedUser(request, admin);
    const publicUrl = requiredStripeEnv('APP_PUBLIC_URL').replace(/\/$/, '');
    const body = new URLSearchParams({
      mode: 'payment',
      'payment_method_types[0]': 'card',
      success_url: `${publicUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${publicUrl}/?payment=cancelled`,
      client_reference_id: user.id,
      'metadata[user_id]': user.id,
      'payment_intent_data[metadata][user_id]': user.id,
      'line_items[0][price_data][currency]': 'cny',
      'line_items[0][price_data][unit_amount]': '100',
      'line_items[0][price_data][product_data][name]': 'SCI-Necromancer bonus',
      'line_items[0][quantity]': String(bonus),
    });
    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${requiredStripeEnv('STRIPE_SECRET_KEY')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': STRIPE_API_VERSION,
      },
      body,
    });
    const payload = (await stripeResponse.json()) as { url?: string; error?: { message?: string } };
    if (!stripeResponse.ok || !payload.url) {
      console.error('Stripe checkout failed:', stripeResponse.status, payload.error?.message);
      throw new MemberServiceError('payment_service_failed', 502);
    }
    return response.status(200).json({ url: payload.url });
  } catch (error) {
    return sendApiError(response, error);
  }
}
