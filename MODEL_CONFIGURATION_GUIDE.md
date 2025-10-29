# Model Configuration Guide

## Understanding Different Model Types

Your application uses three different types of AI models for different tasks:

### 1. Text Models
**Purpose**: Text analysis, abstract generation, content processing
**Examples**: 
- OpenAI: `gpt-4o`, `gpt-4-turbo`, `gpt-3.5-turbo`
- SiliconFlow: `Qwen/Qwen2.5-72B-Instruct`, `deepseek-ai/DeepSeek-V2.5`

### 2. Vision Models (VLM - Vision Language Models)
**Purpose**: Analyzing and understanding images, describing visual content
**Examples**:
- OpenAI: `gpt-4o`, `gpt-4-vision-preview`
- SiliconFlow: `Qwen/Qwen2-VL-72B-Instruct`, `OpenGVLab/InternVL2-26B`
- **Note**: `Qwen-Image-Edit` is a VLM, not an image generator!

### 3. Image Generation Models
**Purpose**: Creating new images from text descriptions
**Examples**:
- OpenAI: `dall-e-3`, `dall-e-2`
- SiliconFlow: `stabilityai/stable-diffusion-xl-base-1.0`, `black-forest-labs/FLUX.1-schnell`

## Your Current Issue

You configured `Qwen-Image-Edit` as an **Image Model**, but this is actually a **Vision Model** (VLM). VLMs analyze images, they don't generate them.

## How to Fix

### Option 1: Use SiliconFlow with Proper Models
1. **Vision Model**: `Qwen/Qwen2-VL-72B-Instruct` (for analyzing uploaded images)
2. **Image Model**: `stabilityai/stable-diffusion-xl-base-1.0` (for generating images)

### Option 2: Use OpenAI Models
1. **Vision Model**: `gpt-4o` (for analyzing uploaded images)
2. **Image Model**: `dall-e-3` (for generating images)

### Option 3: Mixed Configuration
1. **Vision Model**: `gpt-4o` (OpenAI for vision analysis)
2. **Image Model**: `stabilityai/stable-diffusion-xl-base-1.0` (SiliconFlow for generation)

## Configuration Steps

1. Open **Settings** → **Model Configuration**
2. Set your models according to one of the options above:
   - **Text Model**: For text processing
   - **Vision Model**: For image analysis (VLM)
   - **Image Model**: For image generation
3. Make sure your API keys and base URLs are correct for each provider

## API Endpoints

Different providers use different endpoints:

### SiliconFlow
- **Base URL**: `https://api.siliconflow.cn/v1`
- **Vision Analysis**: `/chat/completions` (with image input)
- **Image Generation**: `/images/generations` or provider-specific endpoint

### OpenAI
- **Base URL**: `https://api.openai.com/v1`
- **Vision Analysis**: `/chat/completions` (with image input)
- **Image Generation**: `/images/generations`

## Troubleshooting

### Error: "The model is not a VLM"
- You're using a text-only model for vision analysis
- Solution: Configure a proper Vision Model (VLM)

### Error: "No image data received from API"
- You're using a VLM or text model for image generation
- Solution: Configure a proper Image Generation Model

### Error: "Image generation API call failed"
- The provider doesn't support the endpoint or model
- Solution: Check model availability and API documentation

## Recommended Configurations

### For SiliconFlow Users
```
Text Model: Qwen/Qwen2.5-72B-Instruct
Vision Model: Qwen/Qwen2-VL-72B-Instruct
Image Model: stabilityai/stable-diffusion-xl-base-1.0
```

### For OpenAI Users
```
Text Model: gpt-4o
Vision Model: gpt-4o
Image Model: dall-e-3
```

### For Mixed Setup (Recommended for cost optimization)
```
Text Model: gpt-4o (OpenAI)
Vision Model: gpt-4o (OpenAI)
Image Model: stabilityai/stable-diffusion-xl-base-1.0 (SiliconFlow)
```