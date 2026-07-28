import { describe, expect, it, vi } from 'vitest';
import { runExternalReviewers } from '../externalReview';

describe('backend external reviewer allowlist', () => {
  it('runs only checkbox-selected reviewers and never accepts client endpoints', async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes('esearch.fcgi')) {
        return new Response(JSON.stringify({ esearchresult: { idlist: ['12345'] } }), {
          status: 200,
        });
      }
      return new Response(
        JSON.stringify({
          result: {
            uids: ['12345'],
            '12345': {
              title: 'Verified imaging study',
              pubdate: '2025',
              fulljournalname: 'Radiology',
            },
          },
        }),
        { status: 200 }
      );
    });

    const results = await runExternalReviewers(
      {
        generatedText: 'Imaging study. PMID: 12345.',
        title: 'Imaging study',
        keywords: ['MRI'],
        reviewers: { pubmed: true, citecheck: false, 'doi-mcp': false },
      },
      {
        fetch: fetchMock as typeof fetch,
        env: {},
        now: () => '2026-07-28T00:00:00.000Z',
      }
    );

    expect(results).toHaveLength(1);
    expect(results[0].reviewer).toBe('pubmed');
    expect(results[0].status).toBe('verified');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.flat().join(' ')).not.toContain('client-supplied');
  });

  it('fails closed when a selected MCP backend is not provisioned', async () => {
    const results = await runExternalReviewers(
      {
        generatedText: 'A claim cites 10.1000/example.',
        title: 'Example',
        keywords: [],
        reviewers: { pubmed: false, citecheck: true, 'doi-mcp': true },
      },
      {
        fetch,
        env: {},
        now: () => '2026-07-28T00:00:00.000Z',
      }
    );

    expect(results.map((result) => [result.reviewer, result.status])).toEqual([
      ['citecheck', 'unavailable'],
      ['doi-mcp', 'unavailable'],
    ]);
  });

  it('rejects malformed MCP success payloads and unsafe evidence links', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            result: {
              structuredContent: {
                status: 'definitely-verified',
                summary: 'Trust me',
                records: [{ query: 'x', status: 'verified', url: 'javascript:alert(1)' }],
              },
            },
          }),
          { status: 200 }
        )
    );

    const results = await runExternalReviewers(
      {
        generatedText: 'A claim cites 10.1000/example.',
        keywords: [],
        reviewers: { pubmed: false, citecheck: false, 'doi-mcp': true },
      },
      {
        fetch: fetchMock as typeof fetch,
        env: { DOI_MCP_URL: 'https://reviewer.internal/mcp' },
        now: () => '2026-07-28T00:00:00.000Z',
      }
    );

    expect(results[0].status).toBe('unavailable');
    expect(results[0].records).toEqual([]);
  });
});
