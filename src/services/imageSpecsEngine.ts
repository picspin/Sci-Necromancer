/**
 * Rule-based completion engine for Image Specifications
 * Uses regex + dictionary matching to provide smart autocomplete
 * Covers ~90% of input scenarios without LLM calls
 */

import type {
  ImageSpecField,
  ImageSpecCategory,
  CompletionSuggestion,
  TriggerMapping,
  StructuredImagePrompt,
} from '@/types';

// ============================================================================
// FIELD DEFINITIONS & TRIGGER MAPPINGS
// ============================================================================

const FIELD_DEFINITIONS: Record<ImageSpecCategory, { triggers: string[]; values: string[] }> = {
  research: {
    triggers: ['research', 'type', 'field', 'area', 'domain', 'study', 'scientific'],
    values: [
      'biomedical',
      'clinical',
      'physics',
      'computer science',
      'neuroscience',
      'radiology',
      'cardiology',
      'oncology',
      'pathology',
      'molecular biology',
      'genetics',
      'pharmacology',
      'epidemiology',
    ],
  },
  journal: {
    triggers: [
      'journal',
      'style',
      'publication',
      'format',
      'nature',
      'jama',
      'nejm',
      'ieee',
      'lancet',
    ],
    values: [
      'Nature',
      'JAMA',
      'NEJM',
      'IEEE',
      'Lancet',
      'PNAS',
      'Science',
      'Cell',
      'Radiology',
      'JACC',
      'European Heart Journal',
      'AJR',
      'JMR',
      'MRM',
    ],
  },
  layout: {
    triggers: ['layout', 'row', 'column', 'grid', 'panel', 'arrange', 'structure', 'organize'],
    values: [
      'single',
      'rowed',
      'columned',
      'T-styled',
      '2x2 grid',
      '3x3 grid',
      '2x3 grid',
      'side-by-side',
      'stacked',
      'split horizontal',
      'split vertical',
      'triptych',
    ],
  },
  style: {
    triggers: ['color', 'palette', 'mono', 'grayscale', 'theme', 'aesthetic', 'look', 'tone'],
    values: [
      'colorful',
      'grayscale',
      'monochrome',
      'scientific blue',
      'warm tones',
      'cool tones',
      'high contrast',
      'muted',
      'vibrant',
      'professional',
      'minimalist',
      'medical imaging',
    ],
  },
  format: {
    triggers: [
      'size',
      'resolution',
      'dpi',
      'aspect',
      'ratio',
      'dimension',
      'pixel',
      'width',
      'height',
    ],
    values: [
      '1024x1024',
      '1920x1080',
      '1280x720',
      '2048x2048',
      '300dpi',
      '150dpi',
      '16:9',
      '4:3',
      '1:1',
      'square',
      'portrait',
      'landscape',
    ],
  },
  elements: {
    triggers: [
      'element',
      'arrow',
      'label',
      'annotation',
      'scale',
      'bar',
      'legend',
      'axis',
      'marker',
      'text',
      'box',
    ],
    values: [
      'labeled arrows',
      'scale bar',
      'annotations',
      'legend',
      'axis labels',
      'error bars',
      'p-values',
      'significance markers',
      'ROI markers',
      'measurement lines',
      'color bar',
      'inset magnification',
    ],
  },
};

// Build regex patterns from triggers
function buildTriggerMappings(): TriggerMapping[] {
  const mappings: TriggerMapping[] = [];

  for (const [category, definition] of Object.entries(FIELD_DEFINITIONS)) {
    const patternStr = definition.triggers.join('|');
    mappings.push({
      pattern: new RegExp(`\\b(${patternStr})\\b`, 'i'),
      category: category as ImageSpecCategory,
      values: definition.values,
    });
  }

  return mappings;
}

const TRIGGER_MAPPINGS = buildTriggerMappings();

// ============================================================================
// IMAGE SPECS ENGINE CLASS
// ============================================================================

export class ImageSpecsEngine {
  private triggerMappings: TriggerMapping[];

  constructor() {
    this.triggerMappings = TRIGGER_MAPPINGS;
  }

  /**
   * Parse user input and extract structured fields
   */
  parseInput(input: string): ImageSpecField[] {
    const fields: ImageSpecField[] = [];
    const normalizedInput = input.toLowerCase();

    // Check each category for matches
    for (const mapping of this.triggerMappings) {
      // Find if any trigger word is present
      const triggerMatch = mapping.pattern.exec(normalizedInput);
      if (triggerMatch) {
        // Look for a matching value in the input
        for (const value of mapping.values) {
          if (normalizedInput.includes(value.toLowerCase())) {
            fields.push({
              key: this.getKeyForCategory(mapping.category),
              value: value,
              category: mapping.category,
              isValid: true,
            });
            break; // Only add one match per category
          }
        }
      }
    }

    // Also try to extract values directly without trigger words
    for (const mapping of this.triggerMappings) {
      // Skip if we already have a field for this category
      if (fields.some((f) => f.category === mapping.category)) continue;

      for (const value of mapping.values) {
        if (normalizedInput.includes(value.toLowerCase())) {
          fields.push({
            key: this.getKeyForCategory(mapping.category),
            value: value,
            category: mapping.category,
            isValid: true,
          });
          break;
        }
      }
    }

    return fields;
  }

  /**
   * Get completion suggestions based on cursor position and current input
   */
  getSuggestions(input: string, cursorPos: number): CompletionSuggestion[] {
    const suggestions: CompletionSuggestion[] = [];

    // Get the word being typed (up to cursor)
    const textBeforeCursor = input.slice(0, cursorPos);
    const words = textBeforeCursor.split(/\s+/);
    const currentWord = words[words.length - 1]?.toLowerCase() || '';

    if (currentWord.length < 2) {
      return suggestions;
    }

    // Check each category for matching suggestions
    for (const mapping of this.triggerMappings) {
      // Check if current word matches any trigger
      const matchesTrigger = mapping.pattern.test(currentWord);

      // Check if current word is a partial match for any value
      for (const value of mapping.values) {
        const lowerValue = value.toLowerCase();

        // Suggest if:
        // 1. The word being typed matches a trigger (show all values for that category)
        // 2. The word being typed is a prefix of a value
        if (matchesTrigger || lowerValue.startsWith(currentWord)) {
          suggestions.push({
            text: value,
            category: mapping.category,
            description: `${mapping.category}: ${value}`,
          });
        }
      }
    }

    // Remove duplicates and limit results
    const uniqueSuggestions = suggestions.filter(
      (s, i, arr) => arr.findIndex((x) => x.text === s.text) === i
    );

    return uniqueSuggestions.slice(0, 10);
  }

  /**
   * Convert fields to structured JSON for LLM API
   */
  toJSON(fields: ImageSpecField[]): string {
    const prompt: StructuredImagePrompt = {
      research_type: this.getFieldValue(fields, 'research') || 'biomedical',
      journal_style: this.getFieldValue(fields, 'journal') || 'Nature',
      layout: this.getFieldValue(fields, 'layout') || 'single',
      color_palette: this.getFieldValue(fields, 'style') || 'professional',
      aspect_ratio: this.extractAspectRatio(this.getFieldValue(fields, 'format')),
      resolution: this.getFieldValue(fields, 'format') || '1024x1024',
      elements: this.parseElements(this.getFieldValue(fields, 'elements')),
      notes: '',
    };

    return JSON.stringify(prompt, null, 2);
  }

  /**
   * Validate and correct fields
   */
  validateFields(fields: ImageSpecField[]): { valid: boolean; corrected: ImageSpecField[] } {
    const corrected: ImageSpecField[] = [];
    let valid = true;

    for (const field of fields) {
      const definition = FIELD_DEFINITIONS[field.category];
      if (!definition) {
        valid = false;
        continue;
      }

      // Check if value is in the allowed list (case-insensitive)
      const matchedValue = definition.values.find(
        (v) => v.toLowerCase() === field.value.toLowerCase()
      );

      if (matchedValue) {
        corrected.push({
          ...field,
          value: matchedValue, // Use properly cased version
          isValid: true,
        });
      } else {
        // Try to find closest match
        const closestMatch = this.findClosestMatch(field.value, definition.values);
        valid = false;
        corrected.push({
          ...field,
          value: closestMatch || field.value,
          isValid: !!closestMatch,
        });
      }
    }

    return { valid, corrected };
  }

  /**
   * Generate raw text from fields (reverse of parsing)
   */
  fieldsToText(fields: ImageSpecField[]): string {
    const parts: string[] = [];

    for (const field of fields) {
      parts.push(`${field.key}: ${field.value}`);
    }

    return parts.join(', ');
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private getKeyForCategory(category: ImageSpecCategory): string {
    const keyMap: Record<ImageSpecCategory, string> = {
      research: 'research_type',
      journal: 'journal_style',
      layout: 'layout',
      style: 'color_palette',
      format: 'resolution',
      elements: 'elements',
    };
    return keyMap[category];
  }

  private getFieldValue(fields: ImageSpecField[], category: ImageSpecCategory): string | undefined {
    const field = fields.find((f) => f.category === category);
    return field?.value;
  }

  private extractAspectRatio(format: string | undefined): string {
    if (!format) return '1:1';
    if (format.includes('16:9')) return '16:9';
    if (format.includes('4:3')) return '4:3';
    if (format.includes('1:1') || format.includes('square')) return '1:1';
    if (format.includes('1920x1080')) return '16:9';
    if (format.includes('1024x1024') || format.includes('2048x2048')) return '1:1';
    return '1:1';
  }

  private parseElements(elements: string | undefined): string[] {
    if (!elements) return [];
    return elements
      .split(/[,;]/)
      .map((e) => e.trim())
      .filter(Boolean);
  }

  private findClosestMatch(input: string, candidates: string[]): string | null {
    const lowerInput = input.toLowerCase();

    // First try prefix match
    const prefixMatch = candidates.find((c) => c.toLowerCase().startsWith(lowerInput));
    if (prefixMatch) return prefixMatch;

    // Then try contains match
    const containsMatch = candidates.find((c) => c.toLowerCase().includes(lowerInput));
    if (containsMatch) return containsMatch;

    // Try reverse contains (input contains candidate)
    const reverseMatch = candidates.find((c) => lowerInput.includes(c.toLowerCase()));
    if (reverseMatch) return reverseMatch;

    return null;
  }
}

// Export singleton instance
export const imageSpecsEngine = new ImageSpecsEngine();

// Export utility functions
export function getFieldDefinitions() {
  return FIELD_DEFINITIONS;
}
