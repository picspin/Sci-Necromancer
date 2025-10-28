import React from 'react';
import { AbstractData } from '../../types';
import { SvgIcon } from '../SvgIcon';

interface ExportButtonsProps {
  abstract: AbstractData | null;
}

const ExportButtons: React.FC<ExportButtonsProps> = ({ abstract }) => {
  const handleExportMd = () => {
    if (!abstract) return;

    const content = `
# IMPACT

${abstract.impact}

---

# SYNOPSIS

${abstract.synopsis}

---

## KEYWORDS

- ${abstract.keywords.join('\n- ')}
    `;
    const blob = new Blob([content.trim()], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ismrm_abstract.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  const handleExportPdf = () => {
    alert('PDF export requires additional libraries and is not yet implemented.');
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExportMd}
        disabled={!abstract}
        className="flex items-center gap-2 text-sm px-3 py-1.5 bg-base-300 hover:bg-opacity-80 text-text-secondary rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Export as Markdown (.md)"
      >
        <SvgIcon type="download" className="h-4 w-4" />
        <span>MD</span>
      </button>
      <div className="relative group">
        <button
          onClick={handleExportPdf}
          disabled={!abstract}
          className="flex items-center gap-2 text-sm px-3 py-1.5 bg-base-300 text-text-secondary rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Export as PDF (Coming Soon)"
        >
          <SvgIcon type="download" className="h-4 w-4" />
          <span>PDF</span>
        </button>
         {abstract && <span className="absolute bottom-full mb-2 w-max bg-base-300 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">PDF export coming soon</span>}
      </div>
    </div>
  );
};

export default ExportButtons;