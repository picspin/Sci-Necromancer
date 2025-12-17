# Claude + Husky Hooks 快速参考 ⚡

## 🔄 工作流程

```bash
git commit -m "message"
      ↓
🤖 Claude Hook → 自动检测 & 修复错误 (最多3次)
      ↓
🚪 Husky Hook → 严格验证 & 阻止不合规提交
      ↓
    ✅ 提交成功
```

## 📋 两个 Hook

### 1️⃣ Claude Hook (.claude/hooks/pre-commit.sh)

- **检测**: TypeScript + ESLint 错误
- **修复**: 自动调用 Claude 修复
- **重试**: 最多 3 次
- **失败**: 生成报告，阻止提交

### 2️⃣ Husky Hook (.husky/pre-commit)

- **格式化**: Lint-staged
- **类型检查**: TypeScript (0 errors)
- **代码检查**: ESLint (0 warnings)
- **大小检查**: 阻止大文件 (>5MB)
- **其他**: TODO/console.log 警告

## 🎮 常用命令

```bash
# 正常提交 (自动修复)
git commit -m "feat: new feature"

# 测试 hooks
npm run test:hooks

# 手动格式化
npm run format

# 手动 lint 修复
npm run lint:fix

# 跳过 Claude hook (使用 Husky only)
CLAUDE_HOOK_ENABLED=false git commit -m "message"

# 紧急跳过所有 hooks
git commit --no-verify -m "emergency"
```

## ⚙️ 配置

### 启用/禁用 Claude Hook

```bash
# 临时禁用
CLAUDE_HOOK_ENABLED=false git commit

# 永久禁用 - 编辑 .claude/hooks/config.json
{
  "hooks": {
    "pre-commit": {
      "enabled": false
    }
  }
}
```

### 调整自动修复次数

编辑 `.claude/hooks/pre-commit.sh`:

```bash
MAX_AUTO_FIX_ATTEMPTS=5  # 默认 3
```

## 🔧 故障排除

### "cc command not found"

```bash
# 安装 Claude Code CLI
# https://claude.com/claude-code

# 或临时禁用
CLAUDE_HOOK_ENABLED=false git commit
```

### Hook 阻止提交

```bash
# 查看错误
git commit -v

# 手动修复
npm run format
npm run lint:fix
npm run lint

# 重试
git commit
```

### Claude 修复失败

```bash
# 查看报告
cat .claude/fix-report.md

# 手动修复后重试
git add .
git commit
```

## 📊 性能

| 场景         | 时间 |
| ------------ | ---- |
| 无错误       | ~5s  |
| 自动修复成功 | ~18s |
| 修复失败     | Exit |

## ✅ 最佳实践

1. ✅ 频繁小提交
2. ✅ 信任 Claude 修复
3. ✅ 定期运行 `npm run format`
4. ✅ 提交前测试代码

## ❌ 避免

1. ❌ 频繁 `--no-verify`
2. ❌ 大量未测试代码
3. ❌ 忽略修复建议
4. ❌ 禁用所有验证

## 📚 完整文档

查看 `CLAUDE_HOOKS_GUIDE.md` 了解详细配置。

## 🎉 现在你拥有

- ✅ 自动错误检测
- ✅ 自动 Claude 修复
- ✅ 严格代码验证
- ✅ 零不合规提交

**享受完全自动化的代码质量保证! 🚀**
