
import React from 'react';
import { GenerationMode, ImageState } from '../types';
import { SvgIcon } from './SvgIcon';

interface ControlPanelProps {
  activeTab: 'text' | 'image';
  setActiveTab: (tab: 'text' | 'image') => void;
  textMode: GenerationMode;
  setTextMode: (mode: GenerationMode) => void;
  imageMode: GenerationMode;
  setImageMode: (mode: GenerationMode) => void;
  inputText: string;
  setInputText: (text: string) => void;
  imageState: ImageState;
  setImageState: (state: ImageState) => void;
  isAbstractGenerated: boolean;
}

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]); // remove the data:mime/type;base64, part
        };
        reader.onerror = error => reject(error);
    });
};

const ControlPanel: React.FC<ControlPanelProps> = ({
  activeTab, setActiveTab, textMode, setTextMode, imageMode, setImageMode,
  inputText, setInputText, imageState, setImageState, isAbstractGenerated
}) => {
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = (event) => {
          setInputText(event.target?.result as string);
        };
        reader.readAsText(file);
      } else {
        alert('Only .txt files are supported for direct reading. Please copy and paste content from other file types.');
      }
    }
  };
  
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const base64 = await fileToBase64(file);
        setImageState({ ...imageState, file, base64 });
      } catch (error) {
        console.error("Error converting file to base64:", error);
      }
    }
  };

  return (
    <div className="bg-base-200 p-6 rounded-lg shadow-lg">
      <div className="flex border-b border-base-300 mb-4">
        <TabButton id="text" activeTab={activeTab} setActiveTab={setActiveTab} label="Abstract Generation" icon="text" />
        <TabButton id="image" activeTab={activeTab} setActiveTab={setActiveTab} label="Figure Generation" icon="image" />
      </div>

      {activeTab === 'text' ? (
        <div className="space-y-4">
          <ModeSelector mode={textMode} setMode={setTextMode} creativeDisabled={false} />
          {textMode === 'standard' ? (
            <div>
              <label htmlFor="file-upload" className="block text-sm font-medium text-text-secondary mb-2">
                Upload Document (.txt) or Paste Text Below
              </label>
              <input id="file-upload" type="file" accept=".txt" onChange={handleFileChange} className="block w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-primary/20 file:text-brand-primary hover:file:bg-brand-primary/30"/>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste the full text of your paper here..."
                className="mt-2 w-full h-60 p-3 bg-base-100 border border-base-300 rounded-md focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
              />
            </div>
          ) : (
            <div>
              <label htmlFor="creative-prompt" className="block text-sm font-medium text-text-secondary mb-2">
                Creative Mode: One-Sentence Idea
              </label>
              <input
                id="creative-prompt"
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="e.g., Using AI to predict patient outcomes from MRI scans."
                className="w-full p-3 bg-base-100 border border-base-300 rounded-md focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
              />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <ModeSelector mode={imageMode} setMode={setImageMode} creativeDisabled={!isAbstractGenerated} creativeTooltip="Generate an abstract first to enable this mode." />
          {imageMode === 'standard' ? (
             <div>
               <label htmlFor="image-upload" className="block text-sm font-medium text-text-secondary mb-2">
                 Upload Image
               </label>
               <input id="image-upload" type="file" accept="image/*" onChange={handleImageFileChange} className="block w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-primary/20 file:text-brand-primary hover:file:bg-brand-primary/30"/>
                {imageState.base64 && <img src={`data:image/png;base64,${imageState.base64}`} alt="Preview" className="mt-4 rounded-lg max-h-40 object-contain"/>}
             </div>
          ) : (
             <div className="p-4 bg-base-100/50 rounded-lg text-center">
                 <SvgIcon type="info" className="mx-auto h-8 w-8 text-brand-primary mb-2"/>
                 <p className="text-text-secondary font-medium">Creative mode will generate an image based on the previously generated abstract.</p>
             </div>
          )}
          <div>
            <label htmlFor="image-specs" className="block text-sm font-medium text-text-secondary mb-2">
              Image Specifications & Guidelines
            </label>
            <textarea
              id="image-specs"
              value={imageState.specs}
              onChange={(e) => setImageState({...imageState, specs: e.target.value})}
              placeholder="e.g., 'Make this a grayscale T1-weighted MRI scan', 'Add arrows pointing to the hippocampus', 'Format as a 3x3 grid of images'."
              className="w-full h-32 p-3 bg-base-100 border border-base-300 rounded-md focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
            />
          </div>
        </div>
      )}
    </div>
  );
};

const TabButton: React.FC<{id: 'text' | 'image', activeTab: string, setActiveTab: (tab: any) => void, label: string, icon: 'text' | 'image'}> = ({ id, activeTab, setActiveTab, label, icon}) => (
  <button
    onClick={() => setActiveTab(id)}
    className={`flex items-center gap-2 text-sm font-medium py-2 px-4 rounded-t-lg transition-colors duration-200 ${
      activeTab === id
        ? 'bg-base-200 border-b-2 border-brand-primary text-brand-primary'
        : 'text-text-secondary hover:bg-base-300/50'
    }`}
  >
    <SvgIcon type={icon} className="h-5 w-5" />
    {label}
  </button>
);

const ModeSelector: React.FC<{mode: GenerationMode, setMode: (mode: GenerationMode) => void, creativeDisabled: boolean, creativeTooltip?: string}> = ({ mode, setMode, creativeDisabled, creativeTooltip}) => (
    <div className="flex bg-base-100 rounded-lg p-1">
        <ModeButton label="Standard" icon="document" active={mode === 'standard'} onClick={() => setMode('standard')} />
        <ModeButton label="Creative" icon="sparkles" active={mode === 'creative'} onClick={() => setMode('creative')} disabled={creativeDisabled} tooltip={creativeTooltip} />
    </div>
);

const ModeButton: React.FC<{label: string, icon: 'document' | 'sparkles', active: boolean, onClick: () => void, disabled?: boolean, tooltip?: string}> = ({label, icon, active, onClick, disabled=false, tooltip}) => (
    <div className="relative w-1/2 group">
        <button
            onClick={onClick}
            disabled={disabled}
            className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-semibold transition-all duration-300 ${
                active ? 'bg-brand-primary text-white shadow-md' : 'text-text-secondary hover:bg-base-200/50'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            <SvgIcon type={icon} className="h-5 w-5" />
            {label}
        </button>
        {disabled && tooltip && <span className="absolute bottom-full mb-2 w-max bg-base-300 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">{tooltip}</span>}
    </div>
);


export default ControlPanel;
