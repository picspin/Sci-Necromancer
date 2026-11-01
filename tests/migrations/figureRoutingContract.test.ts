import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  DATA_CHART_TEMPLATE_IDS,
  parseDataFigureRoutingResponse,
} from '../../backend/_jev/figureRouting';
import { createFigureRoutePolicy } from '../../backend/_jev/figureRoutePolicy';
import type { MemberRpcClient } from '../../backend/_member/memberService';

// Checked-in SQL is the source of the fixed RPC envelope constraints; no live database.
const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/202609260001_jev_figure_routing.sql'),
  'utf8'
);
const settleSql = sql
  .split('create or replace function public.jev_settle_figure_route(')[1]
  .split('create or replace function public.jev_clear_figure_routes_on_revoke')[0];

describe('data routing compatibility with the installed RPC contract', () => {
  it('settles the actual parsed data result against the existing SQL version constraints', async () => {
    const decision = parseDataFigureRoutingResponse({
      model: 'jev-1.13.0',
      answers: Object.fromEntries(
        DATA_CHART_TEMPLATE_IDS.map((id) => [id, { type: 'noul', noul: 0.9300000000000001 }])
      ),
    });
    const rpc = vi.fn(async (_name: string, args: Record<string, unknown>) => {
      const result = args.p_result as { kind: string; decision: Record<string, unknown> };
      for (const field of ['policyVersion', 'provider', 'model']) {
        const fixedValue = settleSql.match(
          new RegExp(`->>'${field}' is distinct from '([^']+)'`)
        )?.[1];
        expect(fixedValue).toBeDefined();
        if (result.decision[field] !== fixedValue)
          return { data: null, error: { message: 'invalid_jev_figure_result' } };
      }
      return { data: { status: 'settled' }, error: null };
    });
    await expect(
      createFigureRoutePolicy({ rpc } as unknown as MemberRpcClient).settle(
        '550e8400-e29b-41d4-a716-446655440000',
        true,
        { kind: 'data-template', decision }
      )
    ).resolves.toBeUndefined();
    expect(decision).toMatchObject({
      policyVersion: 'jev-figure-routing-v1',
      contractVersion: 'jev-data-figure-routing-v2',
    });
    // Pretty serialization is a conservative bound for these ASCII-only result fields.
    expect(
      new TextEncoder().encode(JSON.stringify({ kind: 'data-template', decision }, null, 2))
        .byteLength
    ).toBeLessThan(4096);
    expect(settleSql).toContain("octet_length(convert_to(p_result::text,'utf8'))>4096");
  });
});
