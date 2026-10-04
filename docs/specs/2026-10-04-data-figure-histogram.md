# 固定分箱直方图增量

## 实现草案

1. 沿用 CSV → DistributionData → FigureSpec → 本地导出的已确认边界，不新增模块、依赖、API 或前端入口。
2. 用户明确提供 2–51 个严格递增边界（最多 50 箱），所有组共享；最多 5,000 观测、八组。
3. Decimal 比较逐行计数，区间为左闭右开、最后一箱右闭；不使用自动分箱、抽样、密度或权重。
4. 缺失、范围外观测、无效边界或绘图坐标退化拒绝，不丢弃观测；常数组也须给定边界。
5. 用不填充的阶梯轮廓显示整数计数，y 轴从零开始；图上说明规则及每组 n，不做检验/拟合。
6. FigureSpec 的 distribution 选项显式冻结 histogram 和 bin_edges，使用独立 distribution-histogram-v1 版本。
7. 无新增选项时保留旧 distribution-box-scatter-v1 校验、图件和 hash；错误版本或跨模板参数拒绝。
8. 复用四种期刊 inspired 外观与 PNG/PDF/SVG 导出；边界及计数算法进入方案哈希。
9. 合成输入核对精确计数、临界值、空箱、全组总数、风格几何不变与重复导出，未经授权不部署。

参考：[NumPy 的半开箱区间定义](https://numpy.org/doc/stable/reference/generated/numpy.histogram.html)、[Matplotlib 预计算阶梯图接口](https://matplotlib.org/stable/api/_as_gen/matplotlib.axes.Axes.stairs.html)。仅参考方法与接口，不引入第三方项目代码或数据。

## 已实现边界与方案

- 仍使用 `template_id: distribution`；新增 `template_version: distribution-histogram-v1` 及 `distribution: {variant: histogram, bin_edges: [...]}`。必须同时声明两者，不能用旧箱线版本附带直方图参数；非分布模板也不能接收此选项。
- JSON 边界只接受有界数字或数值字符串；推荐字符串保存十进制精度。解析后冻结 Decimal 元组，逐行以精确比较分箱。最后一个端点计入最后一箱，内部端点计入右侧箱，空箱保留零；总数等于全部源行数量。
- 边界严格递增且转为 binary64 后不能重合，整体跨度须有限；若绘图库会自动拓宽退化坐标范围则拒绝。常数或单值仍需要明确边界，不自动扩大范围。
- y 轴从零开始并显示整数计数；允许不等宽箱，但不把面积解释为频率/概率。组间同一 x/y 坐标系、不填充轮廓、不并排错移；相同曲线可能重叠，图例仍显示各组 n。
- 无边界选项继续运行原箱线＋全部观测模板。新版本的方案哈希包含所有边界、源观测和分箱/显示规则；旧箱线哈希字段不变。风格层仅影响外观，不改变科学编码。
- PNG/PDF/SVG 可本地导出，未新增计数 CSV、任意变换、绘图脚本执行、生产上传或会员扣分接口。不能仅通过配置开关把本地能力开放给会员。

最小可运行示例（在仓库根目录的锁定 Python 环境中）：

```python
from hashlib import sha256
from services.figure_worker.spec import render_csv_spec

payload = b"Diameter,Group\n0,A\n5,A\n20,B\n"
spec = {
    "schema_version": "figure-spec-v1",
    "template_id": "distribution",
    "template_version": "distribution-histogram-v1",
    "dataset_sha256": sha256(payload).hexdigest(),
    "mapping": {"value": "col_1", "group": "col_2"},
    "units": {"value": "mm"},
    "distribution": {"variant": "histogram", "bin_edges": ["0", "5", "10", "20"]},
    "style": {"id": "nejm", "version": "nejm-inspired-v1"},
}
result = render_csv_spec(payload, spec)  # In-memory PNG/PDF/SVG; no network or charge.
```

## 合成验证记录

假设：显式分箱可忠实统计全部已有观测；新增变体不改变旧箱线模板或四种期刊风格下的科学几何。

配置：macOS-27.0-arm64-arm-64bit、Python 3.10.11、Matplotlib 3.10.9、既有 uv.lock/DejaVu Sans；无随机采样，固定合成输入，无患者数据、模型请求或付费动作。

结果：基线 87 项 Python 测试；校验切片 90、渲染切片 92。边界 `[0,1,2,4,10]` 和观测 `[0,1,1,4,10]` 得到 `[1,2,0,2]`，总计 5；改变 Decimal 环境精度至 2 不改变结果。精度超过 binary64 的邻近观测仍按 Decimal 归类。NEJM-inspired 合成预览采用边界 `[0,5,10,20,30,40]`，Synthetic A 计数 `[2,1,3,1,1]`、Synthetic B `[1,2,1,2,2]`，各为八观测，已实际导出并查看布局。最大八组、50 箱、5,000 行检查保持总数；超限拒绝，不抽样。

最终 96 项 Python 测试通过（新增九项）；586 项 JS/TS 测试与 lint/build 通过，保留既有动态/静态导入与大 chunk 警告。测试覆盖五种本地外观（含 standard）重复三格式导出、科学几何不变、严格版本/跨模板参数、原箱线哈希契约与无边界旧方案回归。没有性能或 AI 科研准确率实验，不能声称降本或提高推理准确率。

结论：固定分箱直方图本地变体已接通；KDE/小提琴、其余已约定变体、十二例多面板画廊以及会员生产链路仍未完成。

Ablation Pass：只扩展现有分布数据、方案与渲染入口；边界校验和精确计数分别被 intake/renderer 调用，不创建通用插件或单次包装层，无新依赖/推测性参数。

部署影响：Supabase 无迁移；Vercel 无需部署；Cloudflare Worker 无需重建/部署；无环境变量或生产开关变化。仅本地原型、测试、文档变更，生产操作已执行：无。无本增量的生产发布顺序或付费烟测需求；后续完整会员上线仍须按 [Deployment Runbook](../DEPLOYMENT_RUNBOOK.md) 单独审核。
