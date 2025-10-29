# Image Generation Flow Diagram

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interface                          │
│                  (Figure Generation Tab)                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              generateImage(imageState, context)             │
│                                                             │
│  Decision: Is MCP Image Generation Enabled?                │
└────────────┬────────────────────────────────┬───────────────┘
             │                                │
        NO   │                                │  YES
             ▼                                ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│ generateImageViaSiliconFlow│    │  generateImageViaMCP    │
│                          │    │                          │
│  Path 1: Direct API      │    │  Path 2: Tool-based      │
└────────────┬─────────────┘    └────────────┬─────────────┘
             │                                │
             ▼                                ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│  SiliconFlow API         │    │  MCP Platform API        │
│  /v1/images/generations  │    │  /chat/agent             │
└────────────┬─────────────┘    └────────────┬─────────────┘
             │                                │
             ▼                                ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│  Image URL returned      │    │  Tool calls with image   │
│  Download & convert      │    │  Extract base64 data     │
└────────────┬─────────────┘    └────────────┬─────────────┘
             │                                │
             └────────────┬───────────────────┘
                          ▼
                ┌──────────────────┐
                │  Base64 Image    │
                │  Display to User │
                └──────────────────┘
```

## Detailed Flow: SiliconFlow Path

```
User clicks "Generate Figure"
         │
         ▼
┌─────────────────────────────────────────┐
│ Check if image uploaded?                │
└────┬─────────────────────────┬──────────┘
     │ YES                      │ NO
     ▼                          ▼
┌─────────────────┐    ┌──────────────────┐
│ Analyze with    │    │ Use creative     │
│ Vision Model    │    │ context directly │
│ (VLM)           │    │                  │
└────┬────────────┘    └────┬─────────────┘
     │                      │
     └──────────┬───────────┘
                ▼
┌─────────────────────────────────────────┐
│ Build prompt with specs                 │
└────────────────┬────────────────────────┘
                 ▼
┌─────────────────────────────────────────┐
│ POST /v1/images/generations             │
│ {                                       │
│   "model": "FLUX.1-schnell",           │
│   "prompt": "...",                     │
│   "image_size": "1024x1024",           │
│   "batch_size": 1,                     │
│   "num_inference_steps": 20,           │
│   "guidance_scale": 7.5                │
│ }                                       │
└────────────────┬────────────────────────┘
                 ▼
┌─────────────────────────────────────────┐
│ Response:                               │
│ {                                       │
│   "images": [{                          │
│     "url": "https://..."                │
│   }]                                    │
│ }                                       │
└────────────────┬────────────────────────┘
                 ▼
┌─────────────────────────────────────────┐
│ Download image from URL                 │
│ Convert to base64                       │
└────────────────┬────────────────────────┘
                 ▼
         Display to user
```

## Detailed Flow: MCP Path

```
User clicks "Generate Figure"
         │
         ▼
┌─────────────────────────────────────────┐
│ Check if image uploaded?                │
└────┬─────────────────────────┬──────────┘
     │ YES                      │ NO
     ▼                          ▼
┌─────────────────┐    ┌──────────────────┐
│ Analyze with    │    │ Use creative     │
│ Vision Model    │    │ context directly │
└────┬────────────┘    └────┬─────────────┘
     │                      │
     └──────────┬───────────┘
                ▼
┌─────────────────────────────────────────┐
│ Build prompt with specs                 │
└────────────────┬────────────────────────┘
                 ▼
┌─────────────────────────────────────────┐
│ Parse custom JSON config                │
│ Extract custom headers                  │
└────────────────┬────────────────────────┘
                 ▼
┌─────────────────────────────────────────┐
│ POST /chat/agent                        │
│ {                                       │
│   "model": "gpt-4o",                   │
│   "messages": [                        │
│     {                                  │
│       "role": "system",                │
│       "content": "You have tools..."   │
│     },                                 │
│     {                                  │
│       "role": "user",                  │
│       "content": "Generate: ..."       │
│     }                                  │
│   ]                                    │
│ }                                       │
└────────────────┬────────────────────────┘
                 ▼
┌─────────────────────────────────────────┐
│ Model invokes image generation tool     │
└────────────────┬────────────────────────┘
                 ▼
┌─────────────────────────────────────────┐
│ Response:                               │
│ {                                       │
│   "choices": [{                         │
│     "message": {                        │
│       "tool_calls": [{                  │
│         "function": {                   │
│           "arguments": {                │
│             "image": "base64..."        │
│           }                             │
│         }                               │
│       }]                                │
│     }                                   │
│   }]                                    │
│ }                                       │
└────────────────┬────────────────────────┘
                 ▼
┌─────────────────────────────────────────┐
│ Extract base64 from tool_calls          │
│ Clean up data URI prefix                │
└────────────────┬────────────────────────┘
                 ▼
         Display to user
```

## Configuration Decision Tree

```
                    Start
                      │
                      ▼
        ┌─────────────────────────┐
        │ Do you have SiliconFlow │
        │ API access?             │
        └────┬──────────────┬─────┘
             │ YES          │ NO
             ▼              ▼
    ┌────────────────┐  ┌──────────────────┐
    │ Use SiliconFlow│  │ Do you have MCP  │
    │ Direct API     │  │ platform access? │
    └────────────────┘  └────┬─────────────┘
                             │ YES
                             ▼
                    ┌──────────────────┐
                    │ Use MCP Tools    │
                    └──────────────────┘

Configuration:
┌─────────────────────────────────────────────────────────┐
│ SiliconFlow Path:                                       │
│ ✓ Provider: OpenAI Compatible                          │
│ ✓ Base URL: https://api.siliconflow.cn                 │
│ ✓ Image Model: black-forest-labs/FLUX.1-schnell        │
│ ✗ MCP Image Generation: Disabled                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ MCP Path:                                               │
│ ✓ Provider: OpenAI Compatible (for text/vision)        │
│ ✓ MCP Image Generation: Enabled                        │
│ ✓ MCP Base URL: https://chat.int.bayer.com/api/v2      │
│ ✓ MCP Model: gpt-4o                                    │
└─────────────────────────────────────────────────────────┘
```

## Error Handling Flow

```
                  API Call
                      │
                      ▼
              ┌───────────────┐
              │ Response OK?  │
              └───┬───────┬───┘
                  │ YES   │ NO
                  ▼       ▼
         ┌────────────┐  ┌──────────────────┐
         │ Parse data │  │ Extract error    │
         └─────┬──────┘  │ status & message │
               │         └────────┬─────────┘
               ▼                  ▼
      ┌─────────────────┐  ┌──────────────────┐
      │ Image data      │  │ Throw error with │
      │ present?        │  │ helpful message  │
      └───┬─────────┬───┘  └────────┬─────────┘
          │ YES     │ NO            │
          ▼         ▼               │
    ┌─────────┐  ┌──────────┐      │
    │ Return  │  │ Throw    │      │
    │ base64  │  │ error    │      │
    └─────────┘  └────┬─────┘      │
                      │             │
                      └──────┬──────┘
                             ▼
                    ┌─────────────────┐
                    │ Display error   │
                    │ to user with    │
                    │ troubleshooting │
                    │ hints           │
                    └─────────────────┘
```

## Component Interaction

```
┌──────────────────────────────────────────────────────────────────┐
│                      ModelManager.tsx                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Tab Navigation                                             │ │
│  │  ● AI Providers    ○ MCP Tools                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ AI Providers Panel ─────────────────────────────────────┐  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ Provider Selection                                 │  │  │
│  │  │  ○ Google AI    ● OpenAI Compatible               │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ OpenAI Compatible Config                          │  │  │
│  │  │  • API Key                                        │  │  │
│  │  │  • Base URL                                       │  │  │
│  │  │  • Text Model / Vision Model / Image Model       │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ MCP Tools Panel ────────────────────────────────────────┐  │
│  │  [+ Add Tool]                                            │  │
│  │  ┌──────────────────────────────────────────────────┐    │  │
│  │  │ Supabase (Database)                              │    │  │
│  │  │  [Toggle] Enable                                 │    │  │
│  │  │  • URL, API Key, Auto-sync                       │    │  │
│  │  └──────────────────────────────────────────────────┘    │  │
│  │  ┌──────────────────────────────────────────────────┐    │  │
│  │  │ Image Generation                                 │    │  │
│  │  │  [Toggle] Enable                                 │    │  │
│  │  │  • Base URL, Model, Custom Config (JSON)         │    │  │
│  │  └──────────────────────────────────────────────────┘    │  │
│  │  ┌──────────────────────────────────────────────────┐    │  │
│  │  │ Custom Tool 1                          [Remove]  │    │  │
│  │  │  { "name": "...", "enabled": true, ... }         │    │  │
│  │  └──────────────────────────────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ Add MCP Tool Popup (when [+ Add Tool] clicked) ────────┐  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ Enter JSON Configuration:                          │  │  │
│  │  │ ┌────────────────────────────────────────────────┐ │  │  │
│  │  │ │ {                                              │ │  │  │
│  │  │ │   "name": "myTool",                           │ │  │  │
│  │  │ │   "enabled": true,                            │ │  │  │
│  │  │ │   "baseUrl": "https://...",                   │ │  │  │
│  │  │ │   "model": "gpt-4o"                           │ │  │  │
│  │  │ │ }                                              │ │  │  │
│  │  │ └────────────────────────────────────────────────┘ │  │  │
│  │  │                          [Cancel]  [Add Tool]      │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [Cancel]  [Save Settings]                                      │
└──────────────────┬───────────────────────────────────────────────┘
                   │ Save Settings
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                        localStorage                              │
│  {                                                               │
│    "provider": "openai",                                        │
│    "openAIBaseUrl": "...",                                      │
│    "openAIImageModel": "...",                                   │
│    "mcpConfig": {                                               │
│      "supabase": { ... },                                       │
│      "imageGeneration": {                                       │
│        "enabled": true/false,                                   │
│        "baseUrl": "...",                                        │
│        "model": "...",                                          │
│        "customConfig": "{...}"                                  │
│      },                                                         │
│      "customTool1": { ... },                                    │
│      "customTool2": { ... }                                     │
│    }                                                            │
│  }                                                               │
└──────────────────┬───────────────────────────────────────────────┘
                   │ Read Settings
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                    lib/llm/openai.ts                             │
│                    generateImage()                               │
└──────────────────────────────────────────────────────────────────┘
```

---

**Legend**:
- `┌─┐` = Component/Function
- `│` = Data flow
- `▼` = Direction
- `○` = Unselected option
- `●` = Selected option
- `✓` = Enabled/Required
- `✗` = Disabled/Not required
