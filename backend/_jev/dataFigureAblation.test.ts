import { describe, it, expect } from 'vitest';
import {
  buildDataFigureAssessmentRequest,
  buildDataFigureRoutingRequest,
  parseDataFigureAssessmentResponse,
  parseDataFigureRoutingResponse,
} from './figureRouting';
import { FIGURE_TEMPLATES } from '../../lib/figure/dataFigureTemplates';

describe('synthetic Jev contract ablation (not a model quality benchmark)', () => {
  it('compares routing-only v2 and v3 with assessment questions on the same metadata and scores', () => {
    const input = {
      fields: [
        { alias: 'group', type: 'categorical' as const },
        { alias: 'value', type: 'continuous' as const, unit: 'score' },
      ],
      goal: 'Compare supplied groups',
    };
    const answers = Object.fromEntries(
      Object.keys(FIGURE_TEMPLATES).map((id) => [
        id,
        { type: 'noul', noul: id === 'grouped-bar' ? 0.93 : 0.1 },
      ])
    );
    const baselineRequest = buildDataFigureRoutingRequest(input),
      fullRequest = buildDataFigureAssessmentRequest(input);
    const baseline = parseDataFigureRoutingResponse({ model: 'jev-1.13.0', answers });
    const full = parseDataFigureAssessmentResponse({
      model: 'jev-1.13.0',
      answers: {
        ...answers,
        metadata_length: { type: 'noul', noul: 0.85 },
        metadata_content: { type: 'noul', noul: 0.73 },
      },
    });
    expect(full.candidates).toEqual(baseline.candidates);
    expect(full.assessment).toEqual({ lengthAdequacy: 0.85, contentReadiness: 0.73 });
    expect(baseline).not.toHaveProperty('assessment');
    const measurement = {
      baseline: {
        questions: Object.keys(baselineRequest.questions).length,
        requestBytes: Buffer.byteLength(JSON.stringify(baselineRequest)),
        candidates: baseline.candidates.length,
      },
      full: {
        questions: Object.keys(fullRequest.questions).length,
        requestBytes: Buffer.byteLength(JSON.stringify(fullRequest)),
        candidates: full.candidates.length,
      },
    };
    process.stdout.write(`SYNTHETIC_ABLATION ${JSON.stringify(measurement)}\n`);
  });
});
