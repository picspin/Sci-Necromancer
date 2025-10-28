# 配置指南 / Configuration Guide

## API配置 / API Configuration

### Google AI

1. 获取API密钥 / Get API Key:
   - 访问 [Google AI Studio](https://aistudio.google.com/app/apikey)
   - 创建新的API密钥
   - 复制密钥（格式：AIza...）

2. 配置 / Configuration:
   - 点击设置按钮 ⚙️
   - 选择 "Google AI" 作为提供商
   - 粘贴API密钥
   - 点击 "Validate Key" 验证
   - 点击 "Save Settings" 保存

### OpenAI 兼容API / OpenAI-Compatible API

支持以下提供商 / Supported Providers:

#### 1. OpenAI 官方 / Official OpenAI
- Base URL: `https://api.openai.com/v1`
- API Key: `sk-...`
- 获取密钥: https://platform.openai.com/api-keys

#### 2. OpenRouter
- Base URL: `https://openrouter.ai/api/v1`
- API Key: 从 https://openrouter.ai/keys 获取
- 支持多种模型，按使用付费

#### 3. SiliconFlow (硅基流动)
- Base URL: `https://api.siliconflow.cn/v1`
- API Key: 从 https://siliconflow.cn 获取
- 国内访问友好，支持多种开源模型

#### 4. 其他兼容提供商 / Other Compatible Providers
任何支持OpenAI API格式的提供商都可以使用。

### 配置步骤 / Configuration Steps

1. 点击设置按钮 ⚙️
2. 选择 "OpenAI" 作为提供商
3. 输入Base URL（根据您选择的提供商）
4. 输入API密钥
5. 配置模型名称：
   - Text Model: 例如 `gpt-4o`, `claude-3-opus`, `qwen-plus` 等
   - Vision Model: 例如 `gpt-4o`, `claude-3-opus` 等
6. 点击 "Validate Key" 验证连接
7. 点击 "Test Model Access" 测试模型可用性
8. 点击 "Save Settings" 保存配置

## 文件上传 / File Upload

### 支持的格式 / Supported Formats

- **PDF**: 使用PDF.js提取文本
- **DOCX**: 使用Mammoth提取文本
- **TXT**: 直接读取文本

### 使用方法 / Usage

1. 点击 "Choose File" 按钮
2. 选择PDF、DOCX或TXT文件
3. 系统会自动提取文本内容
4. 提取的文本会显示在文本框中

### 注意事项 / Notes

- PDF文件必须包含可提取的文本（非扫描图片）
- 加密的PDF文件无法处理
- DOCX文件应为标准格式
- 大文件可能需要较长处理时间

## 数据库配置（可选）/ Database Configuration (Optional)

如果需要保存摘要，可以配置Supabase数据库：

1. 在 [Supabase](https://supabase.com) 创建项目
2. 获取项目URL和API密钥
3. 在设置中配置数据库URL
4. 保存设置

## 常见问题 / FAQ

### Q: API密钥验证失败？
A: 
- 检查密钥是否正确复制
- 确认Base URL是否正确
- 检查网络连接
- 对于OpenAI官方API，确保密钥以`sk-`开头

### Q: 模型测试失败？
A:
- 确认API密钥有效
- 检查模型名称是否正确
- 确认账户有足够的配额
- 某些提供商可能不支持所有模型

### Q: PDF文件无法处理？
A:
- 确认PDF包含文本（非扫描图片）
- 检查PDF是否加密
- 尝试使用其他PDF文件测试
- 查看浏览器控制台的详细错误信息

### Q: 如何切换提供商？
A:
- 打开设置
- 选择不同的提供商
- 配置相应的API密钥
- 保存设置
- 刷新页面（如需要）

## 推荐配置 / Recommended Configuration

### 开发/测试 / Development/Testing
- Provider: Google AI
- 原因: 免费配额，易于获取API密钥

### 生产环境 / Production
- Provider: OpenAI-Compatible API
- Base URL: 根据需求选择（OpenRouter、SiliconFlow等）
- 原因: 更稳定，更多模型选择，更好的性能

## 安全提示 / Security Tips

1. **不要分享API密钥** / Never share your API keys
2. **定期轮换密钥** / Rotate keys regularly
3. **监控使用情况** / Monitor usage
4. **设置使用限制** / Set usage limits
5. **使用环境变量**（生产环境）/ Use environment variables (production)
