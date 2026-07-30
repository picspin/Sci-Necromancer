export type LoadingScene = 'dna' | 'cell' | 'orbital' | 'molecule';

export function resolveLoadingScene(message: string): LoadingScene {
  const normalized = message.toLowerCase();
  if (/deep|reason|深度|推理/.test(normalized)) return 'orbital';
  if (/analy|review|分析|审核/.test(normalized)) return 'dna';
  if (/generat|creat|生成|创作/.test(normalized)) return 'cell';
  return 'molecule';
}
