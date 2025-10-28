# Writing Style Enhancement Guide

## Overview

The Writing Style Enhancement module provides tools to ensure that AI-generated academic abstracts maintain a natural, human-like writing style while eliminating common AI-generated phrases and patterns.

## Features

### 1. Writing Style Configuration

The `WritingStyleConfig` interface allows you to customize writing style requirements:

```typescript
interface WritingStyleConfig {
  balanceFormalConversational: boolean;  // Balance formal and conversational tone
  clearSubjects: boolean;                // Ensure clear subjects in sentences
  shortSentences: boolean;               // Prefer short, direct sentences
  rhythmControl: boolean;                // Vary sentence structure for natural rhythm
  faithfulnessToOriginal: boolean;       // Preserve original meaning and data
  styleConsistency: boolean;             // Maintain consistent style
  naturalExpression: boolean;            // Use organic, human-like phrasing
  logicalRigor: boolean;                 // Maintain logical structure
  eliminateAITone: boolean;              // Remove AI-generated phrases
  prohibitedPhrases: string[];           // List of phrases to avoid
}
```

### 2. Default Configuration

The system includes a comprehensive default configuration (`DEFAULT_WRITING_STYLE`) with 24 prohibited AI phrases:

- "It is worth noting that"
- "Based on the above analysis"
- "The findings of this study suggest"
- "Results indicated that"
- And 20+ more common AI patterns

### 3. Prohibited Phrase Detection

Automatically detect AI-generated phrases in text:

```typescript
import { detectProhibitedPhrases } from './lib/llm/writingStyleEnhancer';

const text = "It is worth noting that the results show improvement.";
const detections = detectProhibitedPhrases(text);
// Returns: [{ phrase: "It is worth noting that", position: 0, context: "..." }]
```

### 4. Writing Style Validation

Validate generated text against style requirements:

```typescript
import { validateWritingStyle } from './lib/llm/writingStyleEnhancer';

const validation = validateWritingStyle(text);
console.log(validation.isValid);      // true/false
console.log(validation.score);        // 0-100
console.log(validation.issues);       // Array of detected issues
console.log(validation.suggestions);  // Improvement suggestions
```

Validation checks for:
- **Prohibited phrases** (high severity, -10 points each)
- **Long sentences** (>40 words, medium severity, -5 points each)
- **Unclear subjects** (sentences starting with "It is" or "There are", low severity, -3 points each)
- **Repetitive structure** (same sentence opening 3+ times, low severity, -2 points each)

### 5. Prompt Integration

Writing style instructions are automatically integrated into all prompt generation functions:

```typescript
import { getImpactSynopsisPrompt } from './lib/llm/prompts/abstractSpecPrompts';

// Writing style is automatically included
const prompt = getImpactSynopsisPrompt(text, categories, keywords);

// Or use custom style
const customPrompt = getImpactSynopsisPrompt(text, categories, keywords, customStyle);
```

## Usage Examples

### Basic Usage

```typescript
import { 
  DEFAULT_WRITING_STYLE,
  validateWritingStyle,
  generateWritingStylePrompt 
} from './lib/llm';

// Generate prompt instructions
const instructions = generateWritingStylePrompt(DEFAULT_WRITING_STYLE);

// Validate generated text
const result = validateWritingStyle(generatedText);
if (!result.isValid) {
  console.log('Issues found:', result.issues);
  console.log('Suggestions:', result.suggestions);
}
```

### Custom Configuration

```typescript
import { WritingStyleConfig } from './types';
import { generateWritingStylePrompt } from './lib/llm';

const customStyle: WritingStyleConfig = {
  ...DEFAULT_WRITING_STYLE,
  shortSentences: false,  // Allow longer sentences
  prohibitedPhrases: [
    'It is worth noting',
    'Based on the above',
  ],
};

const prompt = generateWritingStylePrompt(customStyle);
```

### Integration with Workflow

```typescript
import { WorkflowService } from './lib/llm/workflowService';
import { validateWritingStyle } from './lib/llm';

const workflow = new WorkflowService('google', apiKey);

// Generate abstract
const result = await workflow.generateAbstractByType(
  text, impact, synopsis, type, categories, keywords
);

// Validate the generated abstract
const validation = validateWritingStyle(result.impact);
if (validation.score < 80) {
  console.warn('Writing style issues detected:', validation.issues);
}
```

## Prohibited Phrases

The default configuration prohibits these common AI-generated phrases:

### High-Priority Phrases to Avoid
- "It is worth noting that"
- "It is not difficult to find"
- "Based on the above analysis"
- "In conclusion, this study demonstrates"
- "The findings of this study suggest"
- "This paper explores"
- "Results indicated that"

### Medium-Priority Phrases to Avoid
- "It should be noted that"
- "It is important to note"
- "It is interesting to note"
- "As can be seen"
- "As shown above"
- "As mentioned earlier"
- "As previously stated"

### Hedging Language to Avoid
- "Furthermore, it is worth mentioning"
- "Additionally, it should be emphasized"
- "Moreover, it is clear that"

### Adverbs to Use Sparingly
- "Notably"
- "Interestingly"
- "Importantly"
- "Significantly"
- "Remarkably"

## Best Practices

### DO:
✅ Use direct, active language: "We found that..."
✅ Be specific with data: "The technique reduced scan time by 40%"
✅ Use clear subjects: "The MRI protocol demonstrated..."
✅ Vary sentence structure naturally
✅ Preserve all original data and findings

### DON'T:
❌ Use hedging language: "It is worth noting that..."
❌ Start sentences with "It is" or "There are" excessively
❌ Write overly long sentences (>40 words)
❌ Repeat the same sentence structure multiple times
❌ Use vague statements without specific data

## Integration Points

The writing style enhancement is integrated into:

1. **Impact & Synopsis Generation** (`getImpactSynopsisPrompt`)
2. **Abstract Generation by Type** (`getAbstractByTypePrompt`)
3. **Creative Abstract Generation** (`getCreativeAbstractByTypePrompt`)
4. **Humanization Guidelines** (`ismrmData.ts`)

## Validation Workflow

```
Generate Text
     ↓
Detect Prohibited Phrases
     ↓
Check Sentence Length
     ↓
Verify Clear Subjects
     ↓
Analyze Sentence Structure
     ↓
Calculate Score (0-100)
     ↓
Generate Suggestions
     ↓
Return Validation Result
```

## API Reference

### Functions

- `generateWritingStylePrompt(config?)` - Generate prompt instructions
- `getWritingStyleInstructions(config?)` - Get style instructions only
- `detectProhibitedPhrases(text, config?)` - Find prohibited phrases
- `validateWritingStyle(text, config?)` - Validate text against style rules

### Types

- `WritingStyleConfig` - Configuration interface
- `WritingStyleValidation` - Validation result
- `WritingStyleIssue` - Individual issue details
- `ProhibitedPhraseDetection` - Detected phrase information

## Future Enhancements

Potential improvements for future versions:

1. Machine learning-based style scoring
2. Context-aware phrase detection
3. Automatic text rewriting suggestions
4. Conference-specific style profiles
5. Real-time validation during text generation
6. Integration with grammar checking tools
7. Custom phrase dictionaries per research domain

## Contributing

When adding new prohibited phrases:

1. Add to `DEFAULT_WRITING_STYLE.prohibitedPhrases`
2. Test with `detectProhibitedPhrases()`
3. Update this documentation
4. Consider case sensitivity and variations

## References

- ISMRM Abstract Submission Guidelines
- Academic Writing Best Practices
- Natural Language Processing for Style Detection
- Human vs. AI Writing Patterns Research
