import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { mapStripeEvent, verifyStripeSignature } from './stripeWebhook';

describe('Stripe webhook boundary', () => {
  it('accepts a current valid v1 signature and rejects tampering', () => {
    const secret = 'whsec_test';
    const payload = '{"id":"evt_1"}';
    const timestamp = 1_784_982_400;
    const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
    const header = `t=${timestamp},v1=${signature}`;

    expect(verifyStripeSignature(payload, header, secret, timestamp * 1000)).toBe(true);
    expect(verifyStripeSignature(`${payload} `, header, secret, timestamp * 1000)).toBe(false);
  });

  it('maps a CNY checkout to one bonus per whole yuan', () => {
    expect(
      mapStripeEvent({
        id: 'evt_checkout',
        type: 'checkout.session.completed',
        data: {
          object: {
            payment_status: 'paid',
            payment_intent: 'pi_1',
            currency: 'cny',
            amount_total: 2500,
            metadata: { user_id: 'user-1' },
          },
        },
      })
    ).toEqual({
      eventId: 'evt_checkout',
      eventType: 'purchase',
      adjustmentId: 'pi_1',
      paymentIntentId: 'pi_1',
      userId: 'user-1',
      bonus: 25,
    });
  });

  it('maps refunds and disputes to reversal adjustments', () => {
    expect(
      mapStripeEvent({
        id: 'evt_refund',
        type: 'refund.created',
        data: {
          object: {
            id: 're_1',
            status: 'succeeded',
            payment_intent: 'pi_1',
            currency: 'cny',
            amount: 500,
          },
        },
      })
    ).toMatchObject({
      eventType: 'refund',
      adjustmentId: 're_1',
      paymentIntentId: 'pi_1',
      bonus: 5,
    });
    expect(
      mapStripeEvent({
        id: 'evt_dispute',
        type: 'charge.dispute.created',
        data: { object: { id: 'dp_1', payment_intent: 'pi_1', currency: 'cny', amount: 2500 } },
      })
    ).toMatchObject({
      eventType: 'dispute',
      adjustmentId: 'dp_1',
      paymentIntentId: 'pi_1',
      bonus: 25,
    });
  });

  it('ignores unfinished refunds and restores only a reinstated dispute adjustment', () => {
    expect(
      mapStripeEvent({
        id: 'evt_refund_pending',
        type: 'refund.created',
        data: {
          object: {
            id: 're_pending',
            status: 'pending',
            payment_intent: 'pi_1',
            currency: 'cny',
            amount: 500,
          },
        },
      })
    ).toBeNull();

    expect(
      mapStripeEvent({
        id: 'evt_reinstated',
        type: 'charge.dispute.funds_reinstated',
        data: { object: { id: 'dp_1', payment_intent: 'pi_1', currency: 'cny', amount: 2500 } },
      })
    ).toMatchObject({
      eventType: 'dispute_reinstatement',
      adjustmentId: 'dp_1',
      paymentIntentId: 'pi_1',
      bonus: 25,
    });
  });
});
