# Cloudflare Pages 部署说明

## 在 Cloudflare Dashboard 中配置

### 构建设置

- **Framework preset**: None (或 Vue)
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Root directory**: `/` (留空)

### 环境变量

```
VITE_API_BASE_URL = https://your-vercel-backend.vercel.app
VITE_NANOBANA_API_KEY = your-api-key (可选，如果前端直接调用)
```

### 重要提示

**不要设置 Deploy command**，Cloudflare Pages 会自动部署 `dist` 目录的静态文件。

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
