import React, { useMemo, useState } from "react";
import { SvgIcon } from "./SvgIcon";

/**
 * 浮动使用与配置提示菜单
 * - 右下角悬浮 SVG 控制按钮
 * - 点击后展开菜单目录（中文）
 * - 鼠标移动到某个文档时右侧展开其说明；鼠标离开整个菜单后自动关闭
 */

type TipItem = {
  id: string;
  title: string;
  icon?: "document" | "settings" | "info" | "download";
  description?: string;
  content?: string;
  children?: TipItem[];
};

const tipsData: TipItem[] = [
  {
    id: "analysis",
    title:
      "1. 如何分析上传文件并生成不同格式论文（ISMRM、RSNA、JACC、ER 等）",
    icon: "document",
    content:
      [
        "步骤与说明：",
        "• 在首页选择目标会议（JACC、RSNA、ISMRM、ER 等）。",
        "• 选择分析模式：标准模式（已有论文）或创意扩展模式（一句话想法）。",
        "• 上传 PDF 或 DOCX 文件，或直接粘贴论文文本。",
        "• 点击“分析”，系统自动提取类别与关键词；可在弹窗中筛选、调整。",
        "• 选择建议的摘要类型（标准/注册/临床实践/ISMRT 等），再点击“生成”。",
        "• 系统会根据选定会议规范自动排版输出，可在导出面板下载为不同格式。",
        "",
        "技巧：",
        "• 文件较大时处理耗时更长，耐心等待即可；若上传失败，可尝试直接粘贴文本。",
        "• 分类概率匹配基于内容，支持多类别与关键词，可根据投稿策略进行微调。",
      ].join("\n"),
  },
  {
    id: "model",
    title: "2. 如何配置模型",
    icon: "settings",
    description:
      "包含 Google AI、OpenAI API 兼容模型（以 Siliconflow 为例）、图像生成模型配置、MCP 配置等。",
    children: [
      {
        id: "model-google",
        title: "2.1 Google AI 模型配置指南",
        icon: "settings",
        content:
          [
            "配置步骤：",
            "• 在“模型设置”面板中选择 Google AI（Gemini）相关模型。",
            "• 在 API Key 输入框填入 Google AI 的密钥，将安全保存至本地（或浏览器存储）。",
            "• 根据任务场景选择具体模型（如文本写作、结构化编辑、代码辅助等）。",
            "• 生成摘要时可在工作流设置中选择对应模型，以获得最佳写作风格与一致性。",
            "",
            "建议：",
            "• 若需更强大的风格统一与结构化输出，可启用写作风格增强（lib/llm/writingStyleEnhancer.ts）。",
            "• 网络较慢时，可降低生成温度或增加重试次数（lib/utils/retryUtils.ts）。",
          ].join("\n"),
      },
      {
        id: "model-openai",
        title: "2.2 OpenAI API 兼容模型配置指南（以 Siliconflow 为例）",
        icon: "settings",
        content:
          [
            "配置步骤（OpenAI 兼容）：",
            "• 在“模型设置”面板选择 OpenAI 兼容的推理服务（例如 Siliconflow）。",
            "• 填入兼容的 API Key，并确认 API Base（如 https://api.siliconflow.cn），模型名称可选择对应服务提供的版本。",
            "• 在生成时选择该模型，即可使用 OpenAI 风格的接口与参数。",
            "",
            "注意：",
            "• 如果服务需要自定义 baseURL 或组织 ID，可在设置面板中一起配置。",
            "• 兼容模型的速率限制与计费策略可能不同，请根据账号情况调整生成长度与并发。",
          ].join("\n"),
      },
      {
        id: "model-image",
        title: "2.3 图像生成模型特殊配置与选择说明",
        icon: "settings",
        content:
          [
            "说明：",
            "• 图像生成支持两种模式：标准（对已有图像进行编辑/转换）与创意（根据摘要自动生成）。",
            "• 在图像生成面板中选择模型与参数（分辨率、风格、标注要求等）。",
            "• 标准模式：上传图像，填写说明（如“添加箭头”“转为灰度”“统一尺寸”），点击生成。",
            "• 创意模式：先生成摘要，再选择“根据摘要生成图像”，模型会结合摘要内容产出示意图。",
            "",
            "建议：",
            "• 医学类图像注意合规性与隐私；生成图像仅用于示意，投稿请遵循会议图像要求。",
            "• 需要高对比或特定色板时，可在参数中明确说明（例如 RSNA 常用灰度/注释样式）。",
          ].join("\n"),
      },
      {
        id: "model-mcp",
        title:
          "2.4 MCP 配置说明（raw MCP 及导入其他 MCP）",
        icon: "settings",
        content:
          [
            "MCP（Model Context Protocol）扩展：",
            "• raw MCP：用于直接对接本地或远程工具，提供数据访问或处理能力。",
            "• 导入其他 MCP：可通过配置文件或设置面板加载外部 MCP（参见 MCP_TOOLS_GUIDE.md）。",
            "• 在“模型设置”/“工具配置”中选择启用 MCP，并根据说明填入必要参数（地址、令牌、资源路径等）。",
            "",
            "用途示例：",
            "• 连接学术数据库或云存储，用于摘要检索/加载。",
            "• 接入图像处理管线或导出服务，增强工作流自动化。",
          ].join("\n"),
      },
    ],
  },
  {
    id: "supabase",
    title:
      "3. 文章摘要存储、读取与数据库及 Supabase MCP 功能说明",
    icon: "info",
    content:
      [
        "功能说明：",
        "• 可将生成的摘要保存到本地存储；如需云同步，可配置 Supabase。",
        "• Supabase MCP：通过 MCP 扩展访问 Supabase 数据库，实现摘要的存储、读取与检索。",
        "• 在“模型/工具配置”面板或 SupabaseMCPConfig 中填入连接参数（URL/Key/Schema 等）。",
        "",
        "建议：",
        "• 开启云同步后，跨设备可共享历史摘要；注意数据库读写限额与安全策略。",
        "• 导出 JSON 时可作为数据库备份或批量导入的数据来源。",
      ].join("\n"),
  },
  {
    id: "export",
    title: "4. 文章与图像导出功能与支持格式",
    icon: "download",
    content:
      [
        "导出支持：",
        "• 文章：PDF、DOCX、JSON、Markdown；包含 Impact、Synopsis、关键词与全文。",
        "• 图像：PNG/JPEG 等常见格式；支持统一尺寸、注释覆盖、灰度转换等。",
        "• 在输出面板点击对应导出按钮即可下载；批量导出可在历史摘要中进行。",
        "",
        "注意：",
        "• 若导出失败，请检查浏览器下载权限或尝试更换文件名。",
        "• DOCX 导出适合后续微调；PDF 导出适合最终稿提交预览。",
      ].join("\n"),
  },
];

function flattenChildren(parent: TipItem | null): TipItem[] {
  if (!parent?.children) return [];
  return parent.children;
}

const FloatingTips: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredChildId, setHoveredChildId] = useState<string | null>(null);

  const hoveredItem: TipItem | null = useMemo(
    () => tipsData.find((t) => t.id === hoveredId) || null,
    [hoveredId]
  );
  const childItems = useMemo(() => flattenChildren(hoveredItem), [hoveredItem]);

  const currentDetail: TipItem | null = useMemo(() => {
    if (hoveredChildId && childItems.length > 0) {
      return childItems.find((c) => c.id === hoveredChildId) || null;
    }
    return hoveredItem;
  }, [hoveredChildId, childItems, hoveredItem]);

  const handleToggle = () => {
    setOpen((prev) => !prev);
    if (!open) {
      // 打开时默认展示第一个条目
      setHoveredId(tipsData[0]?.id || null);
      setHoveredChildId(null);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setHoveredId(null);
    setHoveredChildId(null);
  };

  return (
    <>
      {/* 悬浮控制按钮 */}
      <button
        type="button"
        aria-label="使用与配置指南"
        title="使用与配置指南"
        onClick={handleToggle}
        className="fixed bottom-4 right-4 z-50 rounded-full p-3 bg-brand-primary text-white shadow-lg hover:bg-brand-primary/90 focus:outline-none focus:ring-2 focus:ring-brand-primary"
      >
        <SvgIcon type="info" className="h-6 w-6" />
      </button>

      {/* 展开的菜单面板 */}
      {open && (
        <div
          className="fixed bottom-20 right-4 z-50 w-[760px] max-w-[92vw]"
          onMouseLeave={handleClose}
          aria-label="网站使用与配置提示面板"
        >
          <div className="relative bg-base-200 border border-base-300 rounded-xl shadow-2xl overflow-hidden">
            {/* 顶部栏 */}
            <div className="flex items-center justify-between px-4 py-2 bg-base-300/50 border-b border-base-300">
              <div className="flex items-center gap-2 text-text-primary">
                <SvgIcon type="document" className="h-5 w-5" />
                <span className="font-semibold">网站使用与配置提示（中文）</span>
              </div>
              <button
                type="button"
                aria-label="关闭提示面板"
                className="p-1 rounded-md hover:bg-base-300/70 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                onClick={handleClose}
              >
                <SvgIcon type="close" className="h-5 w-5" />
              </button>
            </div>

            {/* 主体两栏：左侧目录，右侧详情 */}
            <div className="grid grid-cols-2 gap-3 p-3">
              {/* 左侧目录（菜单风格） */}
              <nav
                className="space-y-2 pr-2 border-r border-base-300"
                role="menu"
                aria-label="提示目录"
              >
                {tipsData.map((item) => {
                  const active = item.id === hoveredId;
                  return (
                    <div key={item.id}>
                      <button
                        type="button"
                        role="menuitem"
                        aria-haspopup={item.children ? true : false}
                        className={`w-full text-left px-3 py-2 rounded-md transition-colors flex items-center gap-2 ${
                          active
                            ? "bg-brand-primary/20 text-brand-primary"
                            : "bg-base-100 hover:bg-base-300/50 text-text-secondary hover:text-text-primary"
                        }`}
                        onMouseEnter={() => {
                          setHoveredId(item.id);
                          setHoveredChildId(null);
                        }}
                      >
                        {item.icon && (
                          <SvgIcon type={item.icon} className="h-4 w-4" />
                        )}
                        <span className="text-sm">{item.title}</span>
                      </button>

                      {/* 子目录（仅在父项被 hover 时显示） */}
                      {active && item.children && item.children.length > 0 && (
                        <div className="mt-2 ml-4 space-y-1">
                          {item.children.map((child) => {
                            const childActive = child.id === hoveredChildId;
                            return (
                              <button
                                key={child.id}
                                type="button"
                                role="menuitem"
                                className={`w-full text-left px-3 py-1.5 rounded-md transition-colors flex items-center gap-2 ${
                                  childActive
                                    ? "bg-brand-primary/20 text-brand-primary"
                                    : "bg-base-100 hover:bg-base-300/50 text-text-secondary hover:text-text-primary"
                                }`}
                                onMouseEnter={() => {
                                  setHoveredChildId(child.id);
                                }}
                              >
                                {child.icon && (
                                  <SvgIcon
                                    type={child.icon}
                                    className="h-4 w-4"
                                  />
                                )}
                                <span className="text-xs">{child.title}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>

              {/* 右侧详情（随鼠标移动而变化） */}
              <section
                className="bg-base-100 rounded-md p-3"
                aria-live="polite"
              >
                {currentDetail ? (
                  <>
                    <h3 className="text-sm font-bold text-text-primary mb-2">
                      {currentDetail.title}
                    </h3>
                    {currentDetail.description && (
                      <p className="text-xs text-text-secondary mb-2">
                        {currentDetail.description}
                      </p>
                    )}
                    <div className="prose prose-invert max-w-none text-xs text-text-secondary whitespace-pre-line">
                      {currentDetail.content}
                    </div>
                  </>
                ) : (
                  <div className="text-text-secondary text-sm">
                    将鼠标移动到左侧目录中的任意文档项，即可在此处查看详细说明。鼠标离开面板后会自动关闭。
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FloatingTips;
