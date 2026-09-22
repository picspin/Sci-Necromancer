import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestTypesafeJev } = vi.hoisted(() => ({ requestTypesafeJev: vi.fn() }));
vi.mock('../../backend/_jev/typesafe', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../backend/_jev/typesafe')>();
  return { ...actual, requestTypesafeJev };
});

import handler from '../../api/jev';

const response = () => {
  const value = {
    status: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
    setHeader: vi.fn(),
  };
  value.status.mockReturnValue(value);
  value.json.mockReturnValue(value);
  value.send.mockReturnValue(value);
  return value;
};

describe('/api/jev', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TYPESAFE_JEV_ENABLED = 'true';
  });

  it('fails closed without authenticating or sending source when the legacy flag is enabled', async () => {
    const res = response();
    await handler(
      { method: 'POST', headers: {}, body: { text: 'private source' } } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: 'typesafe_jev_member_workflow_unavailable' });
    expect(requestTypesafeJev).not.toHaveBeenCalled();
  });

  it('retains the disabled response when the legacy flag is off', async () => {
    process.env.TYPESAFE_JEV_ENABLED = 'false';
    const res = response();
    await handler(
      { method: 'POST', headers: {}, body: { text: 'private source' } } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'typesafe_jev_disabled' });
    expect(requestTypesafeJev).not.toHaveBeenCalled();
  });
});
