# 数据图期刊风格增量

## 设计草案（已确认）

1. 输入：现有已冻结 CSV/FigureSpec，追加可选的 `style: {id, version}`。
2. 输出：PNG/PDF/SVG 和风格 ID、版本、配置哈希；保留原始数据哈希。
3. 独立实现 Standard、Lancet-inspired、Nature-inspired、Cell-inspired、NEJM-inspired 五档。
4. 风格只控制固定配色、字体大小、数据线宽、连续色图和导出 DPI，不修改统计含义。
5. 九类现有模板共用外观处理；不改变数据校验、轴尺度、数值、顺序、阈值或警示。
6. 仅接受注册表中的确切 ID/版本，不接受脚本、路径、URL、自定义表达式或任意样式配置。
7. 沿用已锁定 Matplotlib 和 DejaVu Sans；不引入新依赖、第三方模板资产或未经授权字体。
8. 这是期刊视觉启发，不是官方模板、品牌关联或投稿合规认证；尺寸/可编辑字体规范另行核验。
9. 当前仅本地 worker，会员任务、计费和 UI 尚未接通；无数据库迁移和生产部署。

## 后续顺序

先补齐数据图，再独立增加 AI / CV 投稿入口（MICCAI、CVPR、通用 OpenReview）。保留历史 ESC 标识；不自动投稿，不把平台通用规则当成具体会议规则。精确年度细则需以可核验官方来源为准。

## 已实现与复现

注册表五档共用九类基础模板。方案可省略 `style` 以保留旧 Standard 产物；显式 Standard 与省略值导出相同。选择期刊风格时必须冻结精确版本，例如：

```json
{ "style": { "id": "nature", "version": "nature-inspired-v1" } }
```

风格注册表不可变，直接 renderer 也拒绝伪造的配置实例。期刊档 PNG 为 300 DPI；原 Standard 保持 160 DPI。沿用同一 DejaVu Sans 字体文件；警示页脚保持字号、位置和文本。样式哈希包含全部配置与字体哈希，并进入期刊档 FigureSpec 哈希及三格式元数据。改变风格不会改变源数据哈希。PDF/SVG 当前不是期刊要求的可编辑文字模板，不应作为官方合规终稿宣传。

实验记录：

- 假设：共享外观层可以改变视觉风格而不改变现有模板的科学编码。
- 配置：纯合成 CSV；macOS 27.0 arm64、Python 3.10.11、Matplotlib 3.10.9；依赖使用现有 `uv.lock`，无随机采样；未调用模型或真实会员服务。
- 基线：未指定风格的九类现有模板；控制组为显式 Standard，同输入导出结果相同。
- 结果：71 项 Python 测试通过；其中 36 个模板×期刊风格组合校验数据图元、轴尺度/限值、阈值、连续色标范围和警示不变，验证三格式哈希及 PNG 尺寸。四个风格同输入重复导出结果相同。前端 96 文件/586 测试、lint、build 通过；build 仍有既有 chunk 大小和静态/动态导入警告。
- 结论：本地回归支持这一外观隔离设计；不代表官方投稿合规、任意数据标签无溢出、CJK 字体覆盖或线上工作流通过。已人工检查 NEJM/Cell 合成趋势图，未做性能对比，不声称降本/加速。

执行：

```bash
uv sync --project services/figure_worker --locked
uv run --project services/figure_worker --no-sync python -m unittest discover -s services/figure_worker/tests -v
```

Ablation Pass：保留的风格注册表解决严格白名单与版本冻结；共享外观层服务九类模板；没有开放任意 rcParams、预留布局插件、未调用配置或未来期刊字体依赖。

部署：Supabase 无迁移；Vercel 无需部署；Cloudflare Worker 无需重建/部署。未改变环境变量、生产开关和会员价格，未执行任何生产操作。完整数据图仍需分布/雷达等模板、案例画廊、文件与隔离执行、异步任务/恢复、计费、Jev/文本模型和前端工作区，不因这一增量移除“开发中”。
