# Troubleshooting Guide

## API Key Validation Issues

### OpenAI-Compatible APIs Not Validating

**Problem**: API keys for OpenRouter, SiliconFlow, or other providers fail validation.

**Solution**:
1. Make sure you've entered the correct **Base URL** for your provider:
   - OpenAI: `https://api.openai.com/v1`
   - OpenRouter: `https://openrouter.ai/api/v1`
   - SiliconFlow: `https://api.siliconflow.cn/v1`
   - Azure OpenAI: `https://YOUR-RESOURCE.openai.azure.com/openai/deployments/YOUR-DEPLOYMENT`

2. Verify your API key format:
   - OpenAI: starts with `sk-`
   - OpenRouter: starts with `sk-or-v1-`
   - SiliconFlow: custom format
   - Azure: custom format

3. Check that your API key has the correct permissions

4. If validation fails but you're sure the key is correct, try using it anyway - some providers may have validation issues but work fine for actual requests

### Google AI Rate Limits

**Problem**: "You exceeded your current quota" or "The model is overloaded"

**Solutions**:
1. **Wait a few minutes** - Free tier has rate limits (2 requests per minute for some models)
2. **Use gemini-1.5-flash** instead of gemini-2.5-pro (already configured by default)
3. **Upgrade to paid tier** at https://ai.google.dev/pricing
4. **Switch to OpenAI-compatible provider** as fallback

### 401 Unauthorized Errors

**Problem**: "Incorrect API key provided" or "401 Unauthorized"

**Solutions**:
1. Double-check your API key is copied correctly (no extra spaces)
2. Verify the API key is active and not expired
3. Check your account has credits/quota remaining
4. For OpenRouter: Make sure you've added credits to your account
5. For SiliconFlow: Verify your account is activated

## Model Configuration Issues

### Model Not Found (404)

**Problem**: "Model not found" or "404 error"

**Solutions**:
1. Check the model name is correct for your provider:
   
   **OpenAI**:
   - Text: `gpt-4o`, `gpt-4-turbo`, `gpt-3.5-turbo`
   - Vision: `gpt-4o`, `gpt-4-turbo`
   
   **OpenRouter**:
   - Format: `provider/model-name`
   - Examples: `anthropic/claude-3-opus`, `google/gemini-pro`, `meta-llama/llama-3-70b`
   - See full list: https://openrouter.ai/models
   
   **SiliconFlow**:
   - Format: `organization/model-name`
   - Examples: `Qwen/Qwen2.5-72B-Instruct`, `deepseek-ai/DeepSeek-V2.5`
   - See full list: https://siliconflow.cn/models
   
   **Azure OpenAI**:
   - Use your deployment name (not the model name)
   - Example: `my-gpt4-deployment`

2. Verify your account has access to the model
3. Some models require special access or approval

### Model Test Fails

**Problem**: "Test Model Access" button shows models as unavailable

**Solutions**:
1. This is normal if you haven't used the models yet
2. Try generating an abstract - it may work even if the test fails
3. Check your account has sufficient credits
4. Verify the model names are correct for your provider

## File Upload Issues

### PDF Not Processing

**Problem**: "Failed to extract text from PDF"

**Solutions**:
1. Ensure PDF contains actual text (not scanned images)
2. Check PDF is not password-protected
3. Try a different PDF file
4. Use "Copy & Paste" as alternative

### DOCX Not Processing

**Problem**: "Failed to extract text from DOCX"

**Solutions**:
1. Ensure file is a valid DOCX format (not DOC)
2. Try opening and re-saving in Microsoft Word or Google Docs
3. Check file is not corrupted
4. Use "Copy & Paste" as alternative

## Generation Errors

### "An unknown error occurred during analysis"

**Possible Causes & Solutions**:

1. **Rate Limits**:
   - Wait a few minutes and try again
   - Switch to a different provider
   - Upgrade to paid tier

2. **Invalid API Configuration**:
   - Re-validate your API keys
   - Check Base URL is correct
   - Verify model names

3. **Network Issues**:
   - Check your internet connection
   - Try refreshing the page
   - Check if the API provider is experiencing outages

4. **Input Too Long**:
   - Reduce the input text length
   - Summarize your content before submitting

### Both Providers Failed

**Problem**: "Both providers failed for Content Analysis"

**Solutions**:
1. Check both API keys are valid
2. Verify you have credits/quota on at least one provider
3. Check network connectivity
4. Try again in a few minutes (may be temporary rate limits)
5. Check browser console for specific error messages

## Provider-Specific Tips

### OpenRouter
- Requires credits to be added to account (even for free models)
- Model format: `provider/model-name`
- Check balance: https://openrouter.ai/credits
- Some models have minimum credit requirements

### SiliconFlow
- Free tier available with generous limits
- Good for Chinese users (faster access)
- Supports many open-source models
- Model format: `organization/model-name`

### Azure OpenAI
- Base URL format: `https://YOUR-RESOURCE.openai.azure.com/openai/deployments/YOUR-DEPLOYMENT`
- Use deployment name, not model name
- Requires Azure subscription
- Different authentication method (may need additional configuration)

### Google AI (Gemini)
- Free tier: 15 requests per minute for gemini-1.5-flash
- Free tier: 2 requests per minute for gemini-2.5-pro
- Paid tier: Much higher limits
- Best for: Quick testing and development

## Browser Console Errors

### How to Check Console

1. Open browser developer tools:
   - Chrome/Edge: Press F12 or Ctrl+Shift+I (Cmd+Option+I on Mac)
   - Firefox: Press F12 or Ctrl+Shift+K (Cmd+Option+K on Mac)
   - Safari: Enable Developer menu in Preferences, then press Cmd+Option+C

2. Click on "Console" tab

3. Look for red error messages

4. Copy error messages for troubleshooting

### Common Console Errors

**"Failed to load resource: 401"**
- Invalid API key
- Check API key configuration

**"Failed to load resource: 429"**
- Rate limit exceeded
- Wait and try again

**"Failed to load resource: 503"**
- Service temporarily unavailable
- Try again later

**"CORS error"**
- API provider doesn't support browser requests
- This shouldn't happen with properly configured providers

## Still Having Issues?

1. **Clear browser cache and reload**
2. **Try a different browser**
3. **Check API provider status pages**:
   - OpenAI: https://status.openai.com
   - OpenRouter: https://status.openrouter.ai
   - Google AI: https://status.cloud.google.com

4. **Verify account status** on provider websites
5. **Check browser console** for specific error messages
6. **Try with minimal input** to isolate the issue

## Best Practices

1. **Start with Google AI** for testing (free tier)
2. **Configure OpenAI-compatible provider** as backup
3. **Keep API keys secure** - don't share them
4. **Monitor usage** on provider dashboards
5. **Set up billing alerts** if using paid tiers
6. **Test with small inputs first** before processing large documents
7. **Save your work frequently** using the Save Abstract feature
