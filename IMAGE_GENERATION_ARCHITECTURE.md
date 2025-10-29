# Image Generation Architecture

## Overview

The image generation system has been simplified into two clear paths:

### Path 1: SiliconFlow Direct API
- **When to use**: Default for most users, especially those using SiliconFlow models
- **How it works**: Direct API call to SiliconFlow's `/v1/images/generations` endpoint
- **Configuration**: Set in "OpenAI Compatible" slice
  - Base URL: `https://api.siliconflow.cn`
  - Image Model: `black-forest-labs/FLUX.1-schnell` or `stabilityai/stable-diffusion-xl-base-1.0`
  - Vision Model (optional): `Qwen/Qwen2-VL-72B-Instruct` for image analysis

### Path 2: MCP Tool-based Generation
- **When to use**: For platforms like MyGenAssist that provide image generation as a tool
- **How it works**: Calls a model with tool access, which then invokes the image generation tool
- **Configuration**: Enable in "MCP Tools" section
  - Base URL: `https://chat.int.bayer.com/api/v2`
  - Model: Any model with tool access (e.g., `gpt-4o`)
  - Custom Config: Optional JSON for headers or tool-specific settings

## Configuration Guide

### For SiliconFlow Users

1. Open Model Manager
2. Go to **"AI Providers"** tab
3. Select "OpenAI Compatible" provider
4. Configure:
   ```
   API Key: [Your SiliconFlow API key]
   Base URL: https://api.siliconflow.cn
   Text Model: Qwen/Qwen2.5-72B-Instruct
   Vision Model: Qwen/Qwen2-VL-72B-Instruct
   Image Model: black-forest-labs/FLUX.1-schnell
   ```
5. Go to **"MCP Tools"** tab
6. Keep "Image Generation" disabled
7. Save Settings

### For MyGenAssist Users

1. Open Model Manager
2. Go to **"AI Providers"** tab
3. Select "OpenAI Compatible" provider
4. Configure text and vision models (for analysis)
5. Go to **"MCP Tools"** tab
6. Enable "Image Generation MCP"
7. Configure:
   ```
   Base URL: https://chat.int.bayer.com/api/v2
   Model: gpt-4o
   Custom Configuration: (optional)
   {
     "customHeaders": {
       "X-Custom-Header": "value"
     }
   }
   ```
8. Save Settings

## API Request Examples

### SiliconFlow Request
```json
POST https://api.siliconflow.cn/v1/images/generations
Authorization: Bearer [API_KEY]
Content-Type: application/json

{
  "model": "black-forest-labs/FLUX.1-schnell",
  "prompt": "A scientific medical figure showing...",
  "image_size": "1024x1024",
  "batch_size": 1,
  "num_inference_steps": 20,
  "guidance_scale": 7.5
}
```

### MCP Tool Request
```json
POST https://chat.int.bayer.com/api/v2/chat/agent
Authorization: Bearer [API_KEY]
Content-Type: application/json

{
  "model": "gpt-4o",
  "messages": [
    {
      "role": "system",
      "content": "You are an AI assistant with image generation tools..."
    },
    {
      "role": "user",
      "content": "Generate image: A scientific medical figure..."
    }
  ],
  "temperature": 0.7,
  "stream": false
}
```

## Code Flow

```
generateImage()
  ├─> Check if MCP enabled
  │   ├─> YES: generateImageViaMCP()
  │   │         └─> Call /chat/agent with tool access
  │   │             └─> Extract image from tool_calls
  │   │
  │   └─> NO: generateImageViaSiliconFlow()
  │             └─> Call /v1/images/generations
  │                 └─> Download image from URL
  │
  └─> If image uploaded: analyzeImageWithVision() first
```

## Troubleshooting

### SiliconFlow Issues
- **Error: "No image URL in response"**: Check model name is correct
- **Error: "API failed: 401"**: Verify API key is valid
- **Error: "API failed: 404"**: Model not found, try `black-forest-labs/FLUX.1-schnell`

### MCP Tool Issues
- **Error: "No image data returned"**: Model may not have tool access
- **Error: "MCP tool call failed: 401"**: Check API key and base URL
- **Error: "MCP tool call failed: 404"**: Verify endpoint is `/chat/agent`

## Migration from Old Code

The old code had multiple redundant functions:
- `generateViaMCPTool()` - Now `generateImageViaMCP()`
- `generateImageFromPrompt()` - Now `generateImageViaSiliconFlow()`
- `isBayerPlatform()` - Removed, use explicit MCP toggle instead
- `testImageGenerationSetup()` - Removed, test via actual generation

Benefits of new architecture:
- ✅ Clearer separation of concerns
- ✅ Easier to debug and maintain
- ✅ Explicit configuration instead of URL detection
- ✅ Follows SiliconFlow API documentation exactly
- ✅ Supports future MCP tools easily
