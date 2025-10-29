/**
 * Meme translations for creative features
 * Maps English creative terms to playful Chinese internet meme translations
 */
export const memeTranslations: Record<string, string> = {
  'Creative Mode': '邪修模式',
  'Creative Expansion': '邪修模式',
  'Creative Generation': '邪修生成',
  'Generate Creatively': '一键炼丹',
  'Generate Figure': '筑基',
  'Evil Mode': '邪恶模式',
  'Sci-Evil': 'SCI邪修',
  'Dark Arts': '黑暗艺术',
  'Necromancy': '死灵法术',
  'Abstract Summoning': '摘要召唤',
  'Paper Resurrection': '论文复活',
  'Citation Magic': '引用魔法',
  'Research Alchemy': '研究炼金术',
};

/**
 * Get meme translation for a given key
 * Falls back to regular translation if no meme translation exists
 */
export function getMemeTranslation(key: string, t: (key: string) => string): string {
  return memeTranslations[key] || t(key);
}

/**
 * Check if a key has a meme translation
 */
export function hasMemeTranslation(key: string): boolean {
  return key in memeTranslations;
}