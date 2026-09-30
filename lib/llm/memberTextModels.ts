export const DEFAULT_MEMBER_TEXT_MODEL = 'deepseek-v4.1-flash' as const;

export type MemberTextModel = 'deepseek-v4.1-flash' | 'gpt-5.6-terra';
export type AcceptedMemberTextModel = MemberTextModel | 'glm-5.2' | 'gpt-5.6-luna';

export function normalizeMemberTextModel(value: unknown): MemberTextModel {
  return value === 'gpt-5.6-terra' || value === 'gpt-5.6-luna'
    ? 'gpt-5.6-terra'
    : DEFAULT_MEMBER_TEXT_MODEL;
}

export function isAcceptedMemberTextModel(value: unknown): value is AcceptedMemberTextModel {
  return (
    value === DEFAULT_MEMBER_TEXT_MODEL ||
    value === 'gpt-5.6-terra' ||
    value === 'glm-5.2' ||
    value === 'gpt-5.6-luna'
  );
}
