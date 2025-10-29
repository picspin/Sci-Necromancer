# Quick Reference Card

## Model Manager Structure

```
┌─────────────────────────────────────────┐
│         Model Manager                   │
├─────────────────────────────────────────┤
│  [AI Providers]  [MCP Tools]           │
├─────────────────────────────────────────┤
│                                         │
│  AI PROVIDERS TAB:                      │
│  • Google AI / OpenAI Compatible        │
│  • API Keys & Base URLs                 │
│  • Text / Vision / Image Models         │
│                                         │
│  MCP TOOLS TAB:                         │
│  • [+ Add Tool] button                  │
│  • Supabase (Database)                  │
│  • Image Generation                     │
│  • Custom Tools (dynamic)               │
│                                         │
├─────────────────────────────────────────┤
│         [Cancel]  [Save Settings]       │
└─────────────────────────────────────────┘
```

## Quick Actions

| Action | Steps |
|--------|-------|
| Configure SiliconFlow | AI Providers → OpenAI Compatible → Fill settings |
| Enable MCP Image Gen | MCP Tools → Toggle "Image Generation" ON |
| Add Custom Tool | MCP Tools → "+ Add Tool" → Paste JSON |
| Remove Custom Tool | MCP Tools → Find tool → Click "Remove" |
| Enable Database | MCP Tools → Toggle "Supabase" ON |

## JSON Template for Custom Tools

```json
{
  "name": "toolName",
  "enabled": true,
  "baseUrl": "https://api.example.com",
  "model": "gpt-4o",
  "customConfig": "{\"key\": \"value\"}"
}
```

## Common Configurations

### SiliconFlow Only
- **Tab**: AI Providers
- **Provider**: OpenAI Compatible
- **Base URL**: `https://api.siliconflow.cn`
- **Image Model**: `black-forest-labs/FLUX.1-schnell`
- **MCP Tools**: None needed

### MyGenAssist MCP
- **Tab 1**: AI Providers → Configure text/vision
- **Tab 2**: MCP Tools → Enable "Image Generation"
- **Base URL**: `https://chat.int.bayer.com/api/v2`
- **Model**: `gpt-4o`

### Full Stack
- **AI Providers**: Configure all models
- **MCP Tools**: Enable all needed tools
- **Custom Tools**: Add via JSON

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Can't find MCP settings | Click "MCP Tools" tab |
| Tool not working | Check toggle is ON |
| JSON error | Validate format, check quotes |
| Settings not saving | Click "Save Settings" button |

## Documentation

- `MCP_TOOLS_GUIDE.md` - Full MCP tools guide
- `IMAGE_GENERATION_ARCHITECTURE.md` - Technical details
- `QUICK_START_IMAGE_GENERATION.md` - Setup walkthrough
- `FINAL_REFACTORING_SUMMARY.md` - What changed
