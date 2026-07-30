export type ImageModelProvider = 'managed' | 'google' | 'openai';

export interface ImageModelCapabilities {
  generation: boolean;
  editing: boolean;
}

export function getImageModelCapabilities(
  provider: ImageModelProvider,
  modelId: string | null | undefined
): ImageModelCapabilities {
  const normalized = modelId?.trim().toLowerCase() || '';
  if (!normalized) return { generation: false, editing: false };

  if (provider === 'managed') {
    if (normalized === 'gpt-image-2') return { generation: true, editing: true };
    if (normalized === 'nano-banana-pro') return { generation: true, editing: false };
    return { generation: false, editing: false };
  }

  if (provider === 'google') {
    return {
      generation: true,
      editing: /gemini.*image|image.*gemini/.test(normalized) && !normalized.includes('imagen'),
    };
  }

  return {
    generation: true,
    editing: normalized.includes('gpt-image'),
  };
}
