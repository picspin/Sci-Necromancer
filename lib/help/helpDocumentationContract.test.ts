import { describe, expect, it } from 'vitest';
import enArticles from '../../docs/help/en/articles.json';
import zhArticles from '../../docs/help/zh/articles.json';
import enShortcuts from '../../docs/help/en/shortcuts.json';
import zhShortcuts from '../../docs/help/zh/shortcuts.json';
import { listHelpArticles, resolveGuidedNavigation } from './helpCatalog';

const REQUIRED_TOPICS = [
  'modules',
  'personal-api',
  'membership',
  'cloud-abstracts',
  'blind-review',
  'skills-mcp',
  'troubleshooting',
  'ai-safety',
].sort();

describe('help documentation contract', () => {
  it('keeps all eight article IDs and topics aligned in Chinese and English', () => {
    for (const articles of [enArticles, zhArticles]) {
      expect(articles.map(({ id }) => id).sort()).toEqual(REQUIRED_TOPICS);
      expect(articles.map(({ topic }) => topic).sort()).toEqual(REQUIRED_TOPICS);
    }
  });

  it('keeps shortcuts grounded in an article and an allowlisted navigation target', () => {
    for (const [articles, shortcuts] of [
      [enArticles, enShortcuts],
      [zhArticles, zhShortcuts],
    ] as const) {
      const articleIds = new Set(articles.map(({ id }) => id));
      for (const shortcut of shortcuts) {
        expect(articleIds.has(shortcut.articleId)).toBe(true);
        expect(resolveGuidedNavigation(shortcut.shortcutId)).not.toBeNull();
      }
    }
  });

  it('renders shared facts and requires verification metadata without arbitrary links', () => {
    for (const locale of ['en', 'zh'] as const) {
      for (const article of listHelpArticles(locale)) {
        expect(article.body).not.toMatch(/{{[^}]+}}/);
        expect(article.body).not.toMatch(/https?:\/\//i);
        expect(article.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(article.states.length).toBeGreaterThan(0);
        for (const shortcut of article.shortcuts) {
          expect(resolveGuidedNavigation(shortcut)).not.toBeNull();
        }
      }
    }
  });
});
