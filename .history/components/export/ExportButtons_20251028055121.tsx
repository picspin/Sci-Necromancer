import React, { useState } from 'react';
import { AbstractData, Conference, AbstractType } from '../../types';
import { SvgIcon } from '../SvgIcon';
import exportService from '../../services/exportService';

interface ExportButtonsProps {
  abstract: AbstractData | null;
  conference?: Conference;
  abstractType?: AbstractType;
}

const ExportButtons: React.FC<ExportButtonsProps> = ({ abstract, conference = 'ISMRM', abstractType = 'Standard Abstract' }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportMd = () => {
    if (!abstract) return;

    const content = `# ${abstractType}

## IMPACT

${abstract.impact}

---

## SYNOPSIS

${abstract.synopsis}

${abstract.abstract ? `---

## ABSTRACT

${abstract.abstract}` : ''}

---

## KEYWORDS

${abstract.keywords.map(k => `- ${k}`).join('\n')}

${abstract.categories ? `
---

## CATEGORIES

${abstract.categories.map(c => `- ${c.name} (${c.type})`).join('\n')}
` : ''}
    `;
    const blob = new Blob([content.trim()], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(blob, `${conference.toLowerCase()}_abstract.md`);
  };
  
  const handleExportPdf = async () => {
    if (!abstract) return;
    
    setIsExporting(true);
    setExportError(null);
    
    try {
      const blob = await exportService.exportToPDF(abstract, conference, {
        customTitle: abstractType
      });
      downloadBlob(blob, `${conference.toLowerCase()}_abstract.pdf`);
    } catch (error) {
      console.error('PDF export error:', error);
      setExportError('Failed to export PDF. Please try again.');
      setTimeout(() => setExportError(null), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportDocx = async () => {
    if (!abstract) return;
    
    setIsExporting(true);
    setExportError(null);
    
    try {
      const blob = await exportService.exportToDocx(abstract, conference, {
        customTitle: abstractType
      });
      downloadBlob(blob, `${conference.toLowerCase()}_abstract.docx`);
    } catch (error) {
      console.error('DOCX export error:', error);
      setExportError('Failed to export DOCX. Please try again.');
      setTimeout(() => setExportError(null), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJson = () => {
    if (!abstract) return;
    
    const blob = exportService.exportToJSON(abstract, conference, abstractType);
    downloadBlob(blob, `${conference.toLowerCase()}_abstract.json`);
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={handleExportMd}
          disabled={!abstract || isExporting}
          className="flex items-center gap-2 text-sm px-3 py-1.5 bg-base-300 hover:bg-opacity-80 text-text-secondary rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-primary"
          title="Export as Markdown (.md)"
          aria-label="Export as Markdown"
        >
          <SvgIcon type="download" className="h-4 w-4" />
          <span>MD</span>
        </button>
        <button
          onClick={handleExportPdf}
          disabled={!abstract || isExporting}
          className="flex items-center gap-2 text-sm px-3 py-1.5 bg-base-300 hover:bg-opacity-80 text-text-secondary rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-primary"
          title="Export as PDF"
          aria-label="Export as PDF"
        >
          <SvgIcon type="download" className="h-4 w-4" />
          <span>PDF</span>
        </button>
        <button
          onClick={handleExportDocx}
          disabled={!abstract || isExporting}
          className="flex items-center gap-2 text-sm px-3 py-1.5 bg-base-300 hover:bg-opacity-80 text-text-secondary rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-primary"
          title="Export as Word Document (.docx)"
          aria-label="Export as DOCX"
        >
          <SvgIcon type="download" className="h-4 w-4" />
          <span>DOCX</span>
        </button>
        <button
          onClick={handleExportJson}
          disabled={!abstract || isExporting}
          className="flex items-center gap-2 text-sm px-3 py-1.5 bg-base-300 hover:bg-opacity-80 text-text-secondary rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-primary"
          title="Export as JSON"
          aria-label="Export as JSON"
        >
          <SvgIcon type="download" className="h-4 w-4" />
          <span>JSON</span>
        </button>
      </div>
      {exportError && (
        <div className="text-xs text-red-400 animate-fade-in" role="alert">
          {exportError}
        </div>
      )}
    </div>
  );
};

export default ExportButtons;