# Hooks 快速参考 🚀

## 📦 已配置的 Hooks

### ✅ Pre-commit (自动格式化 & Linting)

- **触发**: 每次 `git commit`
- **功能**: 自动格式化、lint 修复、类型检查
- **跳过**: `git commit --no-verify`

### 🌐 Post-merge (自动测试)

- **触发**: 每次 `git merge` 或 `git pull`
- **功能**: 安装依赖、构建、浏览器测试、错误报告
- **手动运行**: `npm run test:browser`

## 🎯 常用命令

```bash
# 格式化所有代码
npm run format

# Lint 并自动修复
npm run lint:fix

# 类型检查
npm run lint

# 浏览器自动测试
npm run test:browser

# 启用 Chrome MCP 测试
USE_CHROME_MCP=true npm run test:browser
```

## 🤖 自动错误修复流程

1. **运行测试** (自动或手动):

   ```bash
   npm run test:browser
   ```

2. **如果发现错误**:

   ```
   📝 Error log written to: test-errors.log
   🤖 Claude 修复提示已生成: CLAUDE_FIX_REQUEST.md
   ```

3. **让 Claude 自动修复**:

   ```bash
   cat CLAUDE_FIX_REQUEST.md | cc
   # 或者
   cc "请查看 CLAUDE_FIX_REQUEST.md 并修复所有问题"
   ```

4. **验证修复**:
   ```bash
   npm run test:browser
   ```

## 🔧 Chrome DevTools MCP 设置

### 快速启用

1. 安装 MCP Server:

   ```bash
   npm install -D @modelcontextprotocol/server-chrome-devtools
   ```

2. 启动 Chrome (远程调试):

   ```bash
   # macOS
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

   # 或创建别名
   alias chrome-debug='/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222'
   ```

3. 启用 MCP (编辑 `.claude-mcp.json`):

   ```json
   {
     "mcpServers": {
       "chrome-devtools": {
         "enabled": true
       }
     }
   }
   ```

4. 运行测试:
   ```bash
   USE_CHROME_MCP=true npm run test:browser
   ```

## 📊 测试报告示例

### 成功:

```
✅ All tests passed! No errors found.
```

### 发现问题:

```
⚠️  Tests completed with issues:
   - 2 error(s)
   - 1 warning(s)

使用以下命令让 Claude 修复问题:
   cat CLAUDE_FIX_REQUEST.md | cc
```

## 🎨 配置文件

- `.prettierrc` - Prettier 配置
- `.eslintrc.cjs` - ESLint 配置
- `.lintstagedrc.json` - Lint-staged 配置
- `.claude-mcp.json` - MCP 配置
- `.husky/pre-commit` - Pre-commit hook
- `.husky/post-merge` - Post-merge hook

## 📚 完整文档

查看 `HOOKS_GUIDE.md` 了解详细配置和故障排除。
