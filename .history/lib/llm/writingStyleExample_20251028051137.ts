/**
 * Example usage of Writing Style Enhancement
 * 
 * This file demonstrates how to use the writing style configuration
 * and validation utilities in the abstract generation workflow.
 */

import { 
  DEFAULT_WRITING_STYLE, 
  validateWritingStyle, 
  detectProhibitedPhrases,
  generateWritingStylePrompt 
} from './writingStyleEnhancer';
import { WritingStyleConfig } from '../../types';

// Example 1: Using default writing style configuration
export function exampleDefaultStyle() {
  console.log('=== Example 1: Default Writing Style ===');
  console.log(generateWritingStylePrompt(DEFAULT_WRITING_STYLE));
}

// Example 2: Custom writing style configuration
export function exampleCustomStyle() {
  console.log('\n=== Example 2: Custom Writing Style ===');
  
  const customStyle: WritingStyleConfig = {
    ...DEFAULT_WRITING_STYLE,
    shortSentences: false, // Allow longer sentences
    prohibitedPhrases: [
      'It is worth noting',
      'Based on the above',
      'In conclusion',
    ],
  };
  
  console.log(generateWritingStylePrompt(customStyle));
}

// Example 3: Detecting prohibited phrases in text
export function exampleProhibitedPhraseDetection() {
  console.log('\n=== Example 3: Prohibited Phrase Detection ===');
  
  const sampleText = `
    This study demonstrates the effectiveness of the new MRI technique.
    It is worth noting that the results show significant improvement.
    Based on the above analysis, we can conclude that this method is superior.
    The findings of this study suggest potential clinical applications.
  `;
  
  const detections = detectProhibitedPhrases(sampleText);
  
  console.log(`Found ${detections.length} prohibited phrases:`);
  detections.forEach(d => {
    console.log(`- "${d.phrase}" at position ${d.position}`);
    console.log(`  Context: ${d.context}`);
  });
}

// Example 4: Validating generated text
export function exampleTextValidation() {
  console.log('\n=== Example 4: Text Validation ===');
  
  const goodText = `
    We developed a novel MRI technique for cardiac imaging.
    The method reduces scan time by 40% while maintaining image quality.
    Our results demonstrate improved diagnostic accuracy in 95% of cases.
    This approach enables faster patient throughput in clinical settings.
  `;
  
  const badText = `
    It is worth noting that this study explores a novel MRI technique.
    Based on the above analysis, it is not difficult to find that the results are promising.
    The findings of this study suggest that there are significant improvements.
    It should be noted that this paper demonstrates the effectiveness of the method.
  `;
  
  console.log('Validating GOOD text:');
  const goodValidation = validateWritingStyle(goodText);
  console.log(`- Valid: ${goodValidation.isValid}`);
  console.log(`- Score: ${goodValidation.score}/100`);
  console.log(`- Issues: ${goodValidation.issues.length}`);
  
  console.log('\nValidating BAD text:');
  const badValidation = validateWritingStyle(badText);
  console.log(`- Valid: ${badValidation.isValid}`);
  console.log(`- Score: ${badValidation.score}/100`);
  console.log(`- Issues: ${badValidation.issues.length}`);
  badValidation.issues.forEach(issue => {
    console.log(`  - [${issue.severity}] ${issue.message}`);
  });
  console.log('\nSuggestions:');
  badValidation.suggestions.forEach(s => console.log(`  - ${s}`));
}

// Example 5: Integration with prompt generation
export function examplePromptIntegration() {
  console.log('\n=== Example 5: Prompt Integration ===');
  
  const text = 'Sample research text about MRI techniques...';
  const categories = [{ name: 'Neuro', type: 'main' as const, probability: 0.9 }];
  const keywords = ['fMRI', 'brain', 'connectivity'];
  
  // Import the prompt function
  import('./prompts/abstractSpecPrompts').then(({ getImpactSynopsisPrompt }) => {
    const prompt = getImpactSynopsisPrompt(text, categories, keywords);
    console.log('Generated prompt with writing style instructions:');
    console.log(prompt.substring(0, 500) + '...');
  });
}

// Run all examples
if (require.main === module) {
  exampleDefaultStyle();
  exampleCustomStyle();
  exampleProhibitedPhraseDetection();
  exampleTextValidation();
  examplePromptIntegration();
}
