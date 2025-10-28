import { WritingStyleConfig } from '../../types';

/**
 * Default writing style configuration for academic abstracts
 * Follows ISMRM guidelines and eliminates AI-generated tone
 */
export const DEFAULT_WRITING_STYLE: WritingStyleConfig = {
  balanceFormalConversational: true,
  clearSubjects: true,
  shortSentences: true,
  rhythmControl: true,
  faithfulnessToOriginal: true,
  styleConsistency: true,
  naturalExpression: true,
  logicalRigor: true,
  eliminateAITone: true,
  prohibitedPhrases: [
    'It is worth noting that',
    'It is worth noting',
    'It is not difficult to find',
    'Based on the above analysis',
    'In conclusion, this study demonstrates',
    'The findings of this study suggest',
    'This paper explores',
    'Results indicated that',
    'Our results show that',
    'It should be noted that',
    'It is important to note',
    'It is interesting to note',
    'As can be seen',
    'As shown above',
    'As mentioned earlier',
    'As previously stated',
    'Furthermore, it is worth mentioning',
    'Additionally, it should be emphasized',
    'Moreover, it is clear that',
    'Notably',
    'Interestingly',
    'Importantly',
    'Significantly',
    'Remarkably',
  ],
};

/**
 * Generates writing style instructions for LLM prompts
 */
export function getWritingStyleInstructions(config: WritingStyleConfig = DEFAULT_WRITING_STYLE): string {
  const instructions: string[] = [
    '**Writing Style Requirements:**',
    '',
  ];

  if (config.balanceFormalConversational) {
    instructions.push(
      '- Balance formal academic writing with clear, conversational expression',
      '- Maintain scientific rigor while ensuring accessibility'
    );
  }

  if (config.clearSubjects) {
    instructions.push(
      '- Ensure every sentence has a clear, explicit subject',
      '- Avoid vague pronouns or unclear references'
    );
  }

  if (config.shortSentences) {
    instructions.push(
      '- Prefer short, direct sentences over long, complex ones',
      '- Break down complex ideas into multiple clear statements',
      '- Avoid nested clauses and excessive subordination'
    );
  }

  if (config.rhythmControl) {
    instructions.push(
      '- Vary sentence structure and length for natural reading rhythm',
      '- Avoid monotonous, repetitive patterns',
      '- Create flow through strategic sentence variation'
    );
  }

  if (config.faithfulnessToOriginal) {
    instructions.push(
      '- Preserve all core information, key data, and scientific intent',
      '- Do not alter, omit, or misrepresent original findings',
      '- Maintain accuracy of numerical data and statistical results'
    );
  }

  if (config.styleConsistency) {
    instructions.push(
      '- Maintain consistent style throughout the abstract',
      '- Align tone with formal scientific context',
      '- Use appropriate technical terminology consistently'
    );
  }

  if (config.naturalExpression) {
    instructions.push(
      '- Use sincere, organic phrasing',
      '- Avoid excessive embellishment or unnecessary technical flair',
      '- Write as a human expert would naturally express ideas'
    );
  }

  if (config.logicalRigor) {
    instructions.push(
      '- Maintain the original logical structure and flow',
      '- Ensure clear connections between ideas',
      '- Present information in a coherent, logical sequence'
    );
  }

  if (config.eliminateAITone && config.prohibitedPhrases.length > 0) {
    instructions.push(
      '',
      '**CRITICAL: Prohibited AI-Generated Phrases**',
      'You MUST NOT use any of the following phrases or similar constructions:',
      ...config.prohibitedPhrases.map(phrase => `  ❌ "${phrase}"`),
      '',
      '**Instead, use direct, active language:**',
      '  ✓ "We found that..." instead of "Results indicated that..."',
      '  ✓ "This demonstrates..." instead of "It is worth noting that..."',
      '  ✓ "The data show..." instead of "Based on the above analysis..."',
      '  ✓ Be direct and specific rather than using hedging language'
    );
  }

  return instructions.join('\n');
}

/**
 * Detects prohibited phrases in generated text
 * Returns array of detected phrases with their positions
 */
export interface ProhibitedPhraseDetection {
  phrase: string;
  position: number;
  context: string;
}

export function detectProhibitedPhrases(
  text: string,
  config: WritingStyleConfig = DEFAULT_WRITING_STYLE
): ProhibitedPhraseDetection[] {
  const detections: ProhibitedPhraseDetection[] = [];
  const lowerText = text.toLowerCase();

  for (const phrase of config.prohibitedPhrases) {
    const lowerPhrase = phrase.toLowerCase();
    let position = lowerText.indexOf(lowerPhrase);

    while (position !== -1) {
      // Extract context (50 chars before and after)
      const contextStart = Math.max(0, position - 50);
      const contextEnd = Math.min(text.length, position + phrase.length + 50);
      const context = text.substring(contextStart, contextEnd);

      detections.push({
        phrase,
        position,
        context: contextStart > 0 ? '...' + context : context,
      });

      // Look for next occurrence
      position = lowerText.indexOf(lowerPhrase, position + 1);
    }
  }

  return detections;
}

/**
 * Validates text against writing style requirements
 * Returns validation result with suggestions for improvement
 */
export interface WritingStyleValidation {
  isValid: boolean;
  score: number; // 0-100
  issues: WritingStyleIssue[];
  suggestions: string[];
}

export interface WritingStyleIssue {
  type: 'prohibited_phrase' | 'long_sentence' | 'unclear_subject' | 'repetitive_structure';
  severity: 'high' | 'medium' | 'low';
  message: string;
  location?: string;
}

export function validateWritingStyle(
  text: string,
  config: WritingStyleConfig = DEFAULT_WRITING_STYLE
): WritingStyleValidation {
  const issues: WritingStyleIssue[] = [];
  let score = 100;

  // Check for prohibited phrases
  if (config.eliminateAITone) {
    const detections = detectProhibitedPhrases(text, config);
    for (const detection of detections) {
      issues.push({
        type: 'prohibited_phrase',
        severity: 'high',
        message: `Prohibited AI phrase detected: "${detection.phrase}"`,
        location: detection.context,
      });
      score -= 10; // Deduct 10 points per prohibited phrase
    }
  }

  // Check for overly long sentences (>40 words)
  if (config.shortSentences) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    for (const sentence of sentences) {
      const wordCount = sentence.trim().split(/\s+/).length;
      if (wordCount > 40) {
        issues.push({
          type: 'long_sentence',
          severity: 'medium',
          message: `Sentence is too long (${wordCount} words). Consider breaking it down.`,
          location: sentence.trim().substring(0, 100) + '...',
        });
        score -= 5;
      }
    }
  }

  // Check for unclear subjects (sentences starting with "It" or "There")
  if (config.clearSubjects) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (/^(it|there)\s+(is|was|are|were|has|have|had)\b/i.test(trimmed)) {
        issues.push({
          type: 'unclear_subject',
          severity: 'low',
          message: 'Sentence may have unclear subject. Consider using explicit subject.',
          location: trimmed.substring(0, 100) + '...',
        });
        score -= 3;
      }
    }
  }

  // Check for repetitive sentence structure
  if (config.rhythmControl) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const startPatterns = sentences.map(s => {
      const words = s.trim().split(/\s+/);
      return words.slice(0, 2).join(' ').toLowerCase();
    });

    const patternCounts = new Map<string, number>();
    for (const pattern of startPatterns) {
      patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
    }

    for (const [pattern, count] of patternCounts.entries()) {
      if (count >= 3) {
        issues.push({
          type: 'repetitive_structure',
          severity: 'low',
          message: `Repetitive sentence structure detected: "${pattern}..." appears ${count} times`,
        });
        score -= 2;
      }
    }
  }

  // Ensure score doesn't go below 0
  score = Math.max(0, score);

  // Generate suggestions
  const suggestions: string[] = [];
  if (issues.some(i => i.type === 'prohibited_phrase')) {
    suggestions.push('Replace AI-generated phrases with direct, active language');
  }
  if (issues.some(i => i.type === 'long_sentence')) {
    suggestions.push('Break down long sentences into shorter, clearer statements');
  }
  if (issues.some(i => i.type === 'unclear_subject')) {
    suggestions.push('Use explicit subjects instead of "It is" or "There are" constructions');
  }
  if (issues.some(i => i.type === 'repetitive_structure')) {
    suggestions.push('Vary sentence structure and opening patterns for better rhythm');
  }

  return {
    isValid: issues.filter(i => i.severity === 'high').length === 0,
    score,
    issues,
    suggestions,
  };
}

/**
 * Generates a comprehensive writing style prompt section
 * to be included in LLM prompts
 */
export function generateWritingStylePrompt(config: WritingStyleConfig = DEFAULT_WRITING_STYLE): string {
  return `
${getWritingStyleInstructions(config)}

**Quality Checklist:**
Before finalizing your response, verify:
- [ ] No prohibited AI phrases are present
- [ ] All sentences have clear, explicit subjects
- [ ] Sentence length varies naturally (mix of short and medium-length)
- [ ] The text reads naturally, as if written by a human expert
- [ ] All original data and findings are preserved accurately
- [ ] The logical flow is clear and coherent
- [ ] Technical terminology is used consistently and appropriately
`;
}
