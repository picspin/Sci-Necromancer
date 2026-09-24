import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildDataFigureRoutingRequest,
  buildIllustrationCategoryRequest,
  buildIllustrationJournalRequest,
  buildPromptCompletenessRequest,
  DATA_CHART_TEMPLATE_IDS,
  ILLUSTRATION_CATEGORY_IDS,
  parseDataFigureRoutingResponse,
  parseIllustrationCategoryResponse,
  parseIllustrationJournalResponse,
  requestTypesafeFigureRouting,
  resolveUserChoice,
  sanitizeDataFigureRoutingInput,
} from './figureRouting';

const dataInput = {
  fields: [
    { alias: 'treatment_group', type: 'categorical' as const },
    { alias: 'response_rate', type: 'proportion' as const, unit: '%' },
    { alias: 'follow_up_month', type: 'continuous' as const, unit: 'month' },
  ],
  aggregateSummaries: [
    { key: 'n_groups', value: 2 },
    { key: 'n_observations', value: 120 },
  ],
  goal: 'Compare response rate over follow-up between treatment groups.',
};

function choice(allowed: readonly string[], selected: string, selectedProbability = 0.92) {
  const remainder = (1 - selectedProbability) / allowed.length;
  return {
    type: 'choice',
    choice: selected,
    probabilities: Object.fromEntries([
      ...allowed.map((id) => [id, id === selected ? selectedProbability : remainder]),
      ['unknown', remainder],
    ]),
    confidence: 0.9,
  };
}

describe('TypeSafe Jev figure routing contract', () => {
  afterEach(() => {
    delete process.env.TYPESAFE_API_KEY;
  });

  it('sends only bounded field metadata and aggregate summaries for data charts', () => {
    const request = buildDataFigureRoutingRequest(dataInput);
    expect(request.model).toBe('jev-1.13.0');
    expect(request.state.dataMetadata).toEqual(dataInput);
    expect(request.state.policy).toMatchObject({
      rawPatientRowsProvided: false,
      rawFreeTextCellsProvided: false,
    });
    expect(request.questions.chart_template.criteria).toHaveProperty('heatmap');
  });

  it.each([
    { rows: [{ patient_id: 'p1' }] },
    { cells: ['free text'] },
    { rawText: 'patient narrative' },
  ])('rejects raw data payload keys', (extra) => {
    expect(() => sanitizeDataFigureRoutingInput({ ...dataInput, ...extra } as unknown)).toThrow(
      'invalid_jev_data_figure_request'
    );
  });

  it('rejects unexpected keys inside field metadata', () => {
    expect(() =>
      sanitizeDataFigureRoutingInput({
        ...dataInput,
        fields: [{ alias: 'age', type: 'continuous', values: [1, 2, 3] }],
      })
    ).toThrow('invalid_jev_data_figure_fields');
  });

  it('accepts only a server-owned chart template and marks ambiguous results for review', () => {
    const payload = {
      model: 'jev-1.13.0',
      answers: { chart_template: choice(DATA_CHART_TEMPLATE_IDS, 'multi-panel-trend') },
    };
    const parsed = parseDataFigureRoutingResponse(payload);
    expect(parsed.selected).toBe('multi-panel-trend');
    expect(parsed.needsReview).toBe(false);
    expect(() =>
      parseDataFigureRoutingResponse({
        model: 'jev-1.13.0',
        answers: { chart_template: choice(DATA_CHART_TEMPLATE_IDS, 'invented-template') },
      })
    ).toThrow('invalid_jev_figure_response');
  });

  it('keeps illustration category and journal routing as dependent calls', () => {
    const category = buildIllustrationCategoryRequest({
      researchIntent: 'Show a clinical imaging workflow.',
    });
    expect(category?.state).toMatchObject({ allowedCategories: ILLUSTRATION_CATEGORY_IDS });
    expect(
      buildIllustrationJournalRequest({
        researchIntent: 'Show a clinical imaging workflow.',
        category: 'imaging-anatomy',
      })?.state
    ).toMatchObject({ confirmedCategory: 'imaging-anatomy' });
    expect(
      buildIllustrationJournalRequest({
        researchIntent: 'Show a clinical imaging workflow.',
        category: 'imaging-anatomy',
        userJournalStyle: 'radiology',
      })
    ).toBeNull();
    expect(
      buildIllustrationCategoryRequest({
        researchIntent: 'Show a clinical imaging workflow.',
        userCategory: 'imaging-anatomy',
      })
    ).toBeNull();
    const journal = parseIllustrationJournalResponse({
      model: 'jev-1.13.0',
      answers: {
        journal_style: choice(
          ['lancet', 'nature', 'nejm', 'science', 'jama-bmj', 'radiology', 'ieee', 'cell', 'pnas'],
          'radiology'
        ),
      },
    });
    expect(journal.selected).toBe('radiology');
  });

  it('lets validated user choices override advisory recommendations', () => {
    const recommendation = parseIllustrationCategoryResponse({
      model: 'jev-1.13.0',
      answers: { illustration_category: choice(ILLUSTRATION_CATEGORY_IDS, 'clinical-workflow') },
    });
    expect(resolveUserChoice('study-design', recommendation)).toBe('study-design');
    expect(resolveUserChoice(undefined, recommendation)).toBe('clinical-workflow');
  });

  it('keeps prompt completeness as a separate typed question', () => {
    const request = buildPromptCompletenessRequest({
      prompt: 'A mechanism pathway with labeled arrows.',
      category: 'mechanism-pathway',
    });
    expect(request.questions).toHaveProperty('prompt_completeness');
    expect(request.state).not.toHaveProperty('dataMetadata');
  });

  it('does not call the official endpoint without a server-side key', async () => {
    const fetchMock = vi.fn();
    await expect(requestTypesafeFigureRouting({}, fetchMock)).rejects.toMatchObject({
      code: 'typesafe_jev_unconfigured',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('parses unknown as a review state instead of selecting a template', () => {
    const probabilities = Object.fromEntries(
      [...DATA_CHART_TEMPLATE_IDS, 'unknown'].map((id) => [id, id === 'unknown' ? 0.92 : 0.008])
    );
    const parsed = parseDataFigureRoutingResponse({
      model: 'jev-1.13.0',
      answers: {
        chart_template: { type: 'choice', choice: 'unknown', probabilities, confidence: 0.9 },
      },
    });
    expect(parsed.selected).toBe('unknown');
    expect(parsed.needsReview).toBe(true);
  });
});
