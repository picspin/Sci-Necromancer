# Troubleshooting: Blank Page Issue

## Problem

The Vue 3 application dev server is running without errors, but the page appears blank in the browser.

## Diagnostic Steps

### 1. Check Browser Console (MOST IMPORTANT)

**Open Browser Console:**

- Chrome/Edge: Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
- Firefox: Press `F12` or `Cmd+Option+K` (Mac) / `Ctrl+Shift+K` (Windows)
- Safari: Enable Developer Menu → Develop → Show JavaScript Console

**Look for these types of errors:**

- ❌ `Failed to resolve module specifier` - Import path issue
- ❌ `Uncaught ReferenceError` - Missing variable/function
- ❌ `Uncaught TypeError` - Type mismatch or null reference
- ❌ `Failed to fetch` - Missing translation or asset files
- ❌ `SyntaxError` - JavaScript syntax error

### 2. Test Basic Vue Functionality

Visit: **http://localhost:3000/test-vue.html**

**Expected Result:**

- You should see "✅ Vue 3 is working!"
- A counter and clickable button
- Button increments counter when clicked

**If test-vue.html works:**
→ Vue 3 is working, the issue is in the application code

**If test-vue.html is also blank:**
→ Browser/Vite configuration issue

### 3. Check Network Tab

In Browser DevTools:

1. Go to **Network** tab
2. Refresh page (`Cmd+R` or `Ctrl+R`)
3. Check if all files load with `200` status

**Look for:**

- ❌ Red status codes (404, 500)
- ❌ Failed requests (shown in red)
- ✅ `/src/main.ts` should load with status 200
- ✅ `/src/App.vue` should load with status 200
- ✅ `/locales/en/translation.json` should load

### 4. Check Vue DevTools

Install Vue DevTools extension:

- Chrome: https://chrome.google.com/webstore/detail/vuejs-devtools
- Firefox: https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/

After installation:

- Open DevTools → Vue tab
- Check if components are mounted
- Look for component tree

## Common Issues & Solutions

### Issue 1: Missing Translation Files

**Symptoms:** Console error about failed fetch to `/locales/`
**Solution:**

```bash
# Verify files exist
ls -la public/locales/en/translation.json
ls -la public/locales/zh/translation.json
```

### Issue 2: Import Path Errors

**Symptoms:** Console error `Failed to resolve module`
**Solution:**
Check `vite.config.ts` path aliases:

```typescript
'@': path.resolve(__dirname, './')
'@/components': path.resolve(__dirname, './src/components')
```

### Issue 3: Component Import Errors

**Symptoms:** Console shows error loading .vue components
**Common causes:**

- Missing component files
- Circular imports
- Syntax errors in .vue files

**Check:**

```bash
# Verify all imported components exist
ls -la src/components/panels/ConferencePanel.vue
ls -la src/components/ui/SvgIcon.vue
ls -la src/components/LanguageSelector.vue
```

### Issue 4: Async Initialization Failure

**Symptoms:** Page blank, no errors, Vue DevTools shows components
**Solution:**
Check browser console for:

- `Failed to initialize conference registry`
- Promise rejection errors
- Async/await errors

### Issue 5: CSS/Tailwind Not Loading

**Symptoms:** Page has content but no styling
**Solution:**
Check if Tailwind CDN loaded:

```html
<script src="https://cdn.tailwindcss.com"></script>
```

## Advanced Diagnostics

### Check if Vue is Mounting

Open browser console and run:

```javascript
// Check if root element exists
document.getElementById('root');

// Check if root has content
document.getElementById('root').innerHTML;

// Check if Vue app instance exists
window.__VUE_DEVTOOLS_GLOBAL_HOOK__;
```

### Check Vite Module Graph

In browser console:

```javascript
// See what modules are loaded
await import('/src/main.ts');
```

### Manual Component Test

Create a minimal App.vue:

```vue
<template>
  <div class="p-8">
    <h1 class="text-4xl text-white">Hello from Vue!</h1>
  </div>
</template>

<script setup>
console.log('App.vue loaded!');
</script>
```

## Known Issues in This Project

### 1. TypeScript Errors (Non-blocking)

- ~60 TypeScript errors from legacy code
- These are in "legacy tolerance mode"
- Should NOT prevent runtime execution

### 2. Missing ER Panel Component

- ER (European Radiology) panel is a placeholder
- This is expected and should show "Coming Soon"

### 3. Duplicate Hook Implementations

- Both `lib/hooks/useConferenceRegistry.ts` (React)
- And `src/composables/useConferenceRegistry.ts` (Vue)
- Vue app uses the one in `src/composables/`

## Quick Fixes to Try

### 1. Hard Refresh

```
Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
```

### 2. Clear Browser Cache

- Chrome: Settings → Privacy → Clear browsing data → Cached images and files
- Or use Incognito/Private mode

### 3. Restart Dev Server

```bash
# Kill current server
# Then restart
npm run dev
```

### 4. Clean Build

```bash
rm -rf node_modules/.vite
rm -rf dist
npm run dev
```

## Report Your Findings

Please share:

1. **Browser console errors** (screenshot or copy text)
2. **Network tab failures** (any red/failed requests)
3. **test-vue.html result** (does it work?)
4. **Browser and version** (e.g., Chrome 120, Safari 17)

With this information, we can pinpoint the exact issue!

## Emergency Fallback

If Vue migration is broken, you can switch back to working React version:

```bash
git checkout react-original
npm run dev
```

The React version at commit `2062b3b` should work correctly.
