# Accessibility Developer Guide

## Quick Reference for Using Accessibility Features

### Using Accessibility Utilities

```typescript
import { 
  trapFocus, 
  createFocusManager, 
  announceToScreenReader,
  generateId 
} from '../lib/utils/accessibilityUtils';

// Focus trapping in modals
const cleanup = trapFocus(modalElement);
// Call cleanup() when modal closes

// Focus management
const focusManager = createFocusManager();
focusManager.saveFocus(); // Save current focus
focusManager.restoreFocus(); // Restore later

// Screen reader announcements
announceToScreenReader('Content loaded successfully', 'polite');
announceToScreenReader('Error occurred!', 'assertive');

// Generate unique IDs for ARIA relationships
const labelId = generateId('label');
const descId = generateId('description');
```

### Using the Accessible Button Component

```typescript
import AccessibleButton from './components/AccessibleButton';

<AccessibleButton
  variant="primary" // primary | secondary | ghost | danger
  size="md" // sm | md | lg
  icon="sparkles" // Optional icon
  iconPosition="left" // left | right
  loading={isLoading}
  fullWidth={false}
  onClick={handleClick}
  aria-label="Descriptive label"
>
  Button Text
</AccessibleButton>
```

### Using Tooltips

```typescript
import Tooltip from './components/Tooltip';

<Tooltip 
  content="This button generates an abstract"
  position="top" // top | bottom | left | right
  delay={300}
>
  <button>Generate</button>
</Tooltip>
```

### Using Contextual Help

```typescript
import ContextualHelp from './components/ContextualHelp';

<div className="flex items-center gap-2">
  <label>Complex Feature</label>
  <ContextualHelp
    title="About This Feature"
    content="This feature helps you..."
    position="right"
  />
</div>
```

### Using Live Regions

```typescript
import LiveRegion, { useLiveRegion } from './components/LiveRegion';

// Option 1: Direct component
<LiveRegion 
  message="Content updated" 
  priority="polite"
  clearAfter={3000}
/>

// Option 2: Using hook
const { announcement, announce, LiveRegionComponent } = useLiveRegion();

// Announce messages
announce('Processing complete', 'polite');

// Render component
<LiveRegionComponent />
```

### Using Theme Hook

```typescript
import { useTheme } from '../lib/hooks/useTheme';

const { 
  theme, 
  toggleHighContrast, 
  setFontSize, 
  toggleReducedMotion,
  isHighContrast 
} = useTheme();

// Toggle high contrast
<button onClick={toggleHighContrast}>
  {isHighContrast ? 'Normal' : 'High'} Contrast
</button>

// Set font size
<button onClick={() => setFontSize('large')}>
  Large Text
</button>
```

### Using Keyboard Navigation Hook

```typescript
import { useKeyboardNavigation } from '../lib/hooks/useKeyboardNavigation';

const containerRef = useRef<HTMLDivElement>(null);

useKeyboardNavigation(containerRef, {
  onEscape: () => closeModal(),
  onEnter: () => submitForm(),
  onArrowDown: () => moveToNext(),
  onArrowUp: () => moveToPrevious(),
  enabled: true
});
```

## Best Practices

### 1. Always Provide ARIA Labels

```typescript
// Good
<button aria-label="Close modal">×</button>

// Bad
<button>×</button>
```

### 2. Use Semantic HTML

```typescript
// Good
<nav role="navigation" aria-label="Main navigation">
  <button role="tab" aria-selected={isActive}>Tab</button>
</nav>

// Bad
<div>
  <div onClick={handleClick}>Tab</div>
</div>
```

### 3. Ensure Minimum Touch Targets

```typescript
// Good - minimum 44x44px
<button className="min-h-[44px] min-w-[44px] px-4 py-2">
  Click Me
</button>

// Bad - too small
<button className="p-1">×</button>
```

### 4. Provide Focus Indicators

```typescript
// Good - visible focus ring
<button className="focus:outline-none focus:ring-3 focus:ring-brand-primary">
  Button
</button>

// Bad - no focus indicator
<button className="focus:outline-none">
  Button
</button>
```

### 5. Use Live Regions for Dynamic Content

```typescript
// Good - announces changes
<div role="status" aria-live="polite">
  {statusMessage}
</div>

// Bad - silent updates
<div>{statusMessage}</div>
```

### 6. Implement Keyboard Navigation

```typescript
// Good - keyboard accessible
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }}
>
  Custom Button
</div>

// Bad - mouse only
<div onClick={handleClick}>
  Custom Button
</div>
```

### 7. Provide Alternative Text

```typescript
// Good
<img src="chart.png" alt="Bar chart showing 50% increase in sales" />

// Bad
<img src="chart.png" />
```

### 8. Use Proper Heading Hierarchy

```typescript
// Good
<h1>Main Title</h1>
<h2>Section Title</h2>
<h3>Subsection Title</h3>

// Bad
<h1>Main Title</h1>
<h3>Section Title</h3> // Skipped h2
```

## Testing Checklist

### Keyboard Navigation
- [ ] All interactive elements are reachable via Tab
- [ ] Tab order is logical
- [ ] Enter/Space activates buttons
- [ ] Escape closes modals
- [ ] Arrow keys work in lists
- [ ] Focus indicators are visible

### Screen Reader
- [ ] All images have alt text
- [ ] All buttons have labels
- [ ] Form inputs have labels
- [ ] Dynamic content is announced
- [ ] Landmarks are properly labeled
- [ ] Heading hierarchy is correct

### Visual
- [ ] High contrast mode works
- [ ] Text is readable at 200% zoom
- [ ] Touch targets are at least 44x44px
- [ ] Focus indicators are visible
- [ ] Color is not the only indicator

### Motion
- [ ] Reduced motion mode works
- [ ] Animations can be disabled
- [ ] No flashing content

## Common Patterns

### Modal Dialog

```typescript
<Modal
  isOpen={isOpen}
  onClose={handleClose}
  title="Dialog Title"
  ariaLabel="Descriptive label"
>
  <div>
    <h2 id="dialog-title">Title</h2>
    <p id="dialog-description">Description</p>
    {/* Content */}
  </div>
</Modal>
```

### Form with Labels

```typescript
<form>
  <label htmlFor="email">Email Address</label>
  <input
    id="email"
    type="email"
    aria-required="true"
    aria-describedby="email-help"
  />
  <p id="email-help" className="text-sm">
    We'll never share your email
  </p>
</form>
```

### Loading State

```typescript
<div role="status" aria-live="polite" aria-busy={isLoading}>
  {isLoading ? (
    <>
      <span className="sr-only">Loading...</span>
      <LoadingSpinner />
    </>
  ) : (
    <Content />
  )}
</div>
```

### Error Message

```typescript
<div role="alert" aria-live="assertive">
  <strong>Error:</strong> {errorMessage}
</div>
```

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Resources](https://webaim.org/resources/)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)

## Support

For questions or issues related to accessibility:
1. Check the Help Documentation in the app
2. Review this developer guide
3. Consult WCAG 2.1 guidelines
4. Test with actual assistive technologies
