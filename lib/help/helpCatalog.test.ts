import { describe, expect, it } from 'vitest';
import {
  getSuggestedHelpQuestions,
  listHelpArticles,
  resolveGuidedNavigation,
  searchHelpCatalog,
} from './helpCatalog';

describe('Help Catalog', () => {
  it('guides a Chinese Anthropic configuration question to the personal API article', () => {
    const result = searchHelpCatalog({
      locale: 'zh',
      query: 'Anthropic API 应该怎么配置？',
      context: {
        authenticated: false,
        activeModule: 'RSNA',
        provider: 'anthropic',
        textApiConfigured: false,
        imageApiConfigured: false,
      },
    });

    expect(result.mode).toBe('shortcut');
    expect(result.articles[0]).toMatchObject({ id: 'personal-api', locale: 'zh' });
    expect(result.shortcuts).toContain('open-model-settings');
  });

  it('publishes the same eight help topics in English and Chinese', () => {
    const expectedIds = [
      'ai-safety',
      'blind-review',
      'cloud-abstracts',
      'membership',
      'modules',
      'personal-api',
      'skills-mcp',
      'troubleshooting',
    ];

    expect(
      listHelpArticles('en')
        .map(({ id }) => id)
        .sort()
    ).toEqual(expectedIds);
    expect(
      listHelpArticles('zh')
        .map(({ id }) => id)
        .sort()
    ).toEqual(expectedIds);
  });

  it('renders the verified membership and cloud rules into localized articles', () => {
    const chineseMembership = listHelpArticles('zh').find(({ id }) => id === 'membership');
    const englishCloud = listHelpArticles('en').find(({ id }) => id === 'cloud-abstracts');

    expect(chineseMembership?.body).toContain('注册赠送 5 学分');
    expect(chineseMembership?.body).toContain('连续签到 7 天额外获得 1 学分');
    expect(chineseMembership?.body).toContain('摘要、生图或一键炼丹任务消耗 2 学分');
    expect(englishCloud?.body).toContain('30 abstracts');
    expect(englishCloud?.body).toContain('10 KB');
  });

  it('adapts suggested questions to guest and member state', () => {
    const guestQuestions = getSuggestedHelpQuestions('zh', { authenticated: false });
    const memberQuestions = getSuggestedHelpQuestions('zh', { authenticated: true });

    expect(guestQuestions.map(({ id }) => id)).toContain('how-to-register');
    expect(memberQuestions.map(({ id }) => id)).toContain('missing-credits');
    expect(guestQuestions).toHaveLength(6);
    expect(memberQuestions).toHaveLength(6);
  });

  it('prioritizes a troubleshooting shortcut when the current page reports an API error', () => {
    const questions = getSuggestedHelpQuestions('en', {
      authenticated: false,
      provider: 'anthropic',
      textApiConfigured: true,
      errorCode: 'provider_rate_limited',
    });

    expect(questions[0].id).toBe('api-not-responding');
    expect(questions[1].id).toBe('configure-anthropic');
  });

  it('resolves only allowlisted navigation actions', () => {
    expect(resolveGuidedNavigation('open-skills-mcp')).toEqual({
      destination: 'model-settings',
      panel: 'skills-mcp',
    });
    expect(resolveGuidedNavigation('javascript:alert(1)')).toBeNull();
  });
});
