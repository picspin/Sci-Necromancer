import { createHmac, timingSafeEqual } from 'node:crypto';
import { MemberServiceError } from '../_member/memberService';

export const STRIPE_API_VERSION = '2026-02-25.clover';

export interface StripeLedgerAdjustment {
  eventId: string;
  eventType: 'purchase' | 'refund' | 'dispute' | 'dispute_reinstatement';
  adjustmentId: string;
  paymentIntentId: string;
  userId: string | null;
  bonus: number;
}

export function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
  nowMs = Date.now()
): boolean {
  const fields = signatureHeader.split(',').map((field) => field.split('=', 2));
  const timestamp = Number(fields.find(([key]) => key === 't')?.[1]);
  const signatures = fields.filter(([key]) => key === 'v1').map(([, value]) => value);
  if (!Number.isFinite(timestamp) || Math.abs(nowMs / 1000 - timestamp) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest();
  return signatures.some((signature) => {
    if (!/^[a-f0-9]{64}$/i.test(signature || '')) return false;
    const supplied = Buffer.from(signature, 'hex');
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  });
}

function asRecord(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object')
    throw new MemberServiceError('invalid_stripe_event', 400);
  return value as Record<string, any>;
}

function wholeYuanBonus(
  object: Record<string, any>,
  amountField: 'amount' | 'amount_total'
): number {
  if (String(object.currency).toLowerCase() !== 'cny') {
    throw new MemberServiceError('unsupported_checkout_currency', 400);
  }
  const amount = object[amountField];
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount % 100 !== 0) {
    throw new MemberServiceError('invalid_checkout_amount', 400);
  }
  return amount / 100;
}

export function mapStripeEvent(eventValue: unknown): StripeLedgerAdjustment | null {
  const event = asRecord(eventValue);
  const object = asRecord(asRecord(event.data).object);
  if (typeof event.id !== 'string' || typeof event.type !== 'string') {
    throw new MemberServiceError('invalid_stripe_event', 400);
  }

  if (event.type === 'checkout.session.completed') {
    if (object.payment_status !== 'paid') return null;
    if (typeof object.payment_intent !== 'string' || typeof object.metadata?.user_id !== 'string') {
      throw new MemberServiceError('invalid_stripe_event', 400);
    }
    const bonus = wholeYuanBonus(object, 'amount_total');
    if (bonus < 10) throw new MemberServiceError('checkout_below_minimum', 400);
    return {
      eventId: event.id,
      eventType: 'purchase',
      adjustmentId: object.payment_intent,
      paymentIntentId: object.payment_intent,
      userId: object.metadata.user_id,
      bonus,
    };
  }

  if (event.type === 'refund.created' || event.type === 'refund.updated') {
    if (object.status !== 'succeeded') return null;
    if (typeof object.id !== 'string' || typeof object.payment_intent !== 'string') {
      throw new MemberServiceError('invalid_stripe_event', 400);
    }
    return {
      eventId: event.id,
      eventType: 'refund',
      adjustmentId: object.id,
      paymentIntentId: object.payment_intent,
      userId: null,
      bonus: wholeYuanBonus(object, 'amount'),
    };
  }

  if (event.type === 'charge.dispute.created' || event.type === 'charge.dispute.funds_reinstated') {
    if (typeof object.id !== 'string' || typeof object.payment_intent !== 'string') {
      throw new MemberServiceError('invalid_stripe_event', 400);
    }
    return {
      eventId: event.id,
      eventType: event.type === 'charge.dispute.created' ? 'dispute' : 'dispute_reinstatement',
      adjustmentId: object.id,
      paymentIntentId: object.payment_intent,
      userId: null,
      bonus: wholeYuanBonus(object, 'amount'),
    };
  }

  return null;
}
