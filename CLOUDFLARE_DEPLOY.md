# Cloudflare Pages 部署说明

## 在 Cloudflare Dashboard 中配置

### 构建设置

- **Framework preset**: None (或 Vue)
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Root directory**: `/` (留空)

### 环境变量

```
VITE_API_BASE_URL = https://your-us-vercel-backend.example.com
VITE_SUPABASE_URL = https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY = your-public-anon-key
VITE_TURNSTILE_SITE_KEY = your-public-turnstile-site-key
```

### 重要提示

**不要设置 Deploy command**，Cloudflare Pages 会自动部署 `dist` 目录的静态文件。

模型、Supabase service role、Turnstile 与 Stripe 的私钥只配置在 Vercel 后端，绝不能放入 `VITE_*`。Vercel Functions 固定在 `iad1`，但仍须遵守各模型供应商的可用地区与服务条款。

## 使用 Wrangler CLI 部署 (可选)

```bash
# 安装 wrangler
npm install -g wrangler

# 登录
wrangler login

# 构建
npm run build

# 部署到 Pages
wrangler pages deploy dist --project-name=sci-necromancer
```

## SPA 路由支持

`public/_redirects` 文件已配置，确保所有路由都指向 `index.html`。
