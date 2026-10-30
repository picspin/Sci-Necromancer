# 浏览器数据图工作区集成验证

这是实际工作区组件与实际同源Pyodide Worker的开发验证入口，不是新的生产登录入口。它不在Vite生产HTML输入中，不部署开发服务器。会员生产版本/结算/官方免费无水印导出尚未接通，不能拿harness的`canRender=true`冒充服务端权限。

## 复现

在根目录执行`npm ci`，然后`npm run dev -- --host 127.0.0.1 --port 4319 --strictPort --open false`。`predev`会准备固定Pyodide资源；首次构建机需联网下载锁定绘图包，随后校验本地缓存。浏览器打开`http://127.0.0.1:4319/services/figure_worker/browser_workspace/index.html`，点击合成案例、检查CSV、明确字段/单位、确认冻结方案，再渲染。

若验证站内真实入口，开发启动前设`VITE_BROWSER_DATA_FIGURES_ENABLED=true`，并使用有余额的测试会员；生产构建硬性关闭该入口。不要使用真实患者数据、模型密钥或生产会话测试harness。

使用Playwright MCP的run-code工具加载`services/figure_worker/browser_workspace/interaction-check.js`，可重复执行完整组件交互、11类基础模板与负例。该文件提供函数定义供工具加载，不是Node CLI脚本。页面动作均为本地合成输入，不调用会员/模型API；最后读取DOM及网络/控制台观察。机器可读结果为[last-run.json](./last-run.json)。

## 实验（2026-10-29）

- 假设：现有可信模板可经实际工作区复用，无需任意Python执行或服务器作图；取消/出错不能留存“成功”旧图。
- 配置：固定合成值与显式统计选项，随机性none；Chrome156，浏览器报告MacIntel、10逻辑处理器、deviceMemory16GiB（不是硬件鉴定）；390px视口及桌面截图。CPython回归基线仍为项目uv.lock，浏览器并不使用该锁安装依赖。
- 实际运行时：Pyodide314.0.7、Python3.14.2、Matplotlib3.10.8、NumPy2.4.6、Pillow12.2.0；WASM包锁SHA256 `5dc2fc119108bc148c7457dc86e7675b5c87e1cafd420b9c34c1eaef7b36c010`。构建脚本和Worker使用同一固定配置；绘图包下载按锁内SHA256校验。
- 结果：11类基础模板各一个合成案例通过，风格轮换覆盖Standard/Cell/Nature/NEJM/Lancet，不是全部组合测试。真实PNG均4204×2362、599.9988DPI，178×100mm、600DPI重绘配置；不是低清放大或仅改DPI标签。Worker还生成PDF/SVG及其哈希，但不把原图传回组件。
- 结果：取消→重新检查通过；变更风格清除确认和旧图；夹带`python`字段被严格边界拒绝，移除后重试成功；未授权原图按钮禁用。最后390px内容宽度390，无横向溢出；完成轮控制台0错误、观察到的第三方运行时/会员API请求0。早期harness favicon404已修正。
- 标记：可信Python测试读取PNG像素验证缩小预览的隐密`sci-necromancer`标记，原图不含该标记；浏览器报告预览hash和标记版本。这不是稳健水印、会员身份或图片真实性证明，接受客户端绕过。
- 结论：本地执行层与组件已真实接通，而不是独立合成探针或mock渲染；不能由此推论会员钱包、免费导出授权、自然语言规划或所有研究输入已验收。未验证中文字体、三网无代理、真实低内存设备、全部组合/变体或离线运行，也没有性能提升/准确率结论。

独立发布worktree回归：99个JS/TS测试文件、599项测试通过；Python120项通过（41.711秒）；`npm run lint`、`npm run build`、`npm run figures:check`通过。此前根工作区614/133的记录包含未纳入本PR的ISMRM、容器/探针改动，不能混作独立PR测试数。生产dist含17个锁定核心/包文件及manifest共18个运行时资产，不包含开发harness HTML。构建保留原有混合导入/大chunk警告。

## 审核修复与补充验证

独立审核提出的两条P2已修复：构建/浏览器均逐项校验4个核心运行时及锁摘要；模拟核心WASM损坏时拒绝初始化，恢复后重试成功。这只能发现资源混用/损坏，不是应用本身被攻破时的独立认证边界。新增2/3/4面板在实际物理尺寸执行布局preflight，按254mm宽保留16:(5.5×行数)比例；实测6000×2062及6000×4125、599.9988DPI，均小于4000万像素。单图仍178×100mm。截图发现的图例/左标题重叠另经RED→GREEN回归修复；不合格布局明确拒绝。以上已在真实Pyodide Worker运行，详见更新后的last-run.json。

## 部署与安全

Supabase无需迁移；Vercel无需部署；未来若发布这些前端代码/静态资源，Cloudflare Worker需重新build/deploy，本切片只提交/推送/PR、不执行部署。生产仍关闭，不需要也不允许通过部署harness开通功能。无新增云套餐或服务密钥；数据图下载额外收费没有被重新引入。

依赖审计仍有既有12个high、1个critical（Vue/i18n、DOMPurify、PDF等），未自动修复或升级。测试通过不等于可以绕过安全和会员上线门槛。完整发布卡片见[方案](../../../docs/specs/2026-10-29-browser-data-figures.md)。

参考：[Pyodide同源部署与包文件](https://pyodide.org/en/stable/usage/downloading-and-deploying.html)。核心npm仅提供运行时，Matplotlib等wheel需另按固定锁准备；本实现不是依赖浏览器在线CDN自动补包。
