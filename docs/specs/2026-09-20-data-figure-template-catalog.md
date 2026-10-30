# 会员数据作图：模板与临床案例目录

日期：2026-09-20。状态：范围已确认，局部本地实现；与[主设计](./2026-09-20-member-data-figures-design.md)共同约束上线验收。

2026-10-06 增量：首个 radiology-validation 已有独立合成 CSV、字段字典、冻结多面板方案和可运行本地 demo；两至四面板仅允许 grouped-bar、dot-interval、heatmap，原始行与全文件 hash 可追溯。其余十一例仍待做，尚无公开画廊/会员工作区；115 项 Python 回归通过不代表上线。参见[多面板记录](./2026-10-06-data-figure-multipanel.md)。

2026-10-02 实现进度：十一类基础图型已有本地 CSV/FigureSpec 校验与 PNG/PDF/SVG 渲染，新增分布箱线＋全部观测、明确逐轴范围/方向的雷达及原值 CSV 附件。构成首个变体仅支持已有整数计数和组内明确分母；排名需显式排序/top-N 并披露省略数量；火山只显示已有差异结果并披露 P=0 的显示处理。下表所列完整变体、十二个画廊案例与线上会员执行链路仍未完成；87 项 Python 合成数据测试通过不等于本站已开放数据作图。新增边界见[分布/雷达记录](./2026-10-02-data-figure-distribution-radar.md)，整体以[当前实现状态](./2026-09-20-member-data-figures-design.md)为准。

## 1. 纳入方式与范围

参考本地 `/Users/hilbert/LLM/figures4papers/`，实际为 _\*8 个 figure_* 目录、23 个 plot__.py**。下表依据脚本绘图操作而非目录名称分类。纳入的是通用图型需求、比较布局和组织方式，不复制上游 CC BY-NC 4.0 的实现、数据、图片或配色。临床用途是本站提出的应用方向，不代表参考论文验证了这些用途。

首版目标：11 个原子图型、12 个独立合成临床案例；原子图型是可复用 renderer，案例是字段映射、预设布局和解释说明。单次最多四个数据面板，图例不计面板。参考案例中的超大分面不照搬：用户明确选择四项或拆成独立图件，不静默丢弃类别。

## 2. 全部参考脚本的去向

表内路径相对本地 figures4papers 根目录；“首版”指规划交付，不是已经可用。

| 参考脚本                                              | 核对到的视觉模式                       | 独立实现去向与临床用途                                               | 阶段                     |
| ----------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------- | ------------------------ |
| figure_Brainteaser/plot_selfcorrection_math.py        | 多条件分类概率条形分面                 | grouped-bar；不同读者/审核流程的已有指标比较                         | 首版                     |
| figure_Brainteaser/plot_correctness_by_category.py    | 大类别分面条形                         | grouped-bar；疾病类别/中心分层的指标比较                             | 首版                     |
| figure_Brainteaser/plot_correctness_by_subcategory.py | 细分类别多面板条形                     | grouped-bar；影像亚型分层，面板上限约束                              | 首版                     |
| figure_Brainteaser/plot_rewriting.py                  | 并列条形、颜色与纹理双重编码           | grouped-bar；方案与亚组交叉比较                                      | 首版                     |
| figure_Brainteaser/plot_brute_force.py                | 堆叠概率条形、段内数值标注             | composition；疗效/分期等互斥类别构成                                 | 首版                     |
| figure_CellSpliceNet/plot_comparison.py               | 多指标均值及离散程度条形分面           | grouped-bar / dot-interval；已有算法验证结果                         | 首版                     |
| figure_CellSpliceNet/plot_ablation.py                 | 消融条件条形比较                       | grouped-bar；不同组学输入组合的已有性能                              | 首版                     |
| figure_Cflows/plot_comparison_Trajectory.py           | 按数据集分组的指标条形，并非轨迹曲线   | grouped-bar；跨队列方法比较，不运行轨迹推断                          | 首版                     |
| figure_Cflows/plot_comparison_GeneRegulatory.py       | 调控任务指标条形分面                   | grouped-bar；调控方法已有指标，不推断调控网络                        | 首版                     |
| figure_Cflows/plot_comparison_Ablation.py             | 消融指标条形分面                       | grouped-bar；临床模型输入模态消融                                    | 首版                     |
| figure_Dispersion/plot_idea.py                        | 球面投影、点与径向连线概念示意         | 未来确定性几何示意图；不是观测数据模板                               | 后续                     |
| figure_Dispersion/plot_illustration.py                | 角度分散、去相关、正交化与三维箭头示意 | 未来算法机制示意；不解释为患者数据变换结果                           | 后续                     |
| figure_ImmunoStruct/plot_bars.py                      | 多指标误差条形、横向消融比较           | grouped-bar / dot-interval；免疫/肿瘤指标比较                        | 首版                     |
| figure_RNAGenScape/plot_comparison.py                 | 吞吐量条形及按列指标热力图             | grouped-bar / heatmap；临床模型效率与性能分面                        | 首版                     |
| figure_RNAGenScape/plot_sweep.py                      | 参数扫描的多条曲线                     | trend；已有阈值或参数扫描结果，不重新训练                            | 首版                     |
| figure_RNAGenScape/plot_manifold.py                   | 数学三维曲面                           | 未来三维概念图；不从临床数据拟合曲面                                 | 后续                     |
| figure_RNAGenScape/plot_hole_manifold.py              | 带孔三维流形对比                       | 未来拓扑机制示意；不作临床证据                                       | 后续                     |
| figure_VIGIL/plot_posttraining.py                     | 分阶段连线、点标记与基线               | trend；随访阶段/已有训练过程指标                                     | 首版                     |
| figure_VIGIL/plot_ablation.py                         | 参数/数据比例曲线与双轴比较            | trend；参数敏感性，独立单位拆分面板而非默认双轴                      | 首版                     |
| figure_VIGIL/plot_comparison_radar.py                 | 多指标归一化雷达图                     | radar；已有临床模型多指标概览                                        | 首版                     |
| figure_VIGIL/plot_concept.py                          | 合成密度曲线、二维流形与路径概念示意   | 仅借鉴分布/散点表达；真实输入用 distribution / scatter；机制示意另列 | 数据表达首版，概念图后续 |
| figure_ophthal_review/plot_trend.py                   | 累积计数、填充曲线与事件标注           | trend；入组/文献数量累计，不当作累积风险                             | 首版                     |
| figure_ophthal_review/plot_composition.py             | 带整数注释的计数热力图，并非饼图       | heatmap；疾病×研究类型证据矩阵                                       | 首版                     |

不沿用上游的隐式缺失填补、雷达值裁剪、条形截轴或默认双轴。排名棒棒糖、森林图、火山图等为本站临床需求补充，不宣称上述脚本已包含这些实现；同样不宣称其执行 ssGSEA、差异表达或临床推断。

## 3. 首版 11 个原子图型契约

字段为逻辑角色，用户将自己的列映射到角色；具体数值、标签和研究结论不能由 LLM 补齐。所有计算、缺失处理和变换受主设计统计边界约束。

| ID              | 支持形态                                   | 最小输入与额外约束                                                                                                         |
| --------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| distribution    | 箱线＋散点、直方图、可选小提琴             | value、可选 group；固定分箱/分位数/KDE 规则，常数或样本不足时禁用 KDE 并提示                                               |
| grouped-bar     | 单组/分组、横向、指标分面                  | category、value、可选 group/metric；从零起轴；不同单位分面；误差仅用用户提供且类型明确的字段                               |
| composition     | 堆叠计数、100% 堆叠                        | group、component、count 或 proportion；互斥且穷尽的类别、明确分母；非负，比例和容差校验；不把多选项目强行归一成整体        |
| trend           | 时间趋势、个人轨迹、累积计数、参数扫描     | x、value、series；个人轨迹需 subject；累积仅对明确的非负增量求和；已累计值不二次累加；事件位置由用户提供                   |
| scatter         | 双变量散点、已有二维嵌入                   | x、y、可选 group；嵌入记录来源方法/版本，不执行 PCA/UMAP/t-SNE，不加聚类/轨迹推断                                          |
| heatmap         | 数值/计数/评分矩阵、描述性相关、注释热力图 | row、column、value 或数值宽表；重复单元拒绝，除非显式选择合法聚合；标准化方向/色标范围披露；无自动聚类                     |
| dot-interval    | 横向/纵向点区间、多指标分面                | label、estimate、lower、upper、interval_type；CI 声明水平，SD/SE 明确含义；不从未知误差推断区间                            |
| radar           | 多指标概览                                 | method、metric、value；每轴需单位、上下界与方向，确定性归一化并保留原值表；缺失/越界拒绝，不填均值、不裁剪；不生成综合排名 |
| ranked-lollipop | 排名指标、已有通路分数展示                 | label、value、可选 group；用户选择排序和 top-N，披露省略数量；不将不同单位混排，不计算富集结果                             |
| forest          | 已有效应量与区间                           | label、estimate、lower、upper、effect_type、CI_level；OR/RR/HR 对数轴正值；不拟合、不合并效应，不自行增加汇总菱形          |
| volcano         | 已有差异分析结果                           | identifier、log2FC、p 或 adjusted_p；明确纵轴与阈值，不做检验/FDR；P=0 需明确显示下限                                      |

复合布局不增图型数量：多指标比较、消融比较、跨队列比较、参数敏感性都是上述图型的配置。雷达不是默认比较方式，优先推荐更易比较的点区间或分面条形。

## 4. 12 个临床多学科画廊案例

全部使用本站独立生成、固定随机种子的合成数据；预览明确标注“合成演示，非研究结论”。每例交付 CSV、字段字典、映射、FigureSpec、预览、三种导出及测试。每例一份输入、一个冻结数据版本；涉及不同形态结果时用明确 record_type 的长表及面板过滤，不拼接真实患者表、不隐式跨表关联。正式上传数据不加演示水印。

| 案例 ID / 学科                          | 临床任务及 2–4 面板组合                                       | 所需数据与边界                                                             |
| --------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------- |
| radiology-validation / 放射影像         | 不同中心与模态的模型指标：grouped-bar＋dot-interval＋heatmap  | center、method、metric、value、已有区间；不计算 ROC/AUC                    |
| oncology-response / 肿瘤                | 疗效构成＋肿瘤测量随访：composition＋trend                    | 分组疗效计数、已提供的随访测量；不自动判定 RECIST、不估计生存率            |
| immunology-assays / 免疫                | 生物标志物分布＋指标相关：distribution＋heatmap               | 样本测量、组别；仅描述性相关、不做组间检验                                 |
| cardiometabolic-followup / 心血管与代谢 | 指标随访＋个体分布＋已有亚组效应：trend＋distribution＋forest | 时间、受试者、指标及单独标识的已有区间记录；不拟合回归                     |
| epidemiology-surveillance / 流行病学    | 周计数＋病例构成＋累计报告：trend＋composition＋trend         | 地区/周/类别计数；累计报告不称发病风险，不自动计算年龄标化率               |
| ophthalmology-evidence / 眼科           | 年/月文献累计＋疾病×研究类型矩阵：trend＋heatmap              | 文献计数、时间、疾病、研究类型；事件注释不构成因果证据                     |
| neurology-longitudinal / 神经科学       | 量表随访＋组别分布：trend＋distribution                       | subject、visit、score、group；不自动判定临床重要差异                       |
| transcriptomics-results / 转录组        | 差异结果＋表达/评分矩阵：volcano＋heatmap                     | 用户已完成的差异结果与处理后矩阵；不做差异分析或批次校正                   |
| single-cell-summary / 单细胞            | 已有二维坐标＋细胞类别构成：scatter＋composition              | 坐标、用户提供的细胞类型、样本计数；不聚类、不注释细胞、不推断伪时序       |
| multiomics-benchmark / 多组学           | 输入模态消融＋多指标概览：grouped-bar＋radar                  | 用户已有验证指标、雷达上下界/方向；不整合组学、不训练预测器                |
| pathway-results / 通路与蛋白组          | 已有通路分数排名＋样本评分矩阵：ranked-lollipop＋heatmap      | 用户提供的通路结果/ssGSEA 等评分；不执行富集或 ssGSEA                      |
| clinical-ai-sensitivity / 临床 AI       | 参数/样本规模曲线＋性能与运行时间：trend＋grouped-bar         | 已计算扫描结果及运行时间；不同单位分面，不重训、不据曲线选择“最优”临床阈值 |

这些案例是首版覆盖清单，不宣称涵盖所有临床图件。KM/ROC、校准、决策曲线、Bland–Altman、泳道图、Oncoprint、UpSet、空间组学、三维曲面进入独立 backlog；即便仅展示已有结果，也需另定输入、统计语义和验收契约后才开放。不能绕过模板允许列表用通用折线自动承接这些请求。

## 5. Skill、画廊与验收联动

- Skill 路由顺序：研究任务 → 已有数据形态 → 图型契约 → 临床案例/布局 → 样式。学科仅用于筛选，不替代字段验证。
- manifest 增加 disciplines、research_tasks、input_kind、variants、required_roles、forbidden_analyses、example_ids、reference_provenance；后者记录“概念参考/独立实现”，不分发上游资产。
- 每个案例固定引用 template ID/version。若已有统计结果缺列，要求用户补充，不让文本模型创造结果。模板未安装、未测试或后台关闭时不显示可执行按钮。
- 11 类均有最小有效输入、边界/错误输入、已知数值断言及 PNG/PDF/SVG 验证；12 例均验证字段映射、数值、面板上限、复现和人工视觉检查。
- 特别测试比例分母、累计重复累加、误差类型混用、雷达缺失/越界、热力图重复单元、排序省略、嵌入坐标来源、火山 P=0、对数轴非法值，以及同名指标不同单位的误合并。
- 发布分两批内部实现：先基础渲染/契约，再扩展模板与全部临床案例；首版正式开放仍以这份完整清单为验收目标。若缩减，必须更新范围并明确告知，不把未完成模板伪装成已支持。

学分、任务锁定、数据隐私、24 小时清理及来源披露沿用主设计；扩充图库不增加隐藏模型调用或改变一次成功图件的拟定费用。
