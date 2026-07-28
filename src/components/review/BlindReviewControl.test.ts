import { computed } from 'vue';
import { createI18n } from 'vue-i18n';
import { fireEvent, render, screen } from '@testing-library/vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BlindReviewControl from './BlindReviewControl.vue';

const { runBlindReview } = vi.hoisted(() => ({ runBlindReview: vi.fn() }));

vi.mock('@/services/blindReviewService', () => ({ runBlindReview }));
vi.mock('@/composables/useSettings', () => ({
  useSettings: () => ({
    settings: computed(() => ({
      blindReview: {
        enabled: true,
        reviewers: { pubmed: true, citecheck: false, 'doi-mcp': false },
      },
    })),
  }),
}));

const i18n = createI18n({
  legacy: false,
  locale: 'zh',
  messages: {
    zh: {
      blind_review: {
        title: '独立盲审',
        description: '对生成内容进行独立核验。',
        external_data_notice: '外部审核会发送有限的引文检索数据。',
        button: '盲审',
        running: '盲审中…',
        report_title: '独立盲审报告',
        status: { 'verified-with-limitations': '有限验证', 'action-required': '需要处理' },
        recommendation: { 'minor-revision': '小修' },
        external_title: '外部验证',
        finding_title: '审核发现',
        no_findings: '未发现明确问题',
        disclaimer: '自动审核不能证明研究数据真实，也不能替代作者、机构或会议的正式审核。',
        reviewer: { pubmed: 'PubMed', citecheck: 'CiteCheck', 'doi-mcp': 'DOI MCP' },
        external_status: {
          verified: '已检索',
          'issues-found': '发现问题',
          unavailable: '不可用',
          'not-run': '未运行',
        },
        verification_status: {
          supported: '有支持',
          verified: '已核验',
          unsupported: '不支持',
          contradictory: '矛盾',
          'not-verifiable': '无法核验',
        },
        error: '盲审失败',
      },
    },
  },
});

describe('BlindReviewControl', () => {
  beforeEach(() => {
    runBlindReview.mockReset();
    runBlindReview.mockResolvedValue({
      version: 'blind-review-v1',
      conference: 'RSNA',
      reviewedAt: '2026-07-28T00:00:00.000Z',
      overallStatus: 'verified-with-limitations',
      modelAssessment: {
        recommendation: 'minor-revision',
        summary: '需要作者复核。',
        findings: [],
      },
      externalVerification: [
        {
          reviewer: 'pubmed',
          status: 'verified',
          checkedAt: '2026-07-28T00:00:00.000Z',
          summary: '检索到相关研究。',
          records: [],
        },
      ],
      disclaimer: 'blind_review.disclaimer',
    });
  });

  it('shows one shared blind-review action and a structured report', async () => {
    const view = render(BlindReviewControl, {
      props: {
        conference: 'RSNA',
        sourceText: '原始研究材料',
        abstract: { impact: '影响', synopsis: '概要', abstract: '摘要', keywords: [] },
      },
      global: { plugins: [i18n] },
    });

    await fireEvent.click(screen.getByRole('button', { name: '盲审' }));

    expect(await screen.findByText('独立盲审报告')).toBeTruthy();
    expect(
      screen.getByText('自动审核不能证明研究数据真实，也不能替代作者、机构或会议的正式审核。')
    ).toBeTruthy();
    expect(runBlindReview).toHaveBeenCalledOnce();

    await view.rerender({
      conference: 'RSNA',
      sourceText: '更新后的原始研究材料',
      abstract: { impact: '影响', synopsis: '概要', abstract: '新摘要', keywords: [] },
    });
    expect(screen.queryByText('独立盲审报告')).toBeNull();
  });

  it('discards an in-flight report after the reviewed content changes', async () => {
    let resolveReview: ((value: unknown) => void) | undefined;
    runBlindReview.mockImplementationOnce(
      () => new Promise((resolve) => (resolveReview = resolve))
    );
    const view = render(BlindReviewControl, {
      props: {
        conference: 'RSNA',
        sourceText: '原始材料',
        abstract: { impact: '', synopsis: '', abstract: '旧摘要', keywords: [] },
      },
      global: { plugins: [i18n] },
    });

    await fireEvent.click(screen.getByRole('button', { name: '盲审' }));
    await view.rerender({
      conference: 'RSNA',
      sourceText: '新材料',
      abstract: { impact: '', synopsis: '', abstract: '新摘要', keywords: [] },
    });
    resolveReview?.({
      version: 'blind-review-v1',
      conference: 'RSNA',
      reviewedAt: '2026-07-28T00:00:00.000Z',
      overallStatus: 'verified-with-limitations',
      modelAssessment: { recommendation: 'minor-revision', summary: '旧报告', findings: [] },
      externalVerification: [],
      disclaimer: 'blind_review.disclaimer',
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(screen.queryByText('独立盲审报告')).toBeNull();
  });
});
