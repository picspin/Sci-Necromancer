# MCP Tools Configuration Guide

## Overview

The MCP Tools panel in Model Manager provides a centralized place to configure all Model Context Protocol (MCP) tools. This keeps your AI Provider configuration clean and allows easy management of multiple MCP integrations.

## Accessing MCP Tools

1. Open Model Manager (⚙️ icon)
2. Click the **"MCP Tools"** tab
3. Configure your tools

## Built-in MCP Tools

### 1. Supabase (Database)

**Purpose**: Cloud-based database storage for abstracts and guidelines

**Configuration**:
- **Enable Cloud Storage**: Toggle to activate
- **Supabase URL**: Your project URL (e.g., `https://your-project.supabase.co`)
- **API Key**: Your Supabase anon/public key
- **Auto-sync**: Automatically sync data to cloud

**Usage**:
- Stores abstracts in the cloud
- Syncs across devices
- Enables collaboration

**Test Connection**: Click "Test Connection" to verify setup

---

### 2. Image Generation

**Purpose**: Generate images via MCP tool calls (for platforms like MyGenAssist)

**Configuration**:
- **Enable**: Toggle to activate
- **Base URL**: MCP endpoint (e.g., `https://chat.int.bayer.com/api/v2`)
- **Model**: Model with tool access (e.g., `gpt-4o`)
- **Custom Configuration**: Optional JSON for headers/settings

**Example Custom Config**:
```json
{
  "customHeaders": {
    "X-API-Version": "v2",
    "X-Custom-Header": "value"
  }
}
```

**Usage**:
- Generates images through model tool calls
- Alternative to direct API image generation
- Required for platforms that use MCP architecture

---

## Adding Custom MCP Tools

### Step-by-Step

1. Click **"+ Add Tool"** button in MCP Tools panel
2. Enter JSON configuration in the popup
3. Click "Add Tool"
4. Tool appears in the list
5. Configure tool settings
6. Save Settings

### JSON Format

**Required Fields**:
- `name`: Unique identifier for the tool (string)
- `enabled`: Whether tool is active (boolean)

**Optional Fields**:
- `baseUrl`: API endpoint (string)
- `model`: Model to use (string)
- `customConfig`: Tool-specific configuration (JSON string)
- Any other fields your tool needs

### Example Configurations

#### Web Search Tool
```json
{
  "name": "webSearch",
  "enabled": true,
  "baseUrl": "https://api.search.com/v1",
  "model": "gpt-4o",
  "customConfig": "{\"maxResults\": 10, \"safeSearch\": true}"
}
```

#### Document Generator
```json
{
  "name": "docGenerator",
  "enabled": true,
  "baseUrl": "https://docs.api.com",
  "model": "gpt-4o",
  "customConfig": "{\"format\": \"pdf\", \"template\": \"academic\"}"
}
```

#### Custom RAG Tool
```json
{
  "name": "customRAG",
  "enabled": true,
  "baseUrl": "https://rag.mycompany.com/api",
  "model": "gpt-4o",
  "apiKey": "your-api-key",
  "customConfig": "{\"index\": \"medical\", \"topK\": 5}"
}
```

---

## Managing MCP Tools

### Enable/Disable Tool
- Toggle the switch next to the tool name
- Disabled tools won't be used but configuration is preserved

### Edit Tool Configuration
- Expand the tool section
- Modify fields directly
- Changes saved when you click "Save Settings"

### Remove Tool
- Click "Remove" button on custom tools
- Built-in tools (Supabase, Image Generation) cannot be removed
- Confirmation not required (be careful!)

### View Tool Configuration
- Custom tools show their full JSON configuration
- Useful for debugging and verification

---

## Best Practices

### Organization
- Use descriptive names for custom tools
- Group related tools with similar naming (e.g., `rag_medical`, `rag_legal`)
- Document your custom configurations

### Security
- Never commit API keys to version control
- Use environment variables for sensitive data
- Test tools in development before production

### Performance
- Disable unused tools to reduce overhead
- Monitor tool response times
- Use appropriate models for each tool

### Debugging
- Check browser console for errors
- Verify base URLs are correct
- Test API endpoints independently first
- Use simple configurations initially

---

## Troubleshooting

### Tool Not Working

**Check**:
1. Tool is enabled (toggle is ON)
2. Base URL is correct and accessible
3. API key is valid (if required)
4. Model has access to the tool
5. Custom config JSON is valid

**Common Issues**:
- **401 Unauthorized**: Check API key
- **404 Not Found**: Verify base URL and endpoint
- **Invalid JSON**: Validate custom config format
- **Timeout**: Check network connectivity

### Tool Not Appearing

**Solutions**:
- Refresh the page
- Check JSON format when adding
- Ensure `name` field is unique
- Verify `enabled` field is boolean

### Configuration Not Saving

**Solutions**:
- Click "Save Settings" button
- Check browser console for errors
- Verify localStorage is not full
- Try clearing browser cache

---

## Architecture

### How MCP Tools Work

```
User Action
    ↓
Application checks settings.mcpConfig
    ↓
If tool enabled:
    ↓
Call tool's baseUrl with model
    ↓
Model invokes MCP tool
    ↓
Tool returns result
    ↓
Display to user
```

### Storage

MCP tool configurations are stored in:
- **Location**: `localStorage` under `app-settings`
- **Key**: `mcpConfig`
- **Format**: JSON object with tool names as keys

Example:
```json
{
  "mcpConfig": {
    "supabase": { ... },
    "imageGeneration": { ... },
    "webSearch": { ... },
    "customTool": { ... }
  }
}
```

---

## Examples

### Complete Setup: Research Assistant

**AI Provider** (AI Providers tab):
```
Provider: OpenAI Compatible
Base URL: https://api.openai.com/v1
Text Model: gpt-4o
Vision Model: gpt-4o
```

**MCP Tools** (MCP Tools tab):

1. **Supabase** (for storing research):
```
Enabled: ✓
URL: https://research.supabase.co
API Key: [your-key]
Auto-sync: ✓
```

2. **Image Generation** (for figures):
```
Enabled: ✓
Base URL: https://chat.int.bayer.com/api/v2
Model: gpt-4o
```

3. **Web Search** (custom tool):
```json
{
  "name": "webSearch",
  "enabled": true,
  "baseUrl": "https://api.search.com",
  "model": "gpt-4o",
  "customConfig": "{\"maxResults\": 10}"
}
```

---

## Future Enhancements

Planned features:
- Tool marketplace/discovery
- Tool templates for common use cases
- Tool usage analytics
- Tool chaining (output of one tool → input of another)
- Conditional tool activation
- Tool versioning
- Import/export tool configurations

---

## Support

For issues or questions:
1. Check this guide first
2. Review browser console for errors
3. Test API endpoints independently
4. Check tool provider documentation
5. Contact support with:
   - Tool configuration (remove sensitive data)
   - Error messages
   - Steps to reproduce

---

**Last Updated**: 2025-01-XX
**Version**: 2.0 (Separate MCP Panel)
