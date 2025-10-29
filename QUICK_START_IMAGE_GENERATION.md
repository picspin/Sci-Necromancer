# Quick Start: Image Generation Setup

## Choose Your Path

### Option 1: SiliconFlow (Recommended for most users)

**Best for**: Users with SiliconFlow API access

**Setup** (2 minutes):
1. Open Model Manager (⚙️ icon)
2. Go to **"AI Providers"** tab
3. Select "OpenAI Compatible"
4. Fill in:
   - **API Key**: Your SiliconFlow key
   - **Base URL**: `https://api.siliconflow.cn`
   - **Image Model**: `black-forest-labs/FLUX.1-schnell`
5. Click "Save Settings"
6. Done! ✅

**Models to try**:
- `black-forest-labs/FLUX.1-schnell` (Fast, good quality)
- `stabilityai/stable-diffusion-xl-base-1.0` (Classic, reliable)
- `Qwen/Qwen-Image-Edit-2509` (Latest, experimental)

---

### Option 2: MyGenAssist MCP (For Bayer users)

**Best for**: Bayer employees with MyGenAssist access

**Setup** (3 minutes):
1. Open Model Manager (⚙️ icon)
2. Go to **"AI Providers"** tab
3. Select "OpenAI Compatible" for text/vision
4. Fill in your text model settings
5. Go to **"MCP Tools"** tab
6. Toggle **"Image Generation"** ON
7. Fill in:
   - **Base URL**: `https://chat.int.bayer.com/api/v2`
   - **Model**: `gpt-4o` (or any model with tool access)
8. (Optional) Add custom configuration in JSON field
9. Click "Save Settings"
10. Done! ✅

**Optional**: Add custom headers
```json
{
  "customHeaders": {
    "X-Custom-Header": "value"
  }
}
```

---

### Option 3: Add Your Own MCP Tool

**Setup** (5 minutes):
1. Open Model Manager (⚙️ icon)
2. Go to **"MCP Tools"** tab
3. Click **"+ Add Tool"** button
4. Enter JSON configuration:
```json
{
  "name": "myCustomTool",
  "enabled": true,
  "baseUrl": "https://your-api.com",
  "model": "your-model",
  "customConfig": "{\"key\": \"value\"}"
}
```
5. Click "Add Tool"
6. Configure the tool settings
7. Click "Save Settings"
8. Done! ✅

---

## Testing Your Setup

1. Go to "Figure Generation" tab
2. Enter specs: "A red circle on white background"
3. Click "Generate Figure"
4. Wait 10-30 seconds
5. Image should appear below

**If it fails**:
- Check API key is correct
- Verify base URL has no typos
- Try a different model
- Check console for error messages

---

## Common Issues

### "API key required"
→ Add your API key in Model Manager

### "SiliconFlow API failed: 401"
→ API key is invalid or expired

### "SiliconFlow API failed: 404"
→ Model name is wrong, try `black-forest-labs/FLUX.1-schnell`

### "No image data returned from MCP tools"
→ Model doesn't have tool access, try `gpt-4o`

### "MCP tool call failed: 404"
→ Check base URL is correct: `https://chat.int.bayer.com/api/v2`

---

## Advanced: Image Editing

1. Upload an image (click "Upload Image")
2. Add specs describing changes
3. Click "Generate Figure"
4. System will:
   - Analyze your image with vision model
   - Generate new image based on analysis + specs

**Requirements**:
- Vision model must be configured
- For SiliconFlow: Use `Qwen/Qwen2-VL-72B-Instruct`
- For MCP: Use `gpt-4o` or similar VLM

---

## Pro Tips

### For Best Results
- Be specific in your specs
- Use professional terminology
- Mention "scientific" or "medical" for academic figures
- Specify colors, layout, style

### Example Specs
✅ Good: "A bar chart showing 3 groups with error bars, blue color scheme, white background, publication quality"

❌ Bad: "Make a chart"

### Performance
- SiliconFlow: ~10-20 seconds
- MCP: ~20-40 seconds (depends on model + tool)
- Image editing: +5-10 seconds for analysis

### Cost Optimization
- SiliconFlow: Direct API calls (cheaper)
- MCP: Model + tool calls (more expensive)
- Use SiliconFlow unless you need MCP features

---

## Need Help?

1. Check `IMAGE_GENERATION_ARCHITECTURE.md` for detailed docs
2. Check `REFACTORING_SUMMARY.md` for technical details
3. Check browser console for error messages
4. Verify your API keys and URLs are correct

---

## Quick Reference

| Setting | SiliconFlow | MyGenAssist MCP |
|---------|-------------|-----------------|
| Provider | OpenAI Compatible | OpenAI Compatible |
| Base URL | `https://api.siliconflow.cn` | (for text model) |
| Image Model | `black-forest-labs/FLUX.1-schnell` | N/A |
| MCP Enabled | ❌ No | ✅ Yes |
| MCP Base URL | N/A | `https://chat.int.bayer.com/api/v2` |
| MCP Model | N/A | `gpt-4o` |

---

**Last Updated**: 2025-01-XX
**Version**: 2.0 (Simplified Architecture)
