# Claude + Husky Hooks 完整指南 🚀

## 🎯 工作流程概述

本项目实现了一个**两阶段验证系统**：

```
git commit
    ↓
┌─────────────────────────────────────────┐
│  阶段 1: Claude Hook (自动修复)         │
│  ✓ 检测错误                             │
│  ✓ 自动调用 Claude 修复                 │
│  ✓ 重新测试                             │
│  ✓ 最多尝试 3 次                        │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  阶段 2: Husky Hook (最终验证)          │
│  ✓ 严格代码检查                         │
│  ✓ 格式验证                             │
│  ✓ 类型检查                             │
│  ✓ 阻止不合规提交                       │
└─────────────────────────────────────────┘
    ↓
  ✅ 提交成功
```

## 📋 两个 Hook 的详细说明

### 1️⃣ Claude Pre-commit Hook (.claude/hooks/pre-commit.sh)

**职责**: 自动检测和修复错误

**运行时机**: 在 Husky hook 之前

**功能**:

1. **快速测试** (1-2秒)
   - TypeScript 类型检查
   - ESLint 代码检查

2. **错误收集** (如果发现错误)
   - 收集所有 TypeScript 错误
   - 收集所有 ESLint 错误
   - 生成详细错误报告

3. **自动修复** (最多3次尝试)
   - 生成 Claude 修复请求
   - 调用 `cc` CLI 让 Claude 修复
   - 自动 stage 修复后的文件
   - 重新测试验证修复

4. **失败处理**
   - 如果 3 次都失败，阻止提交
   - 保存错误报告供手动修复

### 2️⃣ Husky Pre-commit Hook (.husky/pre-commit)

**职责**: 最终严格验证，阻止不合规提交

**运行时机**: 在 Claude hook 之后

**6 项严格检查**:

1. **Lint-staged** - 格式化 staged 文件
2. **TypeScript** - 严格类型检查 (0 errors)
3. **ESLint** - 严格 lint 检查 (0 warnings)
4. **TODO/FIXME** - 检测未解决的 TODO (警告)
5. **Console.log** - 检测 console 语句 (警告)
6. **文件大小** - 阻止大文件 (>5MB)

**特点**:

- ❌ **零容忍**: 任何错误都会阻止提交
- 🚫 **严格模式**: 不允许任何警告
- 📏 **代码规范**: 强制执行格式和风格

## 🎮 使用方法

### 基本使用 (完全自动)

```bash
# 1. 修改代码
vim src/components/MyComponent.vue

# 2. 添加到 staging
git add .

# 3. 尝试提交
git commit -m "feat: add new feature"

# ✨ 自动执行:
#    → Claude hook 检测错误
#    → Claude 自动修复错误
#    → Husky hook 验证修复
#    → 提交成功
```

### 详细提交流程

```bash
git commit -m "feat: new feature"

# 输出示例:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 Claude Pre-commit Hook - Automated Testing & Fixing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Step 1/5: Running quick tests...
  → TypeScript type check...
  ⚠️  TypeScript type errors found
  → ESLint check...
  ⚠️  ESLint errors found

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  Errors detected, attempting automatic fix...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Step 2/5: Collecting error details...
  → Collecting TypeScript errors...
  → Collecting ESLint errors...
  ✓ Error details collected

🤖 Step 3/5: Generating Claude fix request...
  ✓ Fix request generated: .claude/fix-report.md

🔧 Step 4/5: Attempting automatic fix with Claude...
  → Fix attempt 1/3
  → Invoking Claude Code to fix errors...

  [Claude 分析并修复错误...]

  → Re-testing after Claude fix...
  ✓ All errors fixed by Claude!
  ✓ Fixed files staged

✅ Step 5/5: Final verification...
  → Running final TypeScript check...
  → Running final ESLint check...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Claude Pre-commit Hook: ALL CHECKS PASSED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏱️  Time: 15s

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚪 Husky Pre-commit Hook - Final Validation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Claude hook passed, continuing with Husky validation...

🔍 Running final strict validation...

📝 1/6: Format and lint staged files...
✓ Lint-staged passed

🔎 2/6: TypeScript strict type check...
✓ TypeScript check passed

🎯 3/6: ESLint strict check (no warnings)...
✓ ESLint check passed

📌 4/6: Checking for unresolved TODOs...

🚫 5/6: Checking for console.log statements...

📦 6/6: Checking file sizes...
✓ No large files

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ ALL VALIDATION PASSED - COMMIT ALLOWED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your code meets all quality standards:
  ✓ Code formatted properly
  ✓ No linting errors
  ✓ No type errors
  ✓ No large files

Proceeding with commit...

[main abc1234] feat: new feature
 2 files changed, 50 insertions(+), 10 deletions(-)
```

## ⚙️ 配置选项

### 禁用 Claude Hook (仅使用 Husky)

```bash
# 临时禁用
CLAUDE_HOOK_ENABLED=false git commit -m "message"

# 或在 .claude/hooks/config.json 中永久禁用
{
  "hooks": {
    "pre-commit": {
      "enabled": false
    }
  }
}
```

### 跳过所有 Hooks (紧急情况)

```bash
# 跳过所有 pre-commit hooks
git commit --no-verify -m "emergency fix"

# ⚠️  警告: 仅在紧急情况下使用!
```

### 调整 Claude 自动修复尝试次数

编辑 `.claude/hooks/pre-commit.sh`:

```bash
MAX_AUTO_FIX_ATTEMPTS=5  # 默认是 3
```

### 调整 Husky 严格程度

编辑 `.husky/pre-commit`:

```bash
# 允许警告 (不推荐)
# 注释掉这行:
# npx eslint --quiet --max-warnings 0 ...

# 改为:
npx eslint --quiet --max-warnings 10 ...
```

## 🧪 测试 Hook 系统

### 运行完整测试

```bash
npm run test:hooks
# 或
./scripts/test-hooks.sh
```

### 手动测试 Claude Hook

```bash
./.claude/hooks/pre-commit.sh
```

### 手动测试 Husky Hook

```bash
./.husky/pre-commit
```

## 🔧 故障排除

### Claude Hook 失败: "cc command not found"

**问题**: Claude Code CLI 未安装

**解决方案**:

```bash
# 安装 Claude Code CLI
# 访问: https://claude.com/claude-code

# 或临时禁用 Claude hook
CLAUDE_HOOK_ENABLED=false git commit -m "message"
```

### Husky Hook 阻止提交

**问题**: 代码不符合规范

**解决方案**:

```bash
# 1. 查看具体错误
git commit -v

# 2. 手动修复
npm run format        # 格式化
npm run lint:fix     # 修复 lint
npm run lint         # 类型检查

# 3. 再次提交
git commit -m "message"
```

### Claude 修复失败 (3次尝试后)

**问题**: 错误太复杂，Claude 无法自动修复

**解决方案**:

```bash
# 1. 查看错误报告
cat .claude/fix-report.md

# 2. 手动修复错误

# 3. 重新提交
git add .
git commit -m "message"
```

### TypeScript 错误无法修复

**问题**: 类型错误很复杂

**解决方案**:

```bash
# 查看详细类型错误
npm run lint

# 逐个修复
# - 添加类型注解
# - 修复类型不匹配
# - 更新接口定义
```

## 📊 Hook 性能

| 场景             | Claude Hook | Husky Hook | 总计 |
| ---------------- | ----------- | ---------- | ---- |
| 无错误           | ~2s         | ~3s        | ~5s  |
| 有错误(自动修复) | ~15s        | ~3s        | ~18s |
| 有错误(修复失败) | ~30s        | N/A        | Exit |

## 🎯 最佳实践

### ✅ 推荐做法

1. **频繁小提交**: 让 hooks 快速运行

   ```bash
   git add src/component.vue
   git commit -m "feat: update component"
   ```

2. **利用自动修复**: 信任 Claude 的修复

   ```bash
   # 直接提交，让 Claude 修复
   git commit -m "feat: new feature"
   ```

3. **定期格式化**: 减少 hook 运行时间

   ```bash
   npm run format
   npm run lint:fix
   ```

4. **测试后再提交**: 确保代码可运行
   ```bash
   npm run test
   git add .
   git commit -m "feat: ..."
   ```

### ❌ 避免做法

1. ❌ 频繁使用 `--no-verify`
2. ❌ 提交大量未测试代码
3. ❌ 忽略 Claude 的修复建议
4. ❌ 禁用所有验证

## 🔄 Hook 更新

### 更新 Claude Hook

```bash
# 编辑
vim .claude/hooks/pre-commit.sh

# 测试
./.claude/hooks/pre-commit.sh
```

### 更新 Husky Hook

```bash
# 编辑
vim .husky/pre-commit

# 测试
./.husky/pre-commit
```

## 📚 相关文件

```
项目根目录/
├── .claude/
│   ├── hooks/
│   │   ├── pre-commit.sh      # Claude 自动修复 hook
│   │   └── config.json        # Claude hook 配置
│   ├── fix-report.md          # 错误报告 (自动生成)
│   └── test-errors.json       # 错误详情 (自动生成)
├── .husky/
│   ├── pre-commit             # Husky 验证 hook
│   └── post-merge             # Post-merge hook
├── scripts/
│   ├── test-hooks.sh          # Hook 测试脚本
│   └── auto-test-browser.mjs  # 浏览器自动测试
├── .prettierrc                # Prettier 配置
├── .eslintrc.cjs              # ESLint 配置
└── .lintstagedrc.json         # Lint-staged 配置
```

## 🎉 总结

现在你拥有一个**完全自动化的代码质量保证系统**:

1. ✅ **Claude Hook** - 自动检测和修复错误
2. ✅ **Husky Hook** - 严格验证，阻止不合规提交
3. ✅ **零人工干预** - 大部分情况下完全自动
4. ✅ **高质量代码** - 强制执行最佳实践

**提交代码从未如此简单和可靠! 🚀**

---

需要帮助? 运行:

```bash
npm run test:hooks
./scripts/test-hooks.sh
```
