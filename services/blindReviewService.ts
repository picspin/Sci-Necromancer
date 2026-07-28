import type {
  AbstractData,
  BlindReviewModelAssessment,
  BlindReviewReport,
  BlindReviewSettings,
  Conference,
  ExternalVerificationResult,
  ExternalReviewer,
} from '@/types';
import { buildBlindReviewPrompt, mergeBlindReviewReport } from '@/lib/review/blindReview';
import { reviewAbstractBlind } from '@/lib/llm';

export interface BlindReviewRequest {
  conference: Exclude<Conference, 'IMAGE' | 'JACC'>;
  sourceText: string;
  abstract: AbstractData;
  locale: 'en' | 'zh';
  settings: BlindReviewSettings;
}

interface BlindReviewDependencies {
  modelReview: (prompt: string) => Promise<BlindReviewModelAssessment>;
  externalReview: (
    payload: Pick<BlindReviewRequest, 'conference'> & {
      generatedText: string;
      title?: string;
      keywords: string[];
      reviewers: BlindReviewSettings['reviewers'];
    }
  ) => Promise<ExternalVerificationResult[]>;
  now: () => string;
}

function serializeAbstract(abstract: AbstractData): string {
  return [
    abstract.title && `TITLE:\n${abstract.title}`,
    abstract.impact && `IMPACT:\n${abstract.impact}`,
    abstract.synopsis && `SYNOPSIS:\n${abstract.synopsis}`,
    abstract.abstract && `ABSTRACT:\n${abstract.abstract}`,
    abstract.keywords.length && `KEYWORDS:\n${abstract.keywords.join(', ')}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

const defaultDependencies: BlindReviewDependencies = {
  modelReview: reviewAbstractBlind,
  externalReview: async (payload) => {
    const response = await fetch('/api/blind-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`blind_review.external_request_failed:${response.status}`);
    const data = (await response.json()) as { results?: ExternalVerificationResult[] };
    return Array.isArray(data.results) ? data.results : [];
  },
  now: () => new Date().toISOString(),
};

export async function runBlindReview(
  request: BlindReviewRequest,
  dependencies: BlindReviewDependencies = defaultDependencies
): Promise<BlindReviewReport> {
  if (!request.settings.enabled) throw new Error('blind_review.disabled');
  const generatedText = serializeAbstract(request.abstract);
  if (!generatedText) throw new Error('blind_review.no_content');
  const prompt = buildBlindReviewPrompt({
    conference: request.conference,
    sourceText: request.sourceText,
    generatedText,
    locale: request.locale,
  });

  const selectedReviewers = (['pubmed', 'citecheck', 'doi-mcp'] as ExternalReviewer[]).filter(
    (reviewer) => request.settings.reviewers[reviewer]
  );
  const [modelAssessment, externalVerification] = await Promise.all([
    dependencies.modelReview(prompt),
    (selectedReviewers.length
      ? dependencies.externalReview({
          conference: request.conference,
          generatedText,
          title: request.abstract.title,
          keywords: request.abstract.keywords,
          reviewers: request.settings.reviewers,
        })
      : Promise.resolve([])
    ).catch((): ExternalVerificationResult[] =>
      selectedReviewers.map((reviewer) => ({
        reviewer,
        status: 'unavailable',
        checkedAt: dependencies.now(),
        summary: 'The backend evidence service could not be reached.',
        summaryKey: 'blind_review.external_service_failed',
        records: [],
      }))
    ),
  ]);

  return mergeBlindReviewReport(modelAssessment, externalVerification, {
    conference: request.conference,
    reviewedAt: dependencies.now(),
  });
}
