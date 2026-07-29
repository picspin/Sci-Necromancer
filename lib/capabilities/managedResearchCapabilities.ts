export const MGA_RESEARCH_AGENT_ID = 'mga-research-verification-agent' as const;
export const MGA_RESEARCH_TOOL_IDS = [
  'mga-pubmed',
  'mga-semantic-scholar',
  'mga-hubble-literature-abstracts',
] as const;

export type MGAResearchToolId = (typeof MGA_RESEARCH_TOOL_IDS)[number];
export type MGAResearchAgentId = typeof MGA_RESEARCH_AGENT_ID;

export interface ManagedResearchSelection {
  skillsEnabled?: boolean;
  mcpEnabled?: boolean;
  managedEnabledIds?: readonly string[];
}

export function isMGAResearchToolId(id: string): id is MGAResearchToolId {
  return MGA_RESEARCH_TOOL_IDS.some((candidate) => candidate === id);
}

export function enabledMGAResearchToolIds(ids: readonly string[]): MGAResearchToolId[] {
  return ids.filter(isMGAResearchToolId);
}

export function hasEnabledMGAResearchAgent(selection?: ManagedResearchSelection): boolean {
  const ids = selection?.managedEnabledIds || [];
  return (
    selection?.skillsEnabled !== false &&
    selection?.mcpEnabled !== false &&
    ids.includes(MGA_RESEARCH_AGENT_ID) &&
    ids.some(isMGAResearchToolId)
  );
}
