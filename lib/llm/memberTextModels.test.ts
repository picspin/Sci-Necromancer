import { describe, expect, it } from 'vitest';
import { isAcceptedMemberTextModel, normalizeMemberTextModel } from './memberTextModels';

describe('member text model migration', () => {
  it('maps saved preferences to the two current public choices', () => {
    expect(normalizeMemberTextModel('glm-5.2')).toBe('deepseek-v4.1-flash');
    expect(normalizeMemberTextModel('gpt-5.6-luna')).toBe('gpt-5.6-terra');
    expect(normalizeMemberTextModel(undefined)).toBe('deepseek-v4.1-flash');
  });

  it('routes Terra to the approved deployment but never enables PTU', () => {
    expect(isAcceptedMemberTextModel('mga-gpt-5.6-terra-ptu')).toBe(false);
    expect(isAcceptedMemberTextModel('mga-gpt-terra-5.6')).toBe(false);
  });
});
