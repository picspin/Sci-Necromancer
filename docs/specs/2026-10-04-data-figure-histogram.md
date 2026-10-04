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
