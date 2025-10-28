import React from 'react';
import { AbstractData, Conference, AbstractType, Category } from '../types';
import { SvgIcon } from './SvgIcon';
import ExportButtons from './export/ExportButtons';
import LiveRegion from './LiveRegion';

interface OutputDisplayProps {
  abstract: AbstractData | null;
  impact?: string;
  synopsis?: string;
  categories?: Category[];
  keywords?: string[];
  image: string | null;
  isLoading: boolean;
  error: string | null;
  loadingMessage?: string;
  conference?: Conference;
  abstractType?: AbstractType;
}

const OutputDisplay: React.FC<OutputDisplayProps> = ({ 
  abstract, 
  impact,
  synopsis,
  categories,
  keywords,
  image, 
  isLoading, 
  error, 
  loadingMessage,
  conference = 'ISMRM',
  abstractType
}) => {
  const hasOutput = abstract || image || impact || synopsis;
  
  const handleDownloadImage = () => {
    if (!image) return;
    const link = document.createElement('a');
    link.href = image;
    link.download = `figure_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-base-200 p-6 rounded-lg shadow-lg h-full flex flex-col">
      {/* ARIA live region for status updates */}
      <LiveRegion 
        message={
          isLoading ? loadingMessage || 'Generating content...' :
          error ? `Error: ${error}` :
          hasOutput ? 'Content generated successfully' :
          ''
        }
        priority={error ? 'assertive' : 'polite'}
      />
      
      <div className="flex justify-between items-center mb-4 border-b border-base-300 pb-2">
        <h2 id="output-heading" className="text-lg font-bold text-text-primary">Generated Output</h2>
        <ExportButtons abstract={abstract} conference={conference} abstractType={abstractType} />
      </div>
      <div 
        className="flex-grow overflow-y-auto pr-2 -mr-2" 
        style={{maxHeight: 'calc(100vh - 350px)'}}
        role="region"
        aria-labelledby="output-heading"
        aria-live="polite"
        aria-busy={isLoading}
      >
        {isLoading && <LoadingSpinner message={loadingMessage} />}
        {error && <ErrorMessage message={error} />}
        
        {!isLoading && !error && !hasOutput && (
          <div className="text-center text-text-secondary flex flex-col items-center justify-center h-full">
            <SvgIcon type="logo" className="h-16 w-16 text-base-300 mb-4" />
            <p>Your generated content will appear here.</p>
            <p className="text-sm mt-1">Begin by providing input on the left panel.</p>
          </div>
        )}
        
        <div className="space-y-6">
          {/* Show Impact & Synopsis even before full abstract is generated */}
          {(impact || abstract?.impact) && (
            <div className="animate-fade-in">
              <h3 className="flex items-center gap-2 text-md font-semibold text-blue-600 mb-2">
                <SvgIcon type="impact" className="h-5 w-5" />
                Impact
              </h3>
              <div className="bg-base-100 p-4 rounded-lg text-text-secondary text-sm prose max-w-none prose-p:my-2">
                {impact || abstract?.impact}
              </div>
            </div>
          )}
          
          {(synopsis || abstract?.synopsis) && (
            <div className="animate-fade-in">
              <h3 className="flex items-center gap-2 text-md font-semibold text-green-600 mb-2">
                <SvgIcon type="document" className="h-5 w-5" />
                Synopsis
              </h3>
              <div className="bg-base-100 p-4 rounded-lg text-text-secondary text-sm prose max-w-none prose-p:my-2">
                {synopsis || abstract?.synopsis}
              </div>
            </div>
          )}
          
          {(categories && categories.length > 0) && (
            <div className="animate-fade-in">
              <h3 className="flex items-center gap-2 text-md font-semibold text-purple-600 mb-2">
                <SvgIcon type="tag" className="h-5 w-5" />
                Categories
              </h3>
              <div className="bg-base-100 p-4 rounded-lg">
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <span 
                      key={cat.name}
                      className={`px-3 py-1 text-sm rounded-full ${
                        cat.type === 'main' ? 'bg-purple-600/20 text-purple-600' :
                        cat.type === 'sub' ? 'bg-blue-600/20 text-blue-600' :
                        'bg-gray-600/20 text-gray-600'
                      }`}
                    >
                      {cat.name} ({cat.type})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {(keywords && keywords.length > 0) && (
            <div className="animate-fade-in">
              <h3 className="flex items-center gap-2 text-md font-semibold text-orange-600 mb-2">
                <SvgIcon type="tag" className="h-5 w-5" />
                Keywords
              </h3>
              <div className="bg-base-100 p-4 rounded-lg text-text-secondary text-sm">
                {keywords.join(', ')}
              </div>
            </div>
          )}
          
          {abstract?.abstract && (
            <div className="animate-fade-in">
              <div className="flex justify-between items-center mb-2">
                <h3 className="flex items-center gap-2 text-md font-semibold text-brand-primary">
                  <SvgIcon type="document" className="h-5 w-5" />
                  Abstract {abstractType && `(${abstractType})`}
                </h3>
                <button
                  onClick={() => {
                    const fullText = `IMPACT:\n${abstract.impact}\n\nSYNOPSIS:\n${abstract.synopsis}\n\nABSTRACT:\n${abstract.abstract}\n\nKEYWORDS:\n${abstract.keywords.join(', ')}`;
                    navigator.clipboard.writeText(fullText);
                    alert('Abstract copied to clipboard!');
                  }}
                  className="flex items-center gap-2 text-sm px-3 py-1.5 bg-brand-primary hover:bg-brand-secondary text-white rounded-md transition-all duration-200"
                  title="Copy full abstract to clipboard"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                  </svg>
                  Copy
                </button>
              </div>
              <div className="bg-base-100 p-4 rounded-lg text-text-secondary text-sm">
                <AbstractBody content={abstract.abstract} />
              </div>
            </div>
          )}
          
          {image && (
             <div className="animate-fade-in">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="flex items-center gap-2 text-md font-semibold text-brand-primary">
                      <SvgIcon type="image" className="h-5 w-5" />
                      Generated Figure
                  </h3>
                  <button
                    onClick={handleDownloadImage}
                    className="flex items-center gap-2 text-sm px-3 py-1.5 bg-brand-primary hover:bg-brand-secondary text-white rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    aria-label="Download generated figure"
                  >
                    <SvgIcon type="download" className="h-4 w-4" />
                    Download Image
                  </button>
                </div>
                <div className="bg-base-100 p-2 rounded-lg">
                    <img src={image} alt="Generated Figure" className="rounded-md w-full object-contain" />
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};


const AbstractBody: React.FC<{content: string}> = ({ content }) => {
  // Parse abstract sections (e.g., "INTRODUCTION:", "METHODS:", etc.)
  const sections = content.split(/\n\n+/);
  
  return (
    <div className="space-y-4">
      {sections.map((section, index) => {
        // Check if section starts with a header (all caps followed by colon)
        const headerMatch = section.match(/^([A-Z\s&]+):\s*/);
        if (headerMatch) {
          const header = headerMatch[1];
          const body = section.substring(headerMatch[0].length);
          return (
            <div key={index}>
              <h4 className="font-bold text-brand-primary mb-2">{header}</h4>
              <p className="text-text-secondary leading-relaxed">{body}</p>
            </div>
          );
        }
        return <p key={index} className="text-text-secondary leading-relaxed">{section}</p>;
      })}
    </div>
  );
};

const LoadingSpinner: React.FC<{message?: string}> = ({message = "Generating Content..."}) => (
  <div 
    className="flex flex-col items-center justify-center h-full text-text-secondary animate-fade-in"
    role="status"
    aria-label={message}
  >
    <SvgIcon type="loader" className="h-12 w-12 animate-spin text-brand-primary mb-4" aria-hidden="true" />
    <p className="text-lg font-semibold" aria-live="polite">{message}</p>
    <p className="text-sm">This may take a few moments.</p>
  </div>
);

const ErrorMessage: React.FC<{ message: string }> = ({ message }) => (
  <div 
    className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg animate-fade-in" 
    role="alert"
    aria-live="assertive"
  >
    <strong className="font-bold">Error: </strong>
    <span className="block sm:inline">{message}</span>
  </div>
);

export default OutputDisplay;