import type { Settings } from '../../types';
import { hasEnabledMGAResearchAgent } from '../capabilities/managedResearchCapabilities';

type ImageCapabilityProvider = 'nano-banana-pro' | 'gpt-image-2';

const present = (value: unknown): boolean => typeof value === 'string' && value.trim().length > 0;

export function hasTextByok(settings: Settings): boolean {
  switch (settings.provider) {
    case 'google':
      return present(settings.googleApiKey) && present(settings.model);
    case 'openai':
      return present(settings.openAIApiKey) && present(settings.openAITextModel);
    case 'anthropic':
      return present(settings.anthropicApiKey) && present(settings.anthropicTextModel);
  }
}

export function hasImageByok(settings: Settings, provider: ImageCapabilityProvider): boolean {
  if (provider === 'nano-banana-pro') {
    return present(settings.googleApiKey) && present(settings.googleImageModel);
  }
  return present(settings.openAIApiKey) && present(settings.openAIImageModel);
}

export type CapabilityRoute = 'byok' | 'managed' | 'unavailable';

export function resolveTextRoute(settings: Settings, memberAvailable: boolean): CapabilityRoute {
  if (hasTextByok(settings)) return 'byok';
  return memberAvailable && settings.memberManagedTextEnabled ? 'managed' : 'unavailable';
}

export function hasManagedResearchAgent(settings: Settings): boolean {
  return hasEnabledMGAResearchAgent(settings.capabilities);
}

export function resolveBlindReviewRoute(
  settings: Settings,
  memberAvailable: boolean
): CapabilityRoute {
  if (hasTextByok(settings)) return 'byok';
  return memberAvailable && (settings.memberManagedTextEnabled || hasManagedResearchAgent(settings))
    ? 'managed'
    : 'unavailable';
}

export function resolveImageRoute(
  settings: Settings,
  provider: ImageCapabilityProvider,
  memberAvailable: boolean
): CapabilityRoute {
  if (hasImageByok(settings, provider)) return 'byok';
  const enabled =
    provider === 'nano-banana-pro'
      ? (settings.memberManagedNanoBananaEnabled ?? settings.memberManagedImageEnabled)
      : settings.memberManagedGptImageEnabled;
  return memberAvailable && Boolean(enabled) ? 'managed' : 'unavailable';
}
