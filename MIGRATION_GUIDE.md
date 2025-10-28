# Migration Guide: Updating to New Workflow Architecture

## Overview

This guide helps you migrate from the old workflow to the new spec-based workflow architecture.

## What Changed?

### Old Workflow (Incorrect)
```typescript
// Old way - generates everything at once
const result = await generateFinalAbstract(text, type, categories, keywords);
// Result: { impact, synopsis, keywords }
// Problem: No actual abstract body, wrong flow
```

### New Workflow (Correct)
```typescript
// New way - step by step
const workflow = new WorkflowService('google', apiKey);

// Step 1: Analyze
const analysis = await workflow.analyzeContent(text);

// Step 2: Generate Impact & Synopsis
const { impact, synopsis } = await workflow.generateImpactSynopsis(
  text, analysis.categories, analysis.keywords
);

// Step 3: Suggest types
const suggestions = await workflow.suggestAbstractTypes(
  text, analysis.categories, analysis.keywords
);

// Step 4: Generate abstract
const result = await workflow.generateAbstractByType(
  text, impact, synopsis, selectedType, categories, keywords
);
// Result: { abstract, impact, synopsis, keywords }
// Now includes the actual abstract body!
```

## Migration Steps

### Step 1: Update Imports

**Before:**
```typescript
import { analyzeContent, generateFinalAbstract } from './lib/llm';
```

**After:**
```typescript
import { WorkflowService } from './lib/llm/workflowService';
// Or use the enhanced service
import { enhancedLLMService } from './lib/llm/enhancedLlmService';
```

### Step 2: Update Component State

**Before:**
```typescript
const [abstractData, setAbstractData] = useState<AbstractData | null>(null);
```

**After:**
```typescript
// Add intermediate states
const [categories, setCategories] = useState<Category[]>([]);
const [keywords, setKeywords] = useState<string[]>([]);
const [impact, setImpact] = useState<string>('');
const [synopsis, setSynopsis] = useState<string>('');
const [typeSuggestions, setTypeSuggestions] = useState<AbstractTypeSuggestion[]>([]);
const [selectedType, setSelectedType] = useState<AbstractType>('Standard Abstract');
const [abstractData, setAbstractData] = useState<AbstractData | null>(null);

// Add loading states for each step
const [isAnalyzing, setIsAnalyzing] = useState(false);
const [isGeneratingImpact, setIsGeneratingImpact] = useState(false);
const [isSuggestingTypes, setIsSuggestingTypes] = useState(false);
const [isGeneratingAbstract, setIsGeneratingAbstract] = useState(false);
```

### Step 3: Update Handler Functions

**Before:**
```typescript
const handleGenerate = async () => {
  setLoading(true);
  try {
    const result = await generateFinalAbstract(
      inputText,
      'Standard Abstract',
      categories,
      keywords
    );
    setAbstractData(result);
  } catch (error) {
    handleError(error);
  } finally {
    setLoading(false);
  }
};
```

**After:**
```typescript
const workflow = new WorkflowService('google', apiKey);

// Option 1: Complete workflow (easiest)
const handleGenerateComplete = async () => {
  setLoading(true);
  try {
    const result = await workflow.completeWorkflow(
      inputText,
      selectedType,
      (step, data) => {
        // Update UI based on step
        if (step === 'analysis') {
          setCategories(data.categories);
          setKeywords(data.keywords);
        }
        if (step === 'impactSynopsis') {
          setImpact(data.impact);
          setSynopsis(data.synopsis);
        }
        if (step === 'suggestions') {
          setTypeSuggestions(data);
        }
        if (step === 'finalAbstract') {
          setAbstractData(data);
        }
      }
    );
  } catch (error) {
    handleError(error);
  } finally {
    setLoading(false);
  }
};

// Option 2: Step-by-step (more control)
const handleAnalyze = async () => {
  setIsAnalyzing(true);
  try {
    const analysis = await workflow.analyzeContent(inputText);
    setCategories(analysis.categories);
    setKeywords(analysis.keywords);
  } catch (error) {
    handleError(error);
  } finally {
    setIsAnalyzing(false);
  }
};

const handleGenerateImpactSynopsis = async () => {
  setIsGeneratingImpact(true);
  try {
    const result = await workflow.generateImpactSynopsis(
      inputText,
      selectedCategories,
      selectedKeywords
    );
    setImpact(result.impact);
    setSynopsis(result.synopsis);
  } catch (error) {
    handleError(error);
  } finally {
    setIsGeneratingImpact(false);
  }
};

const handleSuggestTypes = async () => {
  setIsSuggestingTypes(true);
  try {
    const suggestions = await workflow.suggestAbstractTypes(
      inputText,
      selectedCategories,
      selectedKeywords
    );
    setTypeSuggestions(suggestions);
  } catch (error) {
    handleError(error);
  } finally {
    setIsSuggestingTypes(false);
  }
};

const handleGenerateAbstract = async () => {
  setIsGeneratingAbstract(true);
  try {
    const result = await workflow.generateAbstractByType(
      inputText,
      impact,
      synopsis,
      selectedType,
      selectedCategories,
      selectedKeywords
    );
    setAbstractData(result);
  } catch (error) {
    handleError(error);
  } finally {
    setIsGeneratingAbstract(false);
  }
};
```

### Step 4: Update UI Components

**Before:**
```tsx
<button onClick={handleGenerate}>
  Generate Abstract
</button>

{abstractData && (
  <div>
    <h3>Impact</h3>
    <p>{abstractData.impact}</p>
    <h3>Synopsis</h3>
    <p>{abstractData.synopsis}</p>
    <h3>Keywords</h3>
    <p>{abstractData.keywords.join(', ')}</p>
  </div>
)}
```

**After:**
```tsx
{/* Step 1: Analyze */}
<button onClick={handleAnalyze} disabled={isAnalyzing}>
  {isAnalyzing ? '🔍 Analyzing...' : 'Analyze Content'}
</button>

{/* Step 2: Category/Keyword Selection */}
{categories.length > 0 && (
  <div>
    <h3>Categories</h3>
    {categories.map(cat => (
      <CategoryChip
        key={cat.name}
        category={cat}
        selected={selectedCategories.includes(cat)}
        onToggle={() => toggleCategory(cat)}
      />
    ))}
    
    <h3>Keywords</h3>
    {keywords.map(kw => (
      <KeywordChip
        key={kw}
        keyword={kw}
        selected={selectedKeywords.includes(kw)}
        onToggle={() => toggleKeyword(kw)}
      />
    ))}
    
    <button onClick={handleGenerateImpactSynopsis} disabled={isGeneratingImpact}>
      {isGeneratingImpact ? '📝 Generating...' : 'Generate Impact & Synopsis'}
    </button>
  </div>
)}

{/* Step 3: Impact & Synopsis Display */}
{impact && synopsis && (
  <div>
    <h3>Impact (40 words)</h3>
    <textarea
      value={impact}
      onChange={(e) => setImpact(e.target.value)}
      maxLength={200} // ~40 words
    />
    <WordCount text={impact} limit={40} />
    
    <h3>Synopsis (100 words)</h3>
    <textarea
      value={synopsis}
      onChange={(e) => setSynopsis(e.target.value)}
      maxLength={500} // ~100 words
    />
    <WordCount text={synopsis} limit={100} />
    
    <button onClick={handleSuggestTypes} disabled={isSuggestingTypes}>
      {isSuggestingTypes ? '🎯 Analyzing...' : 'Suggest Abstract Types'}
    </button>
  </div>
)}

{/* Step 4: Type Selection */}
{typeSuggestions.length > 0 && (
  <div>
    <h3>Suggested Abstract Types</h3>
    {typeSuggestions.map(suggestion => (
      <TypeCard
        key={suggestion.type}
        type={suggestion.type}
        probability={suggestion.probability}
        selected={selectedType === suggestion.type}
        onSelect={() => setSelectedType(suggestion.type)}
      />
    ))}
    
    <button onClick={handleGenerateAbstract} disabled={isGeneratingAbstract}>
      {isGeneratingAbstract ? '✨ Generating...' : `Generate ${selectedType}`}
    </button>
  </div>
)}

{/* Step 5: Final Abstract Display */}
{abstractData && (
  <div>
    <h3>Generated Abstract</h3>
    
    <section>
      <h4>Impact</h4>
      <p>{abstractData.impact}</p>
    </section>
    
    <section>
      <h4>Synopsis</h4>
      <p>{abstractData.synopsis}</p>
    </section>
    
    <section>
      <h4>Abstract</h4>
      <AbstractDisplay abstract={abstractData.abstract} type={selectedType} />
    </section>
    
    <section>
      <h4>Keywords</h4>
      <p>{abstractData.keywords.join(', ')}</p>
    </section>
    
    <button onClick={handleExport}>Export</button>
    <button onClick={handleRegenerate}>Regenerate</button>
  </div>
)}
```

## Component Examples

### CategoryChip Component

```tsx
interface CategoryChipProps {
  category: Category;
  selected: boolean;
  onToggle: () => void;
}

const CategoryChip: React.FC<CategoryChipProps> = ({ category, selected, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      className={`chip ${selected ? 'selected' : ''}`}
      style={{
        backgroundColor: selected ? '#4CAF50' : '#e0e0e0',
        color: selected ? 'white' : 'black',
        padding: '8px 16px',
        borderRadius: '16px',
        border: 'none',
        margin: '4px',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px'
      }}
    >
      <span>{category.name}</span>
      <span className="probability-badge">
        {Math.round(category.probability * 100)}%
      </span>
      <span className="type-badge">{category.type}</span>
    </button>
  );
};
```

### TypeCard Component

```tsx
interface TypeCardProps {
  type: AbstractType;
  probability: number;
  selected: boolean;
  onSelect: () => void;
}

const TypeCard: React.FC<TypeCardProps> = ({ type, probability, selected, onSelect }) => {
  const getTypeDescription = (type: AbstractType): string => {
    switch (type) {
      case 'Standard Abstract':
        return 'Technical/methods-focused research (750 words)';
      case 'Registered Abstract':
        return 'Pre-registration, hypothesis-driven (500 words)';
      case 'MRI in Clinical Practice Abstract':
        return 'Clinical application, patient care impact (750 words)';
      case 'ISMRT Abstract':
        return 'Technologist-focused work';
      default:
        return '';
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`type-card ${selected ? 'selected' : ''}`}
      style={{
        border: selected ? '2px solid #4CAF50' : '1px solid #ccc',
        borderRadius: '8px',
        padding: '16px',
        margin: '8px 0',
        cursor: 'pointer',
        backgroundColor: selected ? '#f1f8f4' : 'white'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4>{type}</h4>
        <span className="probability-badge">
          {Math.round(probability * 100)}%
        </span>
      </div>
      <p style={{ fontSize: '14px', color: '#666' }}>
        {getTypeDescription(type)}
      </p>
    </div>
  );
};
```

### WordCount Component

```tsx
interface WordCountProps {
  text: string;
  limit: number;
}

const WordCount: React.FC<WordCountProps> = ({ text, limit }) => {
  const wordCount = text.trim().split(/\s+/).length;
  const isOverLimit = wordCount > limit;

  return (
    <div style={{ 
      fontSize: '12px', 
      color: isOverLimit ? 'red' : 'green',
      marginTop: '4px'
    }}>
      {wordCount} / {limit} words
      {isOverLimit && ' (over limit!)'}
    </div>
  );
};
```

### AbstractDisplay Component

```tsx
interface AbstractDisplayProps {
  abstract?: string;
  type: AbstractType;
}

const AbstractDisplay: React.FC<AbstractDisplayProps> = ({ abstract, type }) => {
  if (!abstract) return null;

  // Parse sections based on type
  const sections = abstract.split(/\n\n+/);

  return (
    <div className="abstract-display">
      {sections.map((section, index) => {
        // Detect section headers (e.g., "INTRODUCTION:", "METHODS:")
        const headerMatch = section.match(/^([A-Z\s]+):\s*/);
        if (headerMatch) {
          const header = headerMatch[1];
          const content = section.substring(headerMatch[0].length);
          return (
            <section key={index} className="abstract-section">
              <h5 style={{ color: '#2196F3', marginBottom: '8px' }}>{header}</h5>
              <p style={{ lineHeight: '1.6' }}>{content}</p>
            </section>
          );
        }
        return <p key={index} style={{ lineHeight: '1.6' }}>{section}</p>;
      })}
    </div>
  );
};
```

## Testing Migration

### Before
```typescript
describe('Abstract Generation', () => {
  it('should generate abstract', async () => {
    const result = await generateFinalAbstract(text, type, categories, keywords);
    expect(result.impact).toBeDefined();
    expect(result.synopsis).toBeDefined();
  });
});
```

### After
```typescript
describe('Workflow', () => {
  const workflow = new WorkflowService('google', testApiKey);

  it('should complete full workflow', async () => {
    const result = await workflow.completeWorkflow(sampleText);
    
    expect(result.analysis.categories).toBeDefined();
    expect(result.impactSynopsis.impact).toBeDefined();
    expect(result.impactSynopsis.synopsis).toBeDefined();
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.finalAbstract.abstract).toBeDefined(); // Now includes abstract body!
  });

  it('should generate impact & synopsis', async () => {
    const analysis = await workflow.analyzeContent(sampleText);
    const { impact, synopsis } = await workflow.generateImpactSynopsis(
      sampleText,
      analysis.categories,
      analysis.keywords
    );
    
    expect(impact.split(' ').length).toBeLessThanOrEqual(40);
    expect(synopsis.split(' ').length).toBeLessThanOrEqual(100);
  });

  it('should generate type-specific abstract', async () => {
    const abstract = await workflow.generateAbstractByType(
      sampleText,
      'Impact statement',
      'Synopsis text',
      'Standard Abstract',
      categories,
      keywords
    );
    
    expect(abstract.abstract).toContain('INTRODUCTION');
    expect(abstract.abstract).toContain('METHODS');
    expect(abstract.abstract).toContain('RESULTS');
  });
});
```

## Common Pitfalls

### 1. Confusing Impact/Synopsis with Abstract
**Wrong:**
```typescript
// Thinking impact/synopsis IS the abstract
const abstract = abstractData.impact + abstractData.synopsis;
```

**Right:**
```typescript
// Abstract is a separate field
const fullAbstract = abstractData.abstract; // This is the 500-750 word document
const impact = abstractData.impact; // This is the 40-word statement
const synopsis = abstractData.synopsis; // This is the 100-word summary
```

### 2. Skipping Steps
**Wrong:**
```typescript
// Trying to generate abstract without impact/synopsis
const abstract = await workflow.generateAbstractByType(text, '', '', type, [], []);
```

**Right:**
```typescript
// Follow the complete workflow
const analysis = await workflow.analyzeContent(text);
const { impact, synopsis } = await workflow.generateImpactSynopsis(text, analysis.categories, analysis.keywords);
const abstract = await workflow.generateAbstractByType(text, impact, synopsis, type, categories, keywords);
```

### 3. Not Handling Loading States
**Wrong:**
```typescript
// No loading feedback
const result = await workflow.completeWorkflow(text);
```

**Right:**
```typescript
// Show progress to user
const result = await workflow.completeWorkflow(text, type, (step, data) => {
  setCurrentStep(step);
  setStepData(data);
  showProgress(step);
});
```

## Rollback Plan

If you need to rollback to the old system temporarily:

```typescript
// Keep old imports available
import { generateFinalAbstract as legacyGenerate } from './lib/llm/index';

// Use legacy function
const result = await legacyGenerate(text, type, categories, keywords);
```

Note: The legacy functions still work but don't provide the full abstract body.

## Support

If you encounter issues during migration:

1. Check `WORKFLOW.md` for detailed documentation
2. Check `WORKFLOW_QUICK_REFERENCE.md` for quick examples
3. Check `TROUBLESHOOTING.md` for common issues
4. Review `.kiro/specs/project-architecture-refactor/implementation-summary.md`

## Timeline

Recommended migration timeline:

- **Week 1**: Update backend services and test
- **Week 2**: Update UI components one by one
- **Week 3**: Integration testing
- **Week 4**: User acceptance testing
- **Week 5**: Deploy to production

## Checklist

- [ ] Update imports to use `WorkflowService`
- [ ] Add intermediate state variables
- [ ] Update handler functions
- [ ] Add UI components for each step
- [ ] Add loading states with emojis
- [ ] Add progress indicators
- [ ] Update tests
- [ ] Update documentation
- [ ] Test with real API calls
- [ ] User acceptance testing
- [ ] Deploy to production
