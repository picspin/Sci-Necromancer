import React from 'react';
import { AbstractData, Conference, AbstractType } from '../types';
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
              <h3 className="flex items-center gap-2 text-md font-semibold text-brand-primary mb-2">
                <SvgIcon type="document" className="h-5 w-5" />
                Abstract {abstractType && `(${abstractType})`}
              </h3>
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

const OutputSection: React.FC<{title: string, content: string, icon: 'impact' | 'document' | 'tag'}> = ({ title, content, icon }) => (
    <div>
        <h3 className="flex items-center gap-2 text-md font-semibold text-brand-primary mb-2">
            <SvgIcon type={icon} className="h-5 w-5" />
            {title}
        </h3>
        <div className="bg-base-100 p-4 rounded-lg text-text-secondary text-sm prose max-w-none prose-p:my-2">
            {content}
        </div>
    </div>
)

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