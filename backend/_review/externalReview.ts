import type {
  BlindReviewSettings,
  ExternalReviewer,
  ExternalVerificationRecord,
  ExternalVerificationResult,
} from '../../types.js';
import { extractCitationCandidates } from '../../lib/review/blindReview.js';

export interface ExternalReviewRequest {
  generatedText: string;
  title?: string;
  keywords: string[];
  reviewers: BlindReviewSettings['reviewers'];
}

interface ExternalReviewRuntime {
  fetch: typeof fetch;
  env: Record<string, string | undefined>;
  now: () => string;
}

const DEFAULT_RUNTIME: ExternalReviewRuntime = {
  fetch,
  env: process.env,
  now: () => new Date().toISOString(),
};

function result(
  reviewer: ExternalReviewer,
  status: ExternalVerificationResult['status'],
  summary: string,
  records: ExternalVerificationRecord[],
  runtime: ExternalReviewRuntime
): ExternalVerificationResult {
  return { reviewer, status, checkedAt: runtime.now(), summary, records };
}

function unavailable(
  reviewer: ExternalReviewer,
  summary: string,
  runtime: ExternalReviewRuntime,
  summaryKey = 'blind_review.external_service_failed'
): ExternalVerificationResult {
  return { ...result(reviewer, 'unavailable', summary, [], runtime), summaryKey };
}

function buildPubMedQuery(request: ExternalReviewRequest): string {
  const primary = request.title?.trim() || request.keywords.slice(0, 4).join(' ');
  return primary.replace(/[\r\n]+/g, ' ').trim();
}

async function runPubMed(
  request: ExternalReviewRequest,
  runtime: ExternalReviewRuntime
): Promise<ExternalVerificationResult> {
  const query = buildPubMedQuery(request);
  if (!query) {
    return unavailable(
      'pubmed',
      'No searchable title, keyword, or text was provided.',
      runtime,
      'blind_review.external_no_query'
    );
  }
  try {
    const base = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
    const searchUrl = `${base}/esearch.fcgi?db=pubmed&retmode=json&retmax=5&term=${encodeURIComponent(query)}`;
    const searchResponse = await runtime.fetch(searchUrl, {
      headers: { 'User-Agent': 'Sci-Necromancer-Blind-Review/1.0' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!searchResponse.ok) throw new Error(`PubMed search returned ${searchResponse.status}`);
    const search = (await searchResponse.json()) as { esearchresult?: { idlist?: string[] } };
    const ids = search.esearchresult?.idlist || [];
    if (!ids.length) {
      return {
        ...result(
          'pubmed',
          'issues-found',
          'PubMed returned no related records. This does not prove that the research claim is false.',
          [{ query, status: 'not-verifiable', details: 'No related PubMed record found.' }],
          runtime
        ),
        summaryKey: 'blind_review.external_none_found',
      };
    }

    const summaryResponse = await runtime.fetch(
      `${base}/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}`,
      {
        headers: { 'User-Agent': 'Sci-Necromancer-Blind-Review/1.0' },
        signal: AbortSignal.timeout(8_000),
      }
    );
    if (!summaryResponse.ok) throw new Error(`PubMed summary returned ${summaryResponse.status}`);
    const payload = (await summaryResponse.json()) as {
      result?: Record<string, unknown> & { uids?: string[] };
    };
    const records = ids.map((id) => {
      const item = payload.result?.[id] as
        { title?: string; pubdate?: string; fulljournalname?: string } | undefined;
      return {
        query,
        status: 'supported' as const,
        title: item?.title,
        identifier: `PMID:${id}`,
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        details: [item?.fulljournalname, item?.pubdate].filter(Boolean).join(' · '),
      };
    });
    return {
      ...result(
        'pubmed',
        'verified',
        `PubMed returned ${records.length} related record(s). Related literature does not verify the submitted dataset or result.`,
        records,
        runtime
      ),
      summaryKey: 'blind_review.external_related_found',
    };
  } catch (error) {
    return unavailable(
      'pubmed',
      error instanceof Error ? error.message : 'PubMed verification failed.',
      runtime
    );
  }
}

function parseMCPPayload(
  payload: unknown
): Pick<ExternalVerificationResult, 'status' | 'summary' | 'records'> {
  const candidate = payload as {
    result?: { structuredContent?: unknown; content?: Array<{ type?: string; text?: string }> };
  };
  const structured = candidate.result?.structuredContent;
  if (structured && typeof structured === 'object') return validateMCPPayload(structured);
  const text = candidate.result?.content?.find((item) => item.type === 'text')?.text;
  if (!text) throw new Error('MCP reviewer returned no structured result.');
  return validateMCPPayload(JSON.parse(text));
}

function safeEvidenceUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function validateMCPPayload(
  value: unknown
): Pick<ExternalVerificationResult, 'status' | 'summary' | 'records'> {
  if (!value || typeof value !== 'object') throw new Error('MCP reviewer returned invalid data.');
  const candidate = value as Record<string, unknown>;
  if (!['verified', 'issues-found', 'unavailable'].includes(String(candidate.status))) {
    throw new Error('MCP reviewer returned an invalid status.');
  }
  if (typeof candidate.summary !== 'string' || !candidate.summary.trim()) {
    throw new Error('MCP reviewer returned no summary.');
  }
  if (!Array.isArray(candidate.records)) throw new Error('MCP reviewer returned invalid records.');
  const allowedRecordStatuses = new Set([
    'verified',
    'supported',
    'unsupported',
    'contradictory',
    'not-verifiable',
  ]);
  const records = candidate.records.slice(0, 50).map((record, index) => {
    if (!record || typeof record !== 'object') throw new Error(`Invalid MCP record ${index}.`);
    const item = record as Record<string, unknown>;
    if (typeof item.query !== 'string' || !allowedRecordStatuses.has(String(item.status))) {
      throw new Error(`Invalid MCP record ${index}.`);
    }
    return {
      query: item.query.slice(0, 1000),
      status: item.status as ExternalVerificationRecord['status'],
      ...(typeof item.title === 'string' ? { title: item.title.slice(0, 1000) } : {}),
      ...(typeof item.identifier === 'string' ? { identifier: item.identifier.slice(0, 500) } : {}),
      ...(safeEvidenceUrl(item.url) ? { url: safeEvidenceUrl(item.url) } : {}),
      ...(typeof item.details === 'string' ? { details: item.details.slice(0, 2000) } : {}),
    };
  });
  return {
    status: candidate.status as ExternalVerificationResult['status'],
    summary: candidate.summary.slice(0, 4000),
    records,
  };
}

async function runMCPReviewer(
  reviewer: 'citecheck' | 'doi-mcp',
  request: ExternalReviewRequest,
  runtime: ExternalReviewRuntime
): Promise<ExternalVerificationResult> {
  const endpointKey = reviewer === 'citecheck' ? 'CITECHECK_MCP_URL' : 'DOI_MCP_URL';
  const endpoint = runtime.env[endpointKey];
  if (!endpoint) {
    return unavailable(
      reviewer,
      `${endpointKey} is not provisioned on the backend.`,
      runtime,
      'blind_review.external_not_provisioned'
    );
  }
  let endpointUrl: URL;
  try {
    endpointUrl = new URL(endpoint);
  } catch {
    return unavailable(reviewer, `${endpointKey} is invalid.`, runtime);
  }
  if (endpointUrl.protocol !== 'https:') {
    return unavailable(reviewer, `${endpointKey} must use HTTPS.`, runtime);
  }
  const citations = extractCitationCandidates(request.generatedText);
  try {
    const response = await runtime.fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(runtime.env.MCP_GATEWAY_TOKEN
          ? { Authorization: `Bearer ${runtime.env.MCP_GATEWAY_TOKEN}` }
          : {}),
      },
      signal: AbortSignal.timeout(8_000),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `${reviewer}-${Date.now()}`,
        method: 'tools/call',
        params: {
          name: reviewer === 'citecheck' ? 'review_abstract_citations' : 'verify_citations',
          arguments: {
            citations,
            readOnly: true,
          },
        },
      }),
    });
    if (!response.ok) throw new Error(`${reviewer} MCP returned ${response.status}`);
    const parsed = parseMCPPayload(await response.json());
    return result(reviewer, parsed.status, parsed.summary, parsed.records, runtime);
  } catch (error) {
    return unavailable(
      reviewer,
      error instanceof Error ? error.message : `${reviewer} MCP verification failed.`,
      runtime
    );
  }
}

export async function runExternalReviewers(
  request: ExternalReviewRequest,
  runtime: ExternalReviewRuntime = DEFAULT_RUNTIME
): Promise<ExternalVerificationResult[]> {
  const tasks: Promise<ExternalVerificationResult>[] = [];
  if (request.reviewers.pubmed) tasks.push(runPubMed(request, runtime));
  if (request.reviewers.citecheck) tasks.push(runMCPReviewer('citecheck', request, runtime));
  if (request.reviewers['doi-mcp']) tasks.push(runMCPReviewer('doi-mcp', request, runtime));
  return Promise.all(tasks);
}
