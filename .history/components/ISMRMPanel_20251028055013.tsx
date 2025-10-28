
import React, { useState, useContext } from 'react';
import { AbstractData, GenerationMode, ImageState, AnalysisResult, AbstractTypeSuggestion, AbstractType, Category } from '../types';
import * as llm from '../lib/llm'; // Use the new dispatcher
import { SvgIcon } from './SvgIcon';
import Modal from './Modal';
import OutputDisplay from './OutputDisplay';
import { fileProcessingService } from '../lib/file/FileProcessingService';
import exportService from '../services/exportService';
import { SettingsContext } from '../context/SettingsContext';

const ISMRMPanel: React.FC = () => {
  const { settings } = useContext(SettingsContext);
  
  // Global State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('Generating...');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'abstract' | 'figure'>('abstract');

  // Abstract State
  const [abstractMode, setAbstractMode] = useState<GenerationMode>('standard');
  const [inputText, setInputText] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [typeSuggestions, setTypeSuggestions] = useState<AbstractTypeSuggestion[]>([]);
  const [selectedAbstractType, setSelectedAbstractType] = useState<AbstractType | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalStep, setModalStep] = useState<'analysis' | 'type'>('analysis');
  const [generatedAbstract, setGeneratedAbstract] = useState<AbstractData | null>(null);

  // Image State
  const [imageMode, setImageMode] = useState<GenerationMode>('standard');
  const [imageState, setImageState] = useState<ImageState>({ file: null, specs: '', base64: null });
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const resetWorkflow = () => {
    setAnalysisResult(null);
    setSelectedCategories([]);
    setSelectedKeywords([]);
    setTypeSuggestions([]);
    setSelectedAbstractType(null);
    setGeneratedAbstract(null);
  }

  const handleTextChange = (text: string) => {
    setInputText(text);
    if(analysisResult) {
      resetWorkflow();
    }
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setError(null);
      
      // Clear the file input immediately to allow re-uploading the same file
      e.target.value = '';

      setIsLoading(true);
      setLoadingMessage(`📄 Processing ${file.name}...`);
      
      try {
        // Use FileProcessingService for PDF and DOCX
        const result = await fileProcessingService.processFile(file);
        
        if (result.success && result.content) {
          setInputText(result.content);
          if (analysisResult) resetWorkflow();
        } else if (result.error) {
          const errorMessage = fileProcessingService.getErrorMessage(result.error);
          setError(errorMessage + ' You can also paste text directly into the text area.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process file. Please try pasting the text directly.');
      } finally {
        setIsLoading(false);
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
        setError("Failed to read image file.");
      }
    }
  };

  const handleAnalyze = async () => {
    if (!inputText.trim()) {
        setError('Please provide input text to analyze.');
        return;
    }
    setIsLoading(true);
    setLoadingMessage('🧠 Analyzing content structure and extracting categories & keywords...');
    setError(null);
    resetWorkflow();
    try {
      const result = await llm.analyzeContent(inputText);
      setAnalysisResult(result);
      setSelectedKeywords(result.keywords);
      setModalStep('analysis');
      setIsModalOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unknown error occurred during analysis.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleAnalysisConfirmation = async (cats: Category[], keys: string[]) => {
      setSelectedCategories(cats);
      setSelectedKeywords(keys);
      setIsLoading(true);
      setLoadingMessage('🎯 Matching ISMRM guidelines and suggesting abstract types...');
      try {
        const suggestions = await llm.suggestAbstractType(inputText, cats, keys);
        setTypeSuggestions(suggestions);
        setModalStep('type');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to get abstract type suggestions.');
        setIsModalOpen(false);
      } finally {
        setIsLoading(false);
      }
  };

  const handleTypeSelection = (type: AbstractType) => {
      setSelectedAbstractType(type);
      setIsModalOpen(false);
  }

  const handleGenerateAbstract = async () => {
    if (!inputText || !selectedAbstractType || selectedCategories.length === 0 || selectedKeywords.length === 0) {
      return setError('Please complete the analysis and selection steps before generating.');
    }
    setIsLoading(true);
    setLoadingMessage('✨ Generating spec-compliant abstract...');
    setError(null);
    setGeneratedAbstract(null);
    try {
      const result = await llm.generateFinalAbstract(inputText, selectedAbstractType, selectedCategories, selectedKeywords);
      // Add categories to the result
      result.categories = selectedCategories;
      setGeneratedAbstract(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unknown error during abstract generation.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateCreative = async () => {
    if (!inputText.trim()) return setError('Please provide a core idea to expand.');
    setIsLoading(true);
    setLoadingMessage('Creatively generating abstract...');
    setError(null);
    resetWorkflow();
    try {
        const result = await llm.generateCreativeAbstract(inputText);
        setGeneratedAbstract(result);
        setSelectedKeywords(result.keywords);
    } catch (e) {
        setError(e instanceof Error ? e.message : 'An unknown error during creative generation.');
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleGenerateImage = async () => {
      let context = '';
      if (imageMode === 'creative') {
          if (!generatedAbstract) {
              return setError('Please generate an abstract first to provide context for creative image generation.');
          }
          context = `Impact: ${generatedAbstract.impact}\nSynopsis: ${generatedAbstract.synopsis}`;
      } else if (!imageState.file) {
          return setError('Please upload an image for standard mode editing.');
      }

      setIsLoading(true);
      setLoadingMessage('Generating figure...');
      setError(null);
      setGeneratedImage(null);
      try {
          const result = await llm.generateImage(imageState, context);
          setGeneratedImage(`data:image/png;base64,${result}`);
      } catch (e) {
          setError(e instanceof Error ? e.message : 'An unknown error during image generation.');
      } finally {
          setIsLoading(false);
      }
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="flex flex-col gap-6 p-4">
          <div className="flex border-b border-base-300">
            <TabButton id="abstract" activeTab={activeTab} setActiveTab={setActiveTab} label="Abstract Generation" icon="text" />
            <TabButton id="figure" activeTab={activeTab} setActiveTab={setActiveTab} label="Figure Generation" icon="image" />
          </div>

          {activeTab === 'abstract' && (
            <div className="space-y-4 animate-fade-in">
              <ModeSelector mode={abstractMode} setMode={setAbstractMode} />
              {abstractMode === 'standard' ? (
                <div className="bg-base-100 p-4 rounded-lg">
                  <label htmlFor="file-upload" className="block text-sm font-medium text-text-secondary mb-2">
                    Upload PDF/DOCX File or Paste Text
                  </label>
                  <input 
                    id="file-upload" 
                    type="file" 
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
                    onChange={handleFileChange} 
                    className="block w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-primary/20 file:text-brand-primary hover:file:bg-brand-primary/30"
                    aria-label="Upload PDF or DOCX file"
                  />
                  <div className="relative mt-2">
                    <textarea 
                      value={inputText} 
                      onChange={(e) => handleTextChange(e.target.value)} 
                      placeholder="Paste the full text of your paper here..." 
                      className="w-full h-60 p-3 bg-base-100 border border-base-300 rounded-md focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
                      aria-label="Input text for abstract generation"
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-base-100 p-4 rounded-lg">
                  <label htmlFor="creative-prompt" className="block text-sm font-medium text-text-secondary mb-2">
                    Creative Expansion: One-Sentence Idea
                  </label>
                  <input id="creative-prompt" type="text" value={inputText} onChange={(e) => handleTextChange(e.target.value)} placeholder="e.g., Using AI to predict patient outcomes from MRI scans." className="w-full p-3 bg-base-100 border border-base-300 rounded-md focus:ring-2 focus:ring-brand-primary focus:outline-none transition" />
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-4">
                {abstractMode === 'standard' ? (
                  <>
                    <button 
                      onClick={handleAnalyze} 
                      disabled={isLoading || !inputText.trim()} 
                      className="flex-1 flex items-center justify-center gap-2 bg-base-300 hover:bg-opacity-80 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-base-300/50 disabled:cursor-not-allowed focus:outline-none focus:ring-3 focus:ring-brand-primary"
                      aria-label="Analyze content to extract categories and keywords"
                    >
                      <SvgIcon type="sparkles" className="h-5 w-5" />1. Analyze
                    </button>
                    <button 
                      onClick={handleGenerateAbstract} 
                      disabled={isLoading || !selectedAbstractType} 
                      className="flex-1 flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-base-300/50 disabled:cursor-not-allowed focus:outline-none focus:ring-3 focus:ring-brand-primary"
                      aria-label="Generate spec-compliant abstract"
                    >
                      <SvgIcon type="document" className="h-5 w-5" />2. Generate
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={handleGenerateCreative} 
                    disabled={isLoading || !inputText.trim()} 
                    className="w-full flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-base-300/50 disabled:cursor-not-allowed focus:outline-none focus:ring-3 focus:ring-brand-primary"
                    aria-label="Generate creative abstract from core idea"
                  >
                    <SvgIcon type="sparkles" className="h-5 w-5" />Generate Creatively
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'figure' && (
            <div className="space-y-4 animate-fade-in">
                <ImageModeSelector mode={imageMode} setMode={setImageMode} creativeDisabled={!generatedAbstract} creativeTooltip="Generate an abstract first to enable this mode." />
                 {imageMode === 'standard' ? (
                    <div className="bg-base-100 p-4 rounded-lg">
                        <label htmlFor="image-upload" className="block text-sm font-medium text-text-secondary mb-2">Upload Image</label>
                        <input id="image-upload" type="file" accept="image/*" onChange={handleImageFileChange} className="block w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-primary/20 file:text-brand-primary hover:file:bg-brand-primary/30"/>
                        {imageState.base64 && <img src={`data:image/png;base64,${imageState.base64}`} alt="Preview" className="mt-4 rounded-lg max-h-40 object-contain mx-auto"/>}
                    </div>
                ) : (
                    <div className="p-4 bg-base-100/50 rounded-lg text-center">
                        <SvgIcon type="info" className="mx-auto h-8 w-8 text-brand-primary mb-2"/>
                        <p className="text-text-secondary font-medium">Creative mode will generate a figure based on the content of your generated abstract.</p>
                    </div>
                )}
                <div className="bg-base-100 p-4 rounded-lg">
                    <label htmlFor="image-specs" className="block text-sm font-medium text-text-secondary mb-2">Image Specifications & Guidelines</label>
                    <textarea id="image-specs" value={imageState.specs} onChange={(e) => setImageState({...imageState, specs: e.target.value})} placeholder="e.g., 'Make this a grayscale T1-weighted MRI scan', 'Add arrows pointing to the hippocampus', 'Format as a 3x3 grid'." className="w-full h-32 p-3 bg-base-100 border border-base-300 rounded-md focus:ring-2 focus:ring-brand-primary focus:outline-none transition"/>
                </div>
                <button 
                  onClick={handleGenerateImage} 
                  disabled={isLoading} 
                  className="w-full flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-base-300/50 disabled:cursor-not-allowed focus:outline-none focus:ring-3 focus:ring-brand-primary"
                  aria-label="Generate figure based on specifications"
                >
                  <SvgIcon type="image" className="h-5 w-5" />Generate Figure
                </button>
            </div>
          )}
        </div>
        <OutputDisplay abstract={generatedAbstract} image={generatedImage} isLoading={isLoading} error={error} loadingMessage={loadingMessage} />
      </div>
      
      {isModalOpen && analysisResult && (
        <Modal onClose={() => setIsModalOpen(false)}>
            {modalStep === 'analysis' ? (<AnalysisStep result={analysisResult} onConfirm={handleAnalysisConfirmation} />) : (<TypeSuggestionStep suggestions={typeSuggestions} onSelect={handleTypeSelection} />)}
        </Modal>
      )}
    </>
  );
};

// --- Local Components for ISMRMPanel ---

const TabButton: React.FC<{id: 'abstract' | 'figure', activeTab: string, setActiveTab: (tab: any) => void, label: string, icon: 'text' | 'image'}> = ({ id, activeTab, setActiveTab, label, icon}) => (
  <button onClick={() => setActiveTab(id)} className={`flex items-center gap-2 text-sm font-medium py-2 px-4 rounded-t-lg transition-colors duration-200 focus:outline-none ${activeTab === id ? 'border-b-2 border-brand-primary text-brand-primary' : 'text-text-secondary hover:bg-base-300/50'}`}>
    <SvgIcon type={icon} className="h-5 w-5" />{label}
  </button>
);

const ModeSelector: React.FC<{mode: GenerationMode, setMode: (mode: GenerationMode) => void}> = ({ mode, setMode }) => (
    <div className="flex bg-base-100 rounded-lg p-1">
        <ModeButton label="Standard Analysis" icon="document" active={mode === 'standard'} onClick={() => setMode('standard')} />
        <ModeButton label="Creative Expansion" icon="sparkles" active={mode === 'creative'} onClick={() => setMode('creative')} />
    </div>
);

const ImageModeSelector: React.FC<{mode: GenerationMode, setMode: (mode: GenerationMode) => void, creativeDisabled: boolean, creativeTooltip?: string}> = ({ mode, setMode, creativeDisabled, creativeTooltip}) => (
    <div className="flex bg-base-100 rounded-lg p-1">
        <ModeButton label="Standard Edit" icon="document" active={mode === 'standard'} onClick={() => setMode('standard')} />
        <ModeButton label="Creative Generation" icon="sparkles" active={mode === 'creative'} onClick={() => setMode('creative')} disabled={creativeDisabled} tooltip={creativeTooltip} />
    </div>
);

const ModeButton: React.FC<{label: string, icon: 'document' | 'sparkles', active: boolean, onClick: () => void, disabled?: boolean, tooltip?: string}> = ({label, icon, active, onClick, disabled=false, tooltip}) => (
    <div className="relative w-1/2 group">
        <button onClick={onClick} disabled={disabled} className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-semibold transition-all duration-300 ${active ? 'bg-brand-primary text-white shadow-md' : 'text-text-secondary hover:bg-base-200/50'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <SvgIcon type={icon} className="h-5 w-5" />{label}
        </button>
        {disabled && tooltip && <span className="absolute bottom-full z-10 mb-2 w-max bg-base-300 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">{tooltip}</span>}
    </div>
);

const AnalysisStep: React.FC<{result: AnalysisResult, onConfirm: (cats: Category[], keys: string[]) => void}> = ({result, onConfirm}) => {
    const [selectedCats, setSelectedCats] = useState<Category[]>(result.categories.filter(c => c.probability > 0.25));
    const [selectedKeys, setSelectedKeys] = useState<string[]>(result.keywords);
    const toggleCategory = (cat: Category) => setSelectedCats(prev => prev.some(c => c.name === cat.name) ? prev.filter(c => c.name !== cat.name) : [...prev, cat]);
    const toggleKeyword = (key: string) => setSelectedKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    const catColorMap = { main: 'bg-category-main/20 text-category-main', sub: 'bg-category-sub/20 text-category-sub', secondary: 'bg-category-secondary/20 text-category-secondary' };
    const catBorderColorMap = { main: 'border-category-main', sub: 'border-category-sub', secondary: 'border-category-secondary' };
    
    const handleKeyDown = (e: React.KeyboardEvent, callback: () => void) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            callback();
        }
    };
    
    return (
        <div className="space-y-4" role="dialog" aria-labelledby="analysis-title" aria-describedby="analysis-description">
            <h2 id="analysis-title" className="text-xl font-bold text-text-primary">Analysis Complete</h2>
            <p id="analysis-description" className="text-text-secondary">Please review and confirm the suggested categories and keywords for your abstract.</p>
            <div>
                <h3 className="font-semibold mb-2">Suggested Categories</h3>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Category selection">
                    {result.categories.filter(c => c.probability > 0.25).map(cat => (
                        <button 
                            key={cat.name} 
                            onClick={() => toggleCategory(cat)}
                            onKeyDown={(e) => handleKeyDown(e, () => toggleCategory(cat))}
                            className={`px-3 py-1 text-sm font-medium rounded-full border-2 transition-all focus:outline-none focus:ring-3 focus:ring-brand-primary ${selectedCats.some(c => c.name === cat.name) ? ` ${catBorderColorMap[cat.type]} ${catColorMap[cat.type]} ` : 'border-base-300 bg-base-100 hover:border-brand-primary'}`}
                            role="checkbox"
                            aria-checked={selectedCats.some(c => c.name === cat.name)}
                            aria-label={`${cat.name} (${cat.type} category, ${Math.round(cat.probability * 100)}% match)`}
                        >
                            {cat.name} <span className="text-xs opacity-70">({cat.type})</span>
                        </button>
                    ))}
                </div>
            </div>
            <div>
                <h3 className="font-semibold mb-2">Suggested Keywords</h3>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Keyword selection">
                    {result.keywords.map(key => (
                        <button 
                            key={key} 
                            onClick={() => toggleKeyword(key)}
                            onKeyDown={(e) => handleKeyDown(e, () => toggleKeyword(key))}
                            className={`px-3 py-1 text-sm rounded-full border-2 transition-all focus:outline-none focus:ring-3 focus:ring-brand-primary ${selectedKeys.includes(key) ? 'border-brand-primary bg-brand-primary/20 text-brand-primary' : 'border-base-300 bg-base-100 hover:border-brand-primary'}`}
                            role="checkbox"
                            aria-checked={selectedKeys.includes(key)}
                            aria-label={`Keyword: ${key}`}
                        >
                            {key}
                        </button>
                    ))}
                </div>
            </div>
            <button 
                onClick={() => onConfirm(selectedCats, selectedKeys)} 
                className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg mt-4 focus:outline-none focus:ring-3 focus:ring-brand-primary"
                aria-label="Confirm category and keyword selections and proceed to abstract type suggestion"
            >
                Confirm Selections & Proceed
            </button>
        </div>
    );
}

const TypeSuggestionStep: React.FC<{suggestions: AbstractTypeSuggestion[], onSelect: (type: AbstractType) => void}> = ({suggestions, onSelect}) => (
    <div className="space-y-4"><h2 className="text-xl font-bold text-text-primary">Recommended Abstract Type</h2><p className="text-text-secondary">Based on your content, we recommend the following abstract types. Please select one to proceed.</p><div className="space-y-2">{suggestions.map(suggestion => (<button key={suggestion.type} onClick={() => onSelect(suggestion.type)} className="w-full text-left p-3 bg-base-100 hover:bg-base-300/50 border border-base-300 rounded-lg transition-all"><div className="flex justify-between items-center"><span className="font-semibold text-text-primary">{suggestion.type}</span><span className="text-xs font-mono px-2 py-1 bg-brand-primary/20 text-brand-primary rounded">{`${(suggestion.probability * 100).toFixed(0)}% match`}</span></div></button>))}</div></div>
);

export default ISMRMPanel;
