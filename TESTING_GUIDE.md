# Testing Guide - Updated Workflow

## 🎯 Test Scenario 1: Standard Workflow

### Setup
1. Open the application
2. Ensure you have a valid API key configured (Google AI or OpenAI)
3. Navigate to ISMRM Abstract Assistant tab

### Test Steps

#### Step 1: Input Text
1. Paste sample research text into the textarea OR
2. Upload a .txt, .pdf, or .docx file
3. Verify text appears in the input area

**Expected**: Text is loaded successfully

#### Step 2: Click "1. Analyze"
1. Click the "1. Analyze" button
2. Observe loading messages:
   - 🔍 Analyzing content...
   - 📝 Generating impact & synopsis...
   - 🎯 Suggesting abstract types...

**Expected**: 
- Loading spinner shows
- Loading messages update
- No errors appear
- Modal opens after ~10-15 seconds

#### Step 3: Review Modal - Analysis Step
1. Verify modal shows "Analysis Complete ✨"
2. Check Impact section:
   - Text is present
   - Word count shows (e.g., "35/40 words")
   - Text is editable
3. Check Synopsis section:
   - Text is present
   - Word count shows (e.g., "95/100 words")
   - Text is editable
4. Check Categories section:
   - Multiple categories shown
   - Each has probability percentage (e.g., "Neuro 85%")
   - Categories are sorted by probability (highest first)
   - Categories are color-coded (main=purple, sub=blue, secondary=gray)
   - Can click to select/deselect
5. Check Keywords section:
   - Multiple keywords shown
   - Can click to select/deselect

**Expected**: All sections display correctly with proper formatting

#### Step 4: Edit and Confirm
1. Edit the Impact text (try adding/removing words)
2. Verify word count updates in real-time
3. Edit the Synopsis text
4. Verify word count updates
5. Select/deselect some categories
6. Select/deselect some keywords
7. Click "Confirm & View Abstract Types"

**Expected**: 
- Edits are saved
- Word counts update correctly
- Modal transitions to type selection

#### Step 5: Select Abstract Type
1. Verify modal shows "Recommended Abstract Type"
2. Check type suggestions:
   - Multiple types shown (e.g., Standard Abstract, Clinical Practice)
   - Each has match percentage (e.g., "75% match")
   - Types are sorted by probability
3. Click on a type (e.g., "Standard Abstract")

**Expected**: 
- Modal closes
- Selected type is saved

#### Step 6: Review Right Panel
1. Check right panel displays:
   - 🔵 Impact (blue section)
   - 🟢 Synopsis (green section)
   - 🟣 Categories (purple chips)
   - 🟠 Keywords (orange section)
2. Verify all content matches what was confirmed in modal

**Expected**: All sections display with correct colors and content

#### Step 7: Click "2. Generate"
1. Click the "2. Generate" button
2. Observe loading message: ✨ Generating spec-compliant abstract...
3. Wait for generation to complete (~10-20 seconds)

**Expected**: 
- Loading spinner shows
- No errors appear

#### Step 8: Review Generated Abstract
1. Check right panel now shows:
   - Impact (unchanged)
   - Synopsis (unchanged)
   - Categories (unchanged)
   - Keywords (unchanged)
   - **📄 Abstract (Standard Abstract)** - NEW!
2. Verify abstract body:
   - Has section headers (INTRODUCTION, METHODS, RESULTS, DISCUSSION, CONCLUSION)
   - Headers are highlighted in blue
   - Content is properly formatted
   - Text is readable and makes sense

**Expected**: Full abstract is displayed with proper structure

#### Step 9: Export
1. Click "MD" button
2. Verify .md file downloads
3. Open file and check it contains:
   - Impact
   - Synopsis
   - Abstract body
   - Keywords
4. Click "PDF" button
5. Verify .pdf file downloads
6. Click "JSON" button
7. Verify .json file downloads

**Expected**: All export formats work correctly

---

## 🎯 Test Scenario 2: Creative Mode

### Test Steps

#### Step 1: Switch to Creative Mode
1. Click "Creative Expansion" mode button
2. Enter a one-sentence idea (e.g., "Using AI to predict patient outcomes from MRI scans")

#### Step 2: Generate
1. Click "Generate Creatively" button
2. Wait for generation (~15-20 seconds)

**Expected**: 
- Abstract is generated with Impact, Synopsis, Keywords, and Abstract body
- All sections appear in right panel
- No modal appears (creative mode skips selection)

---

## 🎯 Test Scenario 3: Image Generation

### Test Steps

#### Step 1: Switch to Figure Generation Tab
1. Click "Figure Generation" tab

#### Step 2: Standard Mode
1. Ensure "Standard Edit" is selected
2. Upload an image file
3. Enter image specifications (e.g., "Add arrows pointing to key features")
4. Click "Generate Figure"
5. Wait for generation

**Expected**: 
- Edited image appears
- Download button is available

#### Step 3: Creative Mode
1. First generate an abstract (follow Scenario 1)
2. Switch to "Figure Generation" tab
3. Click "Creative Generation" mode
4. Enter image specifications
5. Click "Generate Figure"

**Expected**: 
- New image is generated based on abstract content
- Download button is available

---

## 🐛 Error Testing

### Test 1: No API Key
1. Remove API key from settings
2. Try to analyze content

**Expected**: Clear error message about missing API key

### Test 2: Empty Input
1. Leave text input empty
2. Click "1. Analyze"

**Expected**: Error message "Please provide input text to analyze."

### Test 3: Network Error
1. Disconnect internet
2. Try to analyze content

**Expected**: Network error message with retry option

### Test 4: Invalid File
1. Try to upload an unsupported file type
2. Verify error message

**Expected**: Clear error about unsupported file type

---

## ✅ Success Criteria

### Modal Functionality
- [ ] Modal opens after "1. Analyze"
- [ ] Impact and Synopsis are editable
- [ ] Word counts update in real-time
- [ ] Categories are selectable with probabilities
- [ ] Keywords are selectable
- [ ] Modal transitions to type selection
- [ ] Modal closes after type selection

### Display Functionality
- [ ] Right panel shows color-coded sections
- [ ] Impact is blue
- [ ] Synopsis is green
- [ ] Categories are purple chips
- [ ] Keywords are orange
- [ ] Abstract body has highlighted headers
- [ ] All content is properly formatted

### Workflow Functionality
- [ ] "1. Analyze" completes without errors
- [ ] "2. Generate" completes without errors
- [ ] Creative mode works
- [ ] Image generation works
- [ ] Export functions work (MD, PDF, JSON)

### Error Handling
- [ ] Missing API key shows clear error
- [ ] Empty input shows clear error
- [ ] Network errors are handled gracefully
- [ ] Invalid files show clear error

---

## 📊 Performance Benchmarks

| Operation         | Expected Time | Acceptable Range |
| ----------------- | ------------- | ---------------- |
| Analyze Content   | 10-15s        | 5-30s            |
| Generate Abstract | 10-20s        | 5-40s            |
| Generate Image    | 15-30s        | 10-60s           |
| Creative Mode     | 15-20s        | 10-40s           |

---

## 🔍 Common Issues and Solutions

### Issue: Modal doesn't open
**Check**: 
- Console for errors
- API key is configured
- Network connection
- Provider is selected in settings

### Issue: "Provider does not support structured output"
**Solution**: This should be fixed now. If it still appears:
- Check that `Type` is imported from `@google/genai`
- Verify provider name is correctly set
- Check console for detailed error

### Issue: Word count is wrong
**Check**:
- Text has proper spacing
- Special characters aren't breaking the count
- Empty lines aren't counted

### Issue: Categories not showing probabilities
**Check**:
- Analysis completed successfully
- Categories array has probability field
- Modal is using correct component

---

## 📝 Test Report Template

```
Test Date: ___________
Tester: ___________
Provider: [ ] Google AI  [ ] OpenAI
Browser: ___________

Scenario 1: Standard Workflow
- Input Text: [ ] Pass [ ] Fail
- Analyze: [ ] Pass [ ] Fail
- Modal Display: [ ] Pass [ ] Fail
- Edit & Confirm: [ ] Pass [ ] Fail
- Type Selection: [ ] Pass [ ] Fail
- Right Panel: [ ] Pass [ ] Fail
- Generate: [ ] Pass [ ] Fail
- Abstract Display: [ ] Pass [ ] Fail
- Export: [ ] Pass [ ] Fail

Scenario 2: Creative Mode
- [ ] Pass [ ] Fail

Scenario 3: Image Generation
- [ ] Pass [ ] Fail

Error Testing
- [ ] Pass [ ] Fail

Notes:
_________________________________
_________________________________
_________________________________
```

---

**Last Updated**: 2025-10-28
**Status**: Ready for Testing
