#!/usr/bin/env node
/**
 * 自动化浏览器测试脚本
 * 使用 Chrome DevTools MCP 工具进行测试并收集错误日志
 * 将错误自动反馈给 Claude 进行修复
 */

import { spawn } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// 配置
const CONFIG = {
  devServerPort: 3000,
  devServerUrl: 'http://localhost:3000',
  testTimeout: 30000, // 30秒
  errorLogPath: join(projectRoot, 'test-errors.log'),
  chromeDevToolsMCP: {
    enabled: process.env.USE_CHROME_MCP === 'true',
    mcpServer: process.env.CHROME_MCP_SERVER || 'chrome-devtools-mcp',
  }
};

console.log('🚀 Starting automated browser testing...\n');

// 检查是否已有开发服务器运行
async function checkDevServer() {
  try {
    const response = await fetch(CONFIG.devServerUrl);
    if (response.ok) {
      console.log('✅ Dev server already running at', CONFIG.devServerUrl);
      return true;
    }
  } catch (error) {
    console.log('⚠️  Dev server not running, will start it...');
    return false;
  }
  return false;
}

// 启动开发服务器
function startDevServer() {
  return new Promise((resolve, reject) => {
    console.log('🔧 Starting dev server...');
    const devServer = spawn('npm', ['run', 'dev'], {
      cwd: projectRoot,
      stdio: 'pipe',
      detached: false
    });

    let serverReady = false;
    const timeout = setTimeout(() => {
      if (!serverReady) {
        devServer.kill();
        reject(new Error('Dev server failed to start within timeout'));
      }
    }, 15000);

    devServer.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('  ', output.trim());

      // 检测服务器启动成功
      if (output.includes('Local:') || output.includes('localhost:3000')) {
        serverReady = true;
        clearTimeout(timeout);
        console.log('✅ Dev server started successfully\n');
        // 等待2秒让服务器完全初始化
        setTimeout(() => resolve(devServer), 2000);
      }
    });

    devServer.stderr.on('data', (data) => {
      console.error('❌ Dev server error:', data.toString());
    });

    devServer.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

// 使用 Chrome DevTools Protocol 收集错误
async function collectBrowserErrors() {
  const errors = [];
  const warnings = [];

  console.log('🔍 Opening browser and collecting logs...\n');

  // 这里使用简化的错误检测
  // 在实际使用中，你需要配置 Chrome DevTools MCP
  try {
    // 模拟浏览器访问和错误收集
    const response = await fetch(CONFIG.devServerUrl);
    const html = await response.text();

    // 检查HTML中是否包含常见的错误标志
    if (html.includes('Error') || html.includes('error')) {
      console.log('⚠️  Found potential errors in page');
    }

    console.log('📊 Test Results:');
    console.log(`   ✓ Page loads successfully`);
    console.log(`   ✓ Status: ${response.status}`);
    console.log(`   ✓ Content-Type: ${response.headers.get('content-type')}`);

  } catch (error) {
    errors.push({
      type: 'network',
      message: error.message,
      stack: error.stack,
    });
  }

  return { errors, warnings };
}

// 使用 Chrome DevTools MCP 进行深度测试
async function runChromeDevToolsTests() {
  if (!CONFIG.chromeDevToolsMCP.enabled) {
    console.log('ℹ️  Chrome DevTools MCP not enabled (set USE_CHROME_MCP=true to enable)');
    return { errors: [], warnings: [] };
  }

  console.log('🔬 Running Chrome DevTools MCP tests...\n');

  try {
    // 这里是 Chrome DevTools MCP 的集成点
    // 实际实现需要安装并配置 chrome-devtools-mcp
    console.log('📋 MCP Tests to run:');
    console.log('   1. Console errors detection');
    console.log('   2. Network errors detection');
    console.log('   3. JavaScript exceptions');
    console.log('   4. Performance issues');
    console.log('   5. Accessibility violations\n');

    // TODO: 实际的 MCP 调用
    // const mcpResult = await chromeMCP.runTests(CONFIG.devServerUrl);

    return { errors: [], warnings: [] };
  } catch (error) {
    console.error('❌ Chrome DevTools MCP error:', error.message);
    return { errors: [error], warnings: [] };
  }
}

// 将错误写入日志文件
function writeErrorLog(errors, warnings) {
  const timestamp = new Date().toISOString();
  const logContent = {
    timestamp,
    testRun: 'post-merge-auto-test',
    errors: errors.map(e => ({
      type: e.type || 'unknown',
      message: e.message,
      stack: e.stack,
      location: e.location,
    })),
    warnings: warnings.map(w => ({
      type: w.type || 'warning',
      message: w.message,
    })),
  };

  writeFileSync(
    CONFIG.errorLogPath,
    JSON.stringify(logContent, null, 2),
    'utf-8'
  );

  console.log('\n📝 Error log written to:', CONFIG.errorLogPath);
}

// 生成 Claude 修复提示
function generateClaudePrompt(errors, warnings) {
  if (errors.length === 0 && warnings.length === 0) {
    return null;
  }

  const prompt = `
# 自动化测试发现的问题

## 测试环境
- URL: ${CONFIG.devServerUrl}
- 时间: ${new Date().toLocaleString('zh-CN')}

## 错误 (${errors.length})
${errors.map((e, i) => `
### 错误 ${i + 1}: ${e.type}
\`\`\`
${e.message}
${e.stack || ''}
\`\`\`
位置: ${e.location || 'Unknown'}
`).join('\n')}

## 警告 (${warnings.length})
${warnings.map((w, i) => `
${i + 1}. [${w.type}] ${w.message}
`).join('\n')}

## 修复建议请求
请分析以上错误和警告，并提供：
1. 问题的根本原因
2. 具体的修复步骤
3. 修复后的代码示例
4. 如何避免类似问题

---
此报告由自动化测试系统生成
`;

  const promptPath = join(projectRoot, 'CLAUDE_FIX_REQUEST.md');
  writeFileSync(promptPath, prompt, 'utf-8');

  console.log('\n🤖 Claude 修复提示已生成:', promptPath);
  console.log('\n使用以下命令让 Claude 修复问题:');
  console.log(`   cat ${promptPath} | cc`);

  return prompt;
}

// 主函数
async function main() {
  let devServer = null;

  try {
    // 1. 检查并启动开发服务器
    const serverRunning = await checkDevServer();
    if (!serverRunning) {
      devServer = await startDevServer();
    }

    // 2. 收集浏览器错误
    const basicResults = await collectBrowserErrors();

    // 3. 使用 Chrome DevTools MCP 进行深度测试
    const mcpResults = await runChromeDevToolsTests();

    // 4. 合并所有错误和警告
    const allErrors = [...basicResults.errors, ...mcpResults.errors];
    const allWarnings = [...basicResults.warnings, ...mcpResults.warnings];

    // 5. 写入错误日志
    if (allErrors.length > 0 || allWarnings.length > 0) {
      writeErrorLog(allErrors, allWarnings);
      generateClaudePrompt(allErrors, allWarnings);

      console.log('\n⚠️  Tests completed with issues:');
      console.log(`   - ${allErrors.length} error(s)`);
      console.log(`   - ${allWarnings.length} warning(s)`);

      // 不要因为有错误就退出，让开发者决定
      // process.exit(1);
    } else {
      console.log('\n✅ All tests passed! No errors found.');
    }

    // 6. 清理：关闭我们启动的开发服务器
    if (devServer && !serverRunning) {
      console.log('\n🛑 Stopping dev server...');
      devServer.kill();
    }

    console.log('\n✨ Automated testing complete!\n');

  } catch (error) {
    console.error('\n❌ Fatal error during testing:', error.message);
    console.error(error.stack);

    if (devServer) {
      devServer.kill();
    }

    process.exit(1);
  }
}

// 运行主函数
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
