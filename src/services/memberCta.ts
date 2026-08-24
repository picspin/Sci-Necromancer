export const OPEN_MEMBER_PANEL_EVENT = 'sci-necromancer:open-member';

export function openMemberPanel(): void {
  window.dispatchEvent(new CustomEvent(OPEN_MEMBER_PANEL_EVENT));
}
