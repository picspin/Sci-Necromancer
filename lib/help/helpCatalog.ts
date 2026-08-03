import enArticles from '../../docs/help/en/articles.json';
import zhArticles from '../../docs/help/zh/articles.json';
import enShortcuts from '../../docs/help/en/shortcuts.json';
import zhShortcuts from '../../docs/help/zh/shortcuts.json';
import { HELP_FACTS } from './helpFacts';

export type HelpLocale = 'en' | 'zh';
export type HelpShortcutId =
  | 'open-model-settings'
  | 'open-member-panel'
  | 'open-abstract-manager'
  | 'open-skills-mcp'
  | 'open-blind-review'
  | 'open-conference-module'
  | 'open-github-issues';

export interface HelpPageContext {
  authenticated: boolean;
  activeModule?: string;
  provider?: 'google' | 'openai' | 'anthropic';
  textApiConfigured?: boolean;
  imageApiConfigured?: boolean;
  managedTextEnabled?: boolean;
  managedImageEnabled?: boolean;
  baseUrlKind?: 'official' | 'custom';
  requestStage?: string;
  errorCode?: string;
}

export interface HelpArticle {
  id: string;
  locale: HelpLocale;
  topic: string;
  title: string;
  summary: string;
  body: string;
  keywords: string[];
  shortcuts: HelpShortcutId[];
  states: Array<'guest' | 'member'>;
  uiDestination: string;
  lastVerified: string;
}

export interface HelpCatalogResult {
  mode: 'shortcut' | 'assisted';
  articles: HelpArticle[];
  shortcuts: HelpShortcutId[];
}

export interface SuggestedHelpQuestion {
  id: string;
  label: string;
  query: string;
  articleId: string;
  shortcutId: HelpShortcutId;
  audience: 'all' | 'guest' | 'member';
}

export interface GuidedNavigation {
  destination:
    | 'model-settings'
    | 'member-panel'
    | 'abstract-manager'
    | 'blind-review'
    | 'conference-navigation'
    | 'github-issues';
  panel?: 'personal-api' | 'skills-mcp';
}

const guidedNavigation: Record<HelpShortcutId, GuidedNavigation> = {
  'open-model-settings': { destination: 'model-settings', panel: 'personal-api' },
  'open-member-panel': { destination: 'member-panel' },
  'open-abstract-manager': { destination: 'abstract-manager' },
  'open-skills-mcp': { destination: 'model-settings', panel: 'skills-mcp' },
  'open-blind-review': { destination: 'blind-review' },
  'open-conference-module': { destination: 'conference-navigation' },
  'open-github-issues': { destination: 'github-issues' },
};

function hydrateArticle(article: HelpArticle): HelpArticle {
  const body = Object.entries(HELP_FACTS).reduce(
    (text, [key, value]) => text.split(`{{${key}}}`).join(String(value)),
    article.body
  );
  return { ...article, body };
}

const catalogs: Record<HelpLocale, HelpArticle[]> = {
  en: (enArticles as HelpArticle[]).map(hydrateArticle),
  zh: (zhArticles as HelpArticle[]).map(hydrateArticle),
};

const suggestedQuestions: Record<HelpLocale, SuggestedHelpQuestion[]> = {
  en: enShortcuts as SuggestedHelpQuestion[],
  zh: zhShortcuts as SuggestedHelpQuestion[],
};

const normalized = (value: string) => value.toLocaleLowerCase().normalize('NFKC');

function includesKeyword(query: string, keyword: string): boolean {
  const value = normalized(keyword);
  if (/^[a-z0-9]+$/.test(value) && value.length <= 3) {
    return new RegExp(`\\b${value}\\b`, 'i').test(query);
  }
  return query.includes(value);
}

export function listHelpArticles(locale: HelpLocale): HelpArticle[] {
  return catalogs[locale];
}

export function getSuggestedHelpQuestions(
  locale: HelpLocale,
  context: HelpPageContext
): SuggestedHelpQuestion[] {
  const audience = context.authenticated ? 'member' : 'guest';
  const score = (question: SuggestedHelpQuestion) => {
    if (question.id === 'api-not-responding' && context.errorCode) return 100;
    if (question.id === 'configure-anthropic' && context.provider === 'anthropic') return 80;
    if (question.id === 'api-not-responding' && context.textApiConfigured === false) return 70;
    if (question.id === 'use-modules' && context.activeModule) return 60;
    if (question.id === 'missing-credits' && context.authenticated) return 50;
    return 0;
  };
  return suggestedQuestions[locale]
    .filter((question) => question.audience === 'all' || question.audience === audience)
    .map((question, index) => ({ question, index, score: score(question) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ question }) => question)
    .slice(0, 6);
}

export function resolveGuidedNavigation(shortcutId: string): GuidedNavigation | null {
  return guidedNavigation[shortcutId as HelpShortcutId] ?? null;
}

export function searchHelpCatalog(input: {
  locale: HelpLocale;
  query: string;
  context: HelpPageContext;
}): HelpCatalogResult {
  const query = normalized(input.query);
  const state = input.context.authenticated ? 'member' : 'guest';
  const scored = catalogs[input.locale]
    .filter((article) => article.states.includes(state))
    .map((article) => ({
      article,
      score: article.keywords.reduce(
        (score, keyword) => score + (includesKeyword(query, keyword) ? 1 : 0),
        0
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  const ranked = scored.map(({ article }) => article);

  return {
    mode: (scored[0]?.score ?? 0) >= 2 ? 'shortcut' : 'assisted',
    articles: ranked,
    shortcuts: [...new Set(ranked.flatMap((article) => article.shortcuts))],
  };
}
