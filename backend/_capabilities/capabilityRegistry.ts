import { MemberServiceError } from '../_member/memberService.js';
import {
  MGA_RESEARCH_AGENT_ID,
  MGA_RESEARCH_TOOL_IDS,
} from '../../lib/capabilities/managedResearchCapabilities.js';

export type ManagedCapabilityKind = 'mcp' | 'agent';

export interface MemberCapabilityDescriptor {
  id: string;
  kind: ManagedCapabilityKind;
  labelKey: string;
  descriptionKey: string;
  readOnly: true;
  memberOnly: true;
  bonusCost: 0 | 1;
}

const RESEARCH_TOOL_KEYS = new Map<string, string>([
  [MGA_RESEARCH_TOOL_IDS[0], 'pubmed_data_source'],
  [MGA_RESEARCH_TOOL_IDS[1], 'semantic_scholar'],
  [MGA_RESEARCH_TOOL_IDS[2], 'hubble_literature_abstracts'],
]);

const MEMBER_CAPABILITIES: readonly MemberCapabilityDescriptor[] = Object.freeze([
  {
    id: MGA_RESEARCH_TOOL_IDS[0],
    kind: 'mcp',
    labelKey: 'model_manager.capability_pubmed',
    descriptionKey: 'model_manager.capability_pubmed_help',
    readOnly: true,
    memberOnly: true,
    bonusCost: 0,
  },
  {
    id: MGA_RESEARCH_TOOL_IDS[1],
    kind: 'mcp',
    labelKey: 'model_manager.capability_semantic_scholar',
    descriptionKey: 'model_manager.capability_semantic_scholar_help',
    readOnly: true,
    memberOnly: true,
    bonusCost: 0,
  },
  {
    id: MGA_RESEARCH_TOOL_IDS[2],
    kind: 'mcp',
    labelKey: 'model_manager.capability_hubble_abstracts',
    descriptionKey: 'model_manager.capability_hubble_abstracts_help',
    readOnly: true,
    memberOnly: true,
    bonusCost: 0,
  },
  {
    id: MGA_RESEARCH_AGENT_ID,
    kind: 'agent',
    labelKey: 'model_manager.capability_research_agent',
    descriptionKey: 'model_manager.capability_research_agent_help',
    readOnly: true,
    memberOnly: true,
    bonusCost: 1,
  },
]);

export function listMemberCapabilities(): MemberCapabilityDescriptor[] {
  return MEMBER_CAPABILITIES.map((capability) => ({ ...capability }));
}

export function resolveResearchToolKeys(capabilityIds: readonly string[]): string[] {
  if (!capabilityIds.length || capabilityIds.length > RESEARCH_TOOL_KEYS.size) {
    throw new MemberServiceError('invalid_capability_selection', 400);
  }
  const uniqueIds = [...new Set(capabilityIds)];
  if (uniqueIds.length !== capabilityIds.length) {
    throw new MemberServiceError('invalid_capability_selection', 400);
  }
  const toolKeys = uniqueIds.map((id) => RESEARCH_TOOL_KEYS.get(id));
  if (toolKeys.some((key) => !key)) {
    throw new MemberServiceError('invalid_capability_selection', 400);
  }
  return toolKeys as string[];
}

export function assertResearchAgent(capabilityId: string): void {
  if (capabilityId !== MGA_RESEARCH_AGENT_ID) {
    throw new MemberServiceError('unsupported_capability', 400);
  }
}
