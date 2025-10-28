import React from 'react';
import { AbstractData, Conference, AbstractType } from '../types';
import { SvgIcon } from './SvgIcon';
import ExportButtons from './export/ExportButtons';

interface OutputDisplayProps {
  abstract: AbstractData | null;
  image: string | null;
  isLoading: boolean;
  error: string | null;
  loadingMessage?: string;
  conference?: Conference;
  abstractType?: AbstractType;
}

const OutputDisplay: React.FC<OutputDisplayProps> = ({ 
  abstract, 
  image, 
  isLoading, 
  error, 
  loadingMessage,
  conference = 'ISMRM',
  abstractType
}) => {
  const hasOutput = abstract || image;

  return (
    <div className="bg-base-200 p-6 rounded-lg shadow-lg h-full flex flex-col">
      <div className="flex justify-between items-center mb-4 border-b border-base-300 pb-2">
        <h2 className="text-lg font-bold text-text-primary">Generated Output</h2>
        <ExportButtons abstract={abstract} conference={conference} abstractType={abstractType} />
      </div>
      <div className="flex-grow overflow-y-auto pr-2 -mr-2" style={{maxHeight: 'calc(100vh - 350px)'}}>
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
          {abstract && (
            <div className="space-y-4 animate-fade-in">
              <OutputSection title="Impact" content={abstract.impact} icon="impact" />
              <OutputSection title="Synopsis" content={abstract.synopsis} icon="document" />
              <OutputSection title="Keywords" content={abstract.keywords.join(', ')} icon="tag" />
            </div>
          )}
          {image && (
             <div className="animate-fade-in">
                <h3 className="flex items-center gap-2 text-md font-semibold text-brand-primary mb-2">
                    <SvgIcon type="image" className="h-5 w-5" />
                    Generated Figure
                </h3>
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
  <div className="flex flex-col items-center justify-center h-full text-text-secondary animate-fade-in">
    <SvgIcon type="loader" className="h-12 w-12 animate-spin text-brand-primary mb-4" />
    <p className="text-lg font-semibold">{message}</p>
    <p className="text-sm">This may take a few moments.</p>
  </div>
);

const ErrorMessage: React.FC<{ message: string }> = ({ message }) => (
  <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg animate-fade-in" role="alert">
    <strong className="font-bold">Error: </strong>
    <span className="block sm:inline">{message}</span>
  </div>
);

export default OutputDisplay;