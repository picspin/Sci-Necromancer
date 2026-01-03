# Frontend Workflow Diagram

## Complete User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Inputs Text                              │
│  (Upload .txt/.pdf/.docx or paste text)                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Click "1. Analyze" Button                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Loading: 🔍 Analyzing content...                               │
│  ├─ Step 1: Extract Categories & Keywords                       │
│  ├─ Step 2: Generate Impact (40 words)                          │
│  ├─ Step 3: Generate Synopsis (100 words)                       │
│  └─ Step 4: Suggest Abstract Types                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Modal Opens                                   │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Analysis Complete ✨                                       │ │
│  │                                                             │ │
│  │ Impact Statement (editable)                                │ │
│  │ ┌─────────────────────────────────────────────────────┐   │ │
│  │ │ [40-word impact text]                    15/40 words│   │ │
│  │ └─────────────────────────────────────────────────────┘   │ │
│  │                                                             │ │
│  │ Synopsis (editable)                                        │ │
│  │ ┌─────────────────────────────────────────────────────┐   │ │
│  │ │ [100-word synopsis text]                 85/100 words│  │ │
│  │ └─────────────────────────────────────────────────────┘   │ │
│  │                                                             │ │
│  │ Categories (sorted by probability)                         │ │
│  │ [Neuro 85%] [fMRI 75%] [Brain 60%] ...                    │ │
│  │                                                             │ │
│  │ Keywords                                                    │ │
│  │ [diffusion] [connectivity] [MRI] ...                       │ │
│  │                                                             │ │
│  │ [Confirm & View Abstract Types]                            │ │
│  └───────────────────────────────────────────────────────────┘ │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Modal Updates                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Recommended Abstract Type                                  │ │
│  │                                                             │ │
│  │ ┌─────────────────────────────────────────────────────┐   │ │
│  │ │ Standard Abstract                        75% match  │   │ │
│  │ └─────────────────────────────────────────────────────┘   │ │
│  │ ┌─────────────────────────────────────────────────────┐   │ │
│  │ │ MRI in Clinical Practice Abstract        45% match  │   │ │
│  │ └─────────────────────────────────────────────────────┘   │ │
│  │ ┌─────────────────────────────────────────────────────┐   │ │
│  │ │ Registered Abstract                      30% match  │   │ │
│  │ └─────────────────────────────────────────────────────┘   │ │
│  └───────────────────────────────────────────────────────────┘ │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              User Selects Abstract Type                          │
│              Modal Closes                                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Right Panel Shows (Color-Coded):                               │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 🔵 Impact                                                  │ │
│  │ [40-word impact statement]                                 │ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │ 🟢 Synopsis                                                │ │
│  │ [100-word synopsis]                                        │ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │ 🟣 Categories                                              │ │
│  │ [Neuro (main)] [fMRI (sub)] [Brain (secondary)]           │ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │ 🟠 Keywords                                                │ │
│  │ diffusion, connectivity, MRI, brain, imaging              │ │
│  └───────────────────────────────────────────────────────────┘ │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Click "2. Generate" Button                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Loading: ✨ Generating spec-compliant abstract...             │
│  ├─ Load type-specific guidance                                 │
│  ├─ Apply spec-specific prompts                                 │
│  └─ Generate structured abstract                                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Right Panel Updates (Full Display):                            │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 🔵 Impact                                                  │ │
│  │ [40-word impact statement]                                 │ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │ 🟢 Synopsis                                                │ │
│  │ [100-word synopsis]                                        │ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │ 🟣 Categories                                              │ │
│  │ [Neuro (main)] [fMRI (sub)] [Brain (secondary)]           │ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │ 🟠 Keywords                                                │ │
│  │ diffusion, connectivity, MRI, brain, imaging              │ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │ 📄 Abstract (Standard Abstract)                           │ │
│  │                                                             │ │
│  │ INTRODUCTION:                                              │ │
│  │ [Introduction text...]                                     │ │
│  │                                                             │ │
│  │ METHODS:                                                   │ │
│  │ [Methods text...]                                          │ │
│  │                                                             │ │
│  │ RESULTS:                                                   │ │
│  │ [Results text...]                                          │ │
│  │                                                             │ │
│  │ DISCUSSION:                                                │ │
│  │ [Discussion text...]                                       │ │
│  │                                                             │ │
│  │ CONCLUSION:                                                │ │
│  │ [Conclusion text...]                                       │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Export Options (Top Right):                                    │
│  [MD] [PDF] [JSON]                                              │
└─────────────────────────────────────────────────────────────────┘
```

## Button States

### "1. Analyze" Button

- **Enabled**: When text input is not empty
- **Disabled**: When loading or text is empty
- **Loading**: Shows emoji animation (🔍 → 📝 → 🎯)

### "2. Generate" Button

- **Enabled**: When abstract type is selected
- **Disabled**: When loading or no type selected
- **Loading**: Shows emoji animation (✨)

## Color Coding

| Section    | Color  | Hex Code  | Purpose                |
| ---------- | ------ | --------- | ---------------------- |
| Impact     | Blue   | `#2563eb` | Significance statement |
| Synopsis   | Green  | `#16a34a` | Summary overview       |
| Categories | Purple | `#9333ea` | Classification tags    |
| Keywords   | Orange | `#ea580c` | Search terms           |
| Abstract   | Brand  | Custom    | Main content           |

## Modal Flow

```
┌─────────────────────────────────────────┐
│         Analysis Complete ✨            │
│                                          │
│  [Edit Impact & Synopsis]               │
│  [Select Categories]                    │
│  [Select Keywords]                      │
│                                          │
│  [Confirm & View Abstract Types] ───────┼──┐
└─────────────────────────────────────────┘  │
                                              │
                                              ▼
┌─────────────────────────────────────────────────┐
│      Recommended Abstract Type                  │
│                                                  │
│  [Standard Abstract - 75%] ──────────────┐      │
│  [Clinical Practice - 45%]               │      │
│  [Registered - 30%]                      │      │
└──────────────────────────────────────────┼──────┘
                                           │
                                           ▼
                                    [Modal Closes]
                                    [Type Selected]
```

## Export Flow

```
┌─────────────────────────────────────────┐
│     Generated Abstract Complete         │
└────────────────┬────────────────────────┘
                 │
                 ├─── [MD] ──────► Download .md file
                 │                 (Includes all sections)
                 │
                 ├─── [PDF] ─────► Download .pdf file
                 │                 (Formatted document)
                 │
                 └─── [JSON] ────► Download .json file
                                   (Structured data)
```

## Image Generation Flow

```
┌─────────────────────────────────────────┐
│     Switch to "Figure Generation"       │
└────────────────┬────────────────────────┘
                 │
                 ├─── Standard Mode:
                 │    ├─ Upload image
                 │    ├─ Add specs/guidelines
                 │    └─ Generate edited image
                 │
                 └─── Creative Mode:
                      ├─ Use generated abstract
                      ├─ Add specs/guidelines
                      └─ Generate new image

┌─────────────────────────────────────────┐
│     Generated Figure Display            │
│  ┌───────────────────────────────────┐  │
│  │  [Image Preview]                  │  │
│  └───────────────────────────────────┘  │
│  [Download Image] ──────► Save as JPG   │
└─────────────────────────────────────────┘
```

## Error Handling

```
┌─────────────────────────────────────────┐
│         Error Occurred                   │
│  ┌───────────────────────────────────┐  │
│  │ ⚠️ Error Message                  │  │
│  │ [Detailed error description]      │  │
│  └───────────────────────────────────┘  │
│                                          │
│  Options:                                │
│  - Retry operation                       │
│  - Check API key                         │
│  - Switch provider                       │
└─────────────────────────────────────────┘
```

## Loading States

| Step                | Message                                  | Duration | Visual  |
| ------------------- | ---------------------------------------- | -------- | ------- |
| Analysis            | 🔍 Analyzing content...                  | 3-5s     | Spinner |
| Impact/Synopsis     | 📝 Generating impact & synopsis...       | 5-8s     | Spinner |
| Type Suggestion     | 🎯 Suggesting abstract types...          | 2-3s     | Spinner |
| Abstract Generation | ✨ Generating spec-compliant abstract... | 10-15s   | Spinner |
| Image Generation    | 🎨 Generating figure...                  | 15-30s   | Spinner |

## Responsive Behavior

### Desktop (>1024px)

- Two-column layout
- Left: Input panel
- Right: Output panel
- Modal: Centered, max-width 800px

### Tablet (768px - 1024px)

- Two-column layout (narrower)
- Modal: Centered, max-width 600px

### Mobile (<768px)

- Single-column layout
- Input panel on top
- Output panel below
- Modal: Full-width with padding

## Keyboard Shortcuts (Future Enhancement)

| Shortcut   | Action               |
| ---------- | -------------------- |
| Ctrl+Enter | Proceed to next step |
| Ctrl+S     | Save abstract        |
| Ctrl+E     | Export as MD         |
| Esc        | Close modal          |

---

**Last Updated**: 2025-10-28
**Status**: ✅ Implemented and Ready for Testing
