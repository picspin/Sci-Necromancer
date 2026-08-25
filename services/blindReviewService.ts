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
import { getConferenceBlindReviewRules } from '@/lib/review/conferenceBlindReviewRules';
import { reviewAbstractBlind } from '@/lib/llm';

export interface BlindReviewRequest {
  conference: Exclude<Conference, 'IMAGE' | 'JACC' | 'ESC'>;
  sourceText: string;
  abstract?: AbstractData;
  target?: 'generated-abstract' | 'manuscript';
  locale: 'en' | 'zh';
  settings: BlindReviewSettings;
}

interface BlindReviewDependencies {
  modelReview: (
    prompt: string,
    target: 'generated-abstract' | 'manuscript'
  ) => Promise<BlindReviewModelAssessment>;
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
  modelReview: (prompt, target) =>
    reviewAbstractBlind(prompt, target === 'manuscript' ? 'manuscript' : 'abstract'),
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
  const target = request.target ?? (request.abstract ? 'generated-abstract' : 'manuscript');
  const generatedText =
    target === 'manuscript' ? request.sourceText.trim() : serializeAbstract(request.abstract!);
  if (!generatedText) throw new Error('blind_review.no_content');
  const prompt = buildBlindReviewPrompt({
    conference: request.conference,
    sourceText: request.sourceText,
    generatedText,
    target,
    conferenceRules: getConferenceBlindReviewRules(request.conference),
    locale: request.locale,
  });

  const selectedReviewers = (['pubmed', 'citecheck', 'doi-mcp'] as ExternalReviewer[]).filter(
    (reviewer) => request.settings.reviewers[reviewer]
  );
  const [modelAssessment, externalVerification] = await Promise.all([
    dependencies.modelReview(prompt, target),
    (selectedReviewers.length
      ? dependencies.externalReview({
          conference: request.conference,
          generatedText,
          title: request.abstract?.title,
          keywords: request.abstract?.keywords ?? [],
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
