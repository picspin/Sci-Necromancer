# Workflow Quick Reference

## 🎯 Key Concepts

### The Correct Flow

```
Text Input → Analyze (Categories/Keywords) → Generate Impact & Synopsis → 
Suggest Types → Generate Spec-Based Abstract
```

### What's What?

- **Impact**: 40-word statement about research significance
- **Synopsis**: 100-word summary (Motivation, Goals, Approach, Results)
- **Abstract**: Full structured document (500-750 words) following type-specific format

**Important:** Impact and Synopsis are NOT the abstract! They are separate sections that accompany the full abstract.

## 📁 File Structure

```
lib/llm/
├── prompts/
│   ├── ismrmData.ts              # Reference data (categories, guidelines)
│   ├── ismrmPrompts.ts           # Step 1 & 3 prompts (analysis, type suggestion)
│   └── abstractSpecPrompts.ts    # Step 2 & 4 prompts (impact/synopsis, abstract generation) ✨ NEW
├── workflowService.ts            # Complete workflow orchestration ✨ NEW
├── enhancedLlmService.ts         # Provider management, retry, fallback
├── gemini.ts                     # Google AI integration
├── openai.ts                     # OpenAI integration
└── index.ts                      # Public API exports

public/
├── standard abstract guidance.md
├── registered abstract guidance.md
├── mri in clinical practice abstract guidance.md
├── ISMRT abstract.md
└── ismrm abstract categories & keywords.md
```

## 🔧 Quick Usage

### Import the Workflow Service

```typescript
import { WorkflowService } from './lib/llm/workflowService';
```

### Complete Workflow (Recommended)

```typescript
const workflow = new WorkflowService('google', apiKey);

const result = await workflow.completeWorkflow(
  inputText,
  'Standard Abstract', // optional
  (step, data) => {
    // Update UI based on step
    if (step === 'analysis') {
      showCategories(data.categories);
      showKeywords(data.keywords);
    }
    if (step === 'impactSynopsis') {
      showImpact(data.impact);
      showSynopsis(data.synopsis);
    }
    if (step === 'suggestions') {
      showTypeSuggestions(data);
    }
    if (step === 'finalAbstract') {
      showAbstract(data);
    }
  }
);
```

### Step-by-Step (For Custom UI)

```typescript
// Step 1: Analyze content
const analysis = await workflow.analyzeContent(text);
// → { categories: [...], keywords: [...] }

// Step 2: Generate Impact & Synopsis
const { impact, synopsis } = await workflow.generateImpactSynopsis(
  text,
  selectedCategories,
  selectedKeywords
);
// → { impact: "40 words...", synopsis: "100 words..." }

// Step 3: Get type suggestions
const suggestions = await workflow.suggestAbstractTypes(
  text,
  selectedCategories,
  selectedKeywords
);
// → [{ type: "Standard Abstract", probability: 0.75 }, ...]

// Step 4: Generate final abstract
const abstract = await workflow.generateAbstractByType(
  text,
  impact,
  synopsis,
  selectedType,
  selectedCategories,
  selectedKeywords
);
// → { abstract: "INTRODUCTION: ...", impact: "...", synopsis: "...", keywords: [...] }
```

### Creative Mode

```typescript
const creative = await workflow.generateCreativeAbstract(
  "Novel AI method for MRI reconstruction",
  'Standard Abstract'
);
```

## 📋 Abstract Type Specs

### Standard Abstract (750 words)
```
INTRODUCTION: Why was this study performed?
METHODS: How did you study this problem?
RESULTS: Report the data and outcomes
DISCUSSION: How do you interpret the results?
CONCLUSION: What is the relevance?
```

### Registered Abstract (500 words)
```
INTRODUCTION: Motivation
HYPOTHESIS: Explicit, testable hypothesis
METHODS: Study design (future tense)
STATISTICAL METHODS: Sample size, analysis plan
```

### MRI in Clinical Practice (750 words)
```
BACKGROUND: Clinical presentation
TEACHING POINT: How MRI was applied uniquely
DIAGNOSIS AND TREATMENT: Final diagnosis
SIGNIFICANCE: Impact on patient care
KEY POINTS: At least 3 key points
```

### ISMRT Abstract
```
Clinical Practice Focus:
- Background, Teaching Point, Summary

Research Focus:
- Background, Methods, Results, Conclusions
```

## 🎨 UI Implementation Checklist

### Step 1: Content Analysis
- [ ] File upload component (txt/pdf/docx)
- [ ] Text input area
- [ ] "Analyze" button
- [ ] Loading animation: 🔍 Analyzing...

### Step 2: Category & Keyword Selection
- [ ] Display categories with probability badges
- [ ] Display keywords as selectable chips
- [ ] Sort by probability (highest first)
- [ ] Multi-select interface
- [ ] "Generate Impact & Synopsis" button
- [ ] Loading animation: 📝 Generating...

### Step 3: Impact & Synopsis Display
- [ ] Impact text area (40 words, editable)
- [ ] Synopsis text area (100 words, editable)
- [ ] Word count indicators
- [ ] "Suggest Abstract Types" button
- [ ] Loading animation: 🎯 Analyzing types...

### Step 4: Type Selection
- [ ] Type suggestion cards with probabilities
- [ ] Type description on hover
- [ ] Type selection (radio buttons or cards)
- [ ] "Generate Abstract" button
- [ ] Loading animation: ✨ Generating abstract...

### Step 5: Abstract Display
- [ ] Full abstract display (formatted)
- [ ] Section highlighting (INTRODUCTION, METHODS, etc.)
- [ ] Edit mode
- [ ] Regenerate button
- [ ] Export options (PDF, DOCX, JSON)

## 🐛 Common Issues

### Import Error: "Cannot find module '../../types'"
**Fix:** Use `'../../../types'` in `lib/llm/prompts/` files

### Missing Guidance Files
**Fix:** Ensure all `.md` files are in `/public/` directory

### API Key Not Found
**Fix:** Check localStorage for 'app-settings' with `openAIApiKey` or `googleApiKey`

### Structured Output Not Working
**Fix:** Ensure provider supports function calling (Gemini 1.5+ or GPT-4+)

## 🧪 Testing

```typescript
// Test each step
describe('Workflow', () => {
  it('should analyze content', async () => {
    const result = await workflow.analyzeContent(sampleText);
    expect(result.categories.length).toBeGreaterThan(0);
  });

  it('should generate impact & synopsis', async () => {
    const { impact, synopsis } = await workflow.generateImpactSynopsis(
      sampleText,
      categories,
      keywords
    );
    expect(impact.split(' ').length).toBeLessThanOrEqual(40);
  });

  it('should suggest types', async () => {
    const suggestions = await workflow.suggestAbstractTypes(
      sampleText,
      categories,
      keywords
    );
    expect(suggestions[0].probability).toBeGreaterThan(0);
  });

  it('should generate abstract', async () => {
    const abstract = await workflow.generateAbstractByType(
      sampleText,
      impact,
      synopsis,
      'Standard Abstract',
      categories,
      keywords
    );
    expect(abstract.abstract).toContain('INTRODUCTION');
  });
});
```

## 📚 Related Documentation

- **WORKFLOW.md**: Detailed workflow documentation
- **agent.md**: Project overview and architecture
- **CONFIGURATION.md**: Setup and configuration
- **TROUBLESHOOTING.md**: Common issues and solutions

## 🚀 Next Steps

1. Update UI components to use `WorkflowService`
2. Add progress indicators for each step
3. Implement category/keyword selection interface
4. Add type suggestion display
5. Create abstract preview component
6. Add export functionality
7. Implement error handling UI
8. Add loading states with emojis
9. Create micro-interactions for buttons
10. Add word count validation

## 💡 Tips

- Always validate word counts before submission
- Use the progress callback to update UI in real-time
- Cache analysis results to avoid re-processing
- Allow users to edit Impact & Synopsis before generating abstract
- Provide clear guidance for each abstract type
- Show examples for each type
- Implement auto-save for work in progress
- Add keyboard shortcuts for common actions
- Use optimistic UI updates for better UX
