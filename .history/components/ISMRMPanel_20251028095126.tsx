
import React, { useState, useContext } from 'react';
import { AbstractData, GenerationMode, ImageState, AnalysisResult, AbstractTypeSuggestion, AbstractType, Category } from '../types';
import * as llm from '../lib/llm'; // Use the new dispatcher
import { SvgIcon } from './SvgIcon';
import Modal from './Modal';
import OutputDisplay from './OutputDisplay';
import { fileProcessingService } from '../lib/file/FileProcessingService';
import { SettingsContext } from '../context/SettingsContext';

const ISMRMPanel: React.FC = () => {
  const { databaseService, settings } = useContext(SettingsContext);
  
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
  const [impact, setImpact] = useState<string>('');
  const [synopsis, setSynopsis] = useState<string>('');
  const [typeSuggestions, setTypeSuggestions] = useState<AbstractTypeSuggestion[]>([]);
  const [selectedAbstractType, setSelectedAbstractType] = useState<AbstractType | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalStep, setModalStep] = useState<'analysis' | 'impactSynopsis' | 'type'>('analysis');
  const [generatedAbstract, setGeneratedAbstract] = useState<AbstractData | null>(null);

  // Image State
  const [imageMode, setImageMode] = useState<GenerationMode>('standard');
  const [imageState, setImageState] = useState<ImageState>({ file: null, specs: '', base64: null });
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const resetWorkflow = () => {
    setAnalysisResult(null);
    setSelectedCategories([]);
    setSelectedKeywords([]);
    setImpact('');
    setSynopsis('');
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
    setError(null);
    resetWorkflow();
    
    try {
      // Step 1: Analyze content
      setLoadingMessage('🔍 Analyzing content...');
      const result = await llm.analyzeContent(inputText);
      setAnalysisResult(result);
      setSelectedCategories(result.categories.filter(c => c.probability > 0.25));
      setSelectedKeywords(result.keywords);
      
      // Step 2: Generate Impact & Synopsis
      setLoadingMessage('📝 Generating impact & synopsis...');
      const impactSynopsisResult = await llm.generateFinalAbstract(
        inputText, 
        'Standard Abstract', 
        result.categories.filter(c => c.probability > 0.25), 
        result.keywords
      );
      setImpact(impactSynopsisResult.impact);
      setSynopsis(impactSynopsisResult.synopsis);
      
      // Step 3: Suggest abstract types
      setLoadingMessage('🎯 Suggesting abstract types...');
      const suggestions = await llm.suggestAbstractType(inputText, result.categories, result.keywords);
      setTypeSuggestions(suggestions);
      
      // Open modal to show results
      setModalStep('analysis');
      setIsModalOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unknown error occurred during analysis.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleAnalysisConfirmation = (cats: Category[], keys: string[], impactText: string, synopsisText: string) => {
      setSelectedCategories(cats);
      setSelectedKeywords(keys);
      setImpact(impactText);
      setSynopsis(synopsisText);
      setModalStep('type');
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
      // Use the generated impact/synopsis or keep the edited ones
      result.impact = impact || result.impact;
      result.synopsis = synopsis || result.synopsis;
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
    setLoadingMessage('✨ Creatively generating abstract...');
    setError(null);
    resetWorkflow();
    try {
        const result = await llm.generateCreativeAbstract(inputText);
        setImpact(result.impact);
        setSynopsis(result.synopsis);
        setSelectedKeywords(result.keywords);
        setSelectedAbstractType('Standard Abstract');
        setGeneratedAbstract(result);
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

  const handleSaveAbstract = async () => {
    if (!generatedAbstract) return;
    
    try {
      const title = prompt('Enter a title for this abstract:');
      if (!title) return;
      
      await databaseService.saveAbstract({
        title,
        conference: 'ISMRM',
        abstractType: selectedAbstractType || 'Standard Abstract',
        abstractData: generatedAbstract,
        originalText: inputText,
        categories: selectedCategories,
        keywords: selectedKeywords,
        generationParameters: {
          provider: settings.provider,
          model: settings.model || 'gemini-2.5-pro',
          categories: selectedCategories,
          keywords: selectedKeywords,
          abstractType: selectedAbstractType || undefined,
        }
      });
      
      alert('Abstract saved successfully!');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save abstract');
    }
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear all data? This will reset the workflow.')) {
      setInputText('');
      resetWorkflow();
      setGeneratedImage(null);
      setImageState({ file: null, specs: '', base64: null });
      setError(null);
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
              <div className="space-y-3">
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
                
                {/* Save and Clear buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleSaveAbstract}
                    disabled={!generatedAbstract || isLoading}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 disabled:bg-base-300/50 disabled:cursor-not-allowed"
                    title="Save abstract to Abstract Manager"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                    </svg>
                    Save
                  </button>
                  <button
                    onClick={handleClear}
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 disabled:bg-base-300/50 disabled:cursor-not-allowed"
                    title="Clear all data and reset"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    Clear
                  </button>
                </div>
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
        <OutputDisplay 
          abstract={generatedAbstract}
          impact={impact}
          synopsis={synopsis}
          categories={selectedCategories}
          keywords={selectedKeywords}
          image={generatedImage} 
          isLoading={isLoading} 
          error={error} 
          loadingMessage={loadingMessage}
          conference="ISMRM"
          abstractType={selectedAbstractType || undefined}
        />
      </div>
      
      {isModalOpen && analysisResult && (
        <Modal onClose={() => setIsModalOpen(false)}>
            {modalStep === 'analysis' ? (
              <AnalysisStep 
                result={analysisResult} 
                impact={impact}
                synopsis={synopsis}
                onConfirm={handleAnalysisConfirmation} 
              />
            ) : (
              <TypeSuggestionStep suggestions={typeSuggestions} onSelect={handleTypeSelection} />
            )}
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

const AnalysisStep: React.FC<{
  result: AnalysisResult, 
  impact: string,
  synopsis: string,
  onConfirm: (cats: Category[], keys: string[], impact: string, synopsis: string) => void
}> = ({result, impact: initialImpact, synopsis: initialSynopsis, onConfirm}) => {
    const [selectedCats, setSelectedCats] = useState<Category[]>(result.categories.filter(c => c.probability > 0.25));
    const [selectedKeys, setSelectedKeys] = useState<string[]>(result.keywords);
    const [impact, setImpact] = useState<string>(initialImpact);
    const [synopsis, setSynopsis] = useState<string>(initialSynopsis);
    
    const toggleCategory = (cat: Category) => setSelectedCats(prev => prev.some(c => c.name === cat.name) ? prev.filter(c => c.name !== cat.name) : [...prev, cat]);
    const toggleKeyword = (key: string) => setSelectedKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    const catColorMap = { main: 'bg-category-main/20 text-category-main', sub: 'bg-category-sub/20 text-category-sub', secondary: 'bg-category-secondary/20 text-category-secondary' };
    const catBorderColorMap = { main: 'border-category-main', sub: 'border-category-sub', secondary: 'border-category-secondary' };
    
    const countWords = (text: string) => text.trim().split(/\s+/).filter(w => w.length > 0).length;
    const impactWordCount = countWords(impact);
    const synopsisWordCount = countWords(synopsis);
    
    const handleKeyDown = (e: React.KeyboardEvent, callback: () => void) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            callback();
        }
    };
    
    return (
        <div className="space-y-4 max-h-[80vh] overflow-y-auto">
            <h2 id="analysis-title" className="text-xl font-bold text-text-primary">Analysis Complete ✨</h2>
            <p id="analysis-description" className="text-text-secondary">Review and edit the generated content, then select categories and keywords.</p>
            
            {/* Impact Section */}
            <div>
                <label htmlFor="impact-input" className="font-semibold mb-2 block text-blue-600">
                    Impact Statement (40 words)
                </label>
                <textarea
                    id="impact-input"
                    value={impact}
                    onChange={(e) => setImpact(e.target.value)}
                    className="w-full p-3 border-2 border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary min-h-[100px] bg-base-100"
                    aria-describedby="impact-word-count"
                />
                <div 
                    id="impact-word-count" 
                    className={`text-sm mt-1 ${impactWordCount > 40 ? 'text-red-500' : 'text-green-600'}`}
                >
                    {impactWordCount} / 40 words
                </div>
            </div>
            
            {/* Synopsis Section */}
            <div>
                <label htmlFor="synopsis-input" className="font-semibold mb-2 block text-green-600">
                    Synopsis (100 words)
                </label>
                <textarea
                    id="synopsis-input"
                    value={synopsis}
                    onChange={(e) => setSynopsis(e.target.value)}
                    className="w-full p-3 border-2 border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary min-h-[150px] bg-base-100"
                    aria-describedby="synopsis-word-count"
                />
                <div 
                    id="synopsis-word-count" 
                    className={`text-sm mt-1 ${synopsisWordCount > 100 ? 'text-red-500' : 'text-green-600'}`}
                >
                    {synopsisWordCount} / 100 words
                </div>
            </div>
            
            {/* Categories Section */}
            <div>
                <h3 id="categories-heading" className="font-semibold mb-2 text-purple-600">Categories (sorted by probability)</h3>
                <div 
                    className="flex flex-wrap gap-2" 
                    role="group" 
                    aria-labelledby="categories-heading"
                    aria-describedby="categories-help"
                >
                    {result.categories
                        .sort((a, b) => b.probability - a.probability)
                        .filter(c => c.probability > 0.25)
                        .map(cat => (
                        <button 
                            key={cat.name} 
                            onClick={() => toggleCategory(cat)}
                            onKeyDown={(e) => handleKeyDown(e, () => toggleCategory(cat))}
                            className={`px-3 py-1 text-sm font-medium rounded-full border-2 transition-all focus:outline-none focus:ring-3 focus:ring-brand-primary min-h-[36px] ${selectedCats.some(c => c.name === cat.name) ? ` ${catBorderColorMap[cat.type]} ${catColorMap[cat.type]} ` : 'border-base-300 bg-base-100 hover:border-brand-primary'}`}
                            role="checkbox"
                            aria-checked={selectedCats.some(c => c.name === cat.name)}
                            aria-label={`${cat.name} (${cat.type} category, ${Math.round(cat.probability * 100)}% match)`}
                            tabIndex={0}
                        >
                            {cat.name} <span className="text-xs opacity-70">{Math.round(cat.probability * 100)}%</span>
                        </button>
                    ))}
                </div>
                <p id="categories-help" className="sr-only">Use Enter or Space to toggle category selection</p>
            </div>
            
            {/* Keywords Section */}
            <div>
                <h3 id="keywords-heading" className="font-semibold mb-2 text-orange-600">Keywords</h3>
                <div 
                    className="flex flex-wrap gap-2" 
                    role="group" 
                    aria-labelledby="keywords-heading"
                    aria-describedby="keywords-help"
                >
                    {result.keywords.map(key => (
                        <button 
                            key={key} 
                            onClick={() => toggleKeyword(key)}
                            onKeyDown={(e) => handleKeyDown(e, () => toggleKeyword(key))}
                            className={`px-3 py-1 text-sm rounded-full border-2 transition-all focus:outline-none focus:ring-3 focus:ring-brand-primary min-h-[36px] ${selectedKeys.includes(key) ? 'border-brand-primary bg-brand-primary/20 text-brand-primary' : 'border-base-300 bg-base-100 hover:border-brand-primary'}`}
                            role="checkbox"
                            aria-checked={selectedKeys.includes(key)}
                            aria-label={`Keyword: ${key}`}
                            tabIndex={0}
                        >
                            {key}
                        </button>
                    ))}
                </div>
                <p id="keywords-help" className="sr-only">Use Enter or Space to toggle keyword selection</p>
            </div>
            
            <button 
                onClick={() => onConfirm(selectedCats, selectedKeys, impact, synopsis)} 
                className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg mt-4 focus:outline-none focus:ring-3 focus:ring-brand-primary min-h-[44px]"
                aria-label="Confirm selections and view abstract type suggestions"
                tabIndex={0}
            >
                Confirm & View Abstract Types
            </button>
        </div>
    );
}

const TypeSuggestionStep: React.FC<{suggestions: AbstractTypeSuggestion[], onSelect: (type: AbstractType) => void}> = ({suggestions, onSelect}) => {
    const [selectedIndex, setSelectedIndex] = React.useState(0);
    
    const handleKeyDown = (e: React.KeyboardEvent, type: AbstractType, index: number) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(type);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextIndex = Math.min(index + 1, suggestions.length - 1);
            setSelectedIndex(nextIndex);
            // Focus next element
            const nextButton = e.currentTarget.parentElement?.children[nextIndex] as HTMLButtonElement;
            nextButton?.focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevIndex = Math.max(index - 1, 0);
            setSelectedIndex(prevIndex);
            // Focus previous element
            const prevButton = e.currentTarget.parentElement?.children[prevIndex] as HTMLButtonElement;
            prevButton?.focus();
        }
    };
    
    return (
        <div className="space-y-4">
            <h2 id="type-suggestion-title" className="text-xl font-bold text-text-primary">Recommended Abstract Type</h2>
            <p id="type-suggestion-description" className="text-text-secondary">Based on your content, we recommend the following abstract types. Please select one to proceed.</p>
            <p className="sr-only">Use arrow keys to navigate between options, Enter or Space to select</p>
            <div 
                className="space-y-2" 
                role="radiogroup" 
                aria-labelledby="type-suggestion-title"
                aria-describedby="type-suggestion-description"
            >
                {suggestions.map((suggestion, index) => (
                    <button 
                        key={suggestion.type} 
                        onClick={() => onSelect(suggestion.type)}
                        onKeyDown={(e) => handleKeyDown(e, suggestion.type, index)}
                        className="w-full text-left p-3 bg-base-100 hover:bg-base-300/50 border border-base-300 rounded-lg transition-all focus:outline-none focus:ring-3 focus:ring-brand-primary min-h-[44px]"
                        role="radio"
                        aria-checked={selectedIndex === index}
                        aria-label={`${suggestion.type} with ${(suggestion.probability * 100).toFixed(0)}% match probability`}
                        tabIndex={0}
                    >
                        <div className="flex justify-between items-center">
                            <span className="font-semibold text-text-primary">{suggestion.type}</span>
                            <span className="text-xs font-mono px-2 py-1 bg-brand-primary/20 text-brand-primary rounded">{`${(suggestion.probability * 100).toFixed(0)}% match`}</span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default ISMRMPanel;
