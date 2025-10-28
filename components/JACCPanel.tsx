import React, { useState, useCallback, useContext, useEffect } from 'react';
import { AbstractData, GenerationMode, ImageState, AnalysisResult, AbstractTypeSuggestion, AbstractType, Category, SavedAbstract } from '../types';
import * as llm from '../lib/llm';
import { SvgIcon } from './SvgIcon';
import Modal from './Modal';
import OutputDisplay from './OutputDisplay';
import { SettingsContext } from '../context/SettingsContext';
import { useAbstractContext } from '../context/AbstractContext';

const JACCPanel: React.FC = () => {
  // Global State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('Generating...');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'abstract' | 'figure'>('abstract');
  const [currentAbstractId, setCurrentAbstractId] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [saveTitle, setSaveTitle] = useState<string>('');
  
  const { databaseService } = useContext(SettingsContext);
  const { abstractToLoad, clearLoadedAbstract } = useAbstractContext();

  // Handle loading abstracts from the context
  useEffect(() => {
    if (abstractToLoad && abstractToLoad.conference === 'JACC') {
      loadAbstractData(abstractToLoad);
      clearLoadedAbstract();
    }
  }, [abstractToLoad]);

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
        resolve(result.split(',')[1]);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setError(null);
      
      e.target.value = '';

      setIsLoading(true);
      setLoadingMessage(`Processing ${file.name}...`);
      
      try {
        if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
          const text = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target?.result as string);
            reader.onerror = (err) => reject(err);
            reader.readAsText(file);
          });
          setInputText(text);
          if (analysisResult) resetWorkflow();
        } else {
          const { fileProcessingService } = await import('../lib/file/FileProcessingService');
          const result = await fileProcessingService.processFile(file);
          
          if (result.success && result.content) {
            setInputText(result.content);
            if (analysisResult) resetWorkflow();
          } else if (result.error) {
            setError(fileProcessingService.getErrorMessage(result.error));
          } else {
            setError('Failed to extract text from the file.');
          }
        }
      } catch (err) {
        console.error('File processing error:', err);
        setError(err instanceof Error ? err.message : 'Failed to process file.');
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
    setLoadingMessage('Analyzing content for JACC submission...');
    setError(null);
    resetWorkflow();
    try {
      // Use JACC-specific analysis
      const result = await llm.analyzeContentForConference(inputText, 'JACC');
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
    setLoadingMessage('Suggesting JACC abstract types...');
    try {
      // For JACC, we typically use Scientific Abstract type
      const suggestions: AbstractTypeSuggestion[] = [
        { type: 'JACC Scientific Abstract', probability: 1.0 }
      ];
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
    setLoadingMessage('Generating JACC scientific abstract...');
    setError(null);
    setGeneratedAbstract(null);
    try {
      const result = await llm.generateAbstractForConference(
        inputText, 
        selectedAbstractType, 
        selectedCategories, 
        selectedKeywords,
        'JACC'
      );
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
    setLoadingMessage('Creatively generating JACC abstract...');
    setError(null);
    resetWorkflow();
    try {
      const result = await llm.generateCreativeAbstractForConference(inputText, 'JACC');
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
    setLoadingMessage('Generating cardiovascular figure...');
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
    if (!generatedAbstract || !selectedAbstractType) {
      setError('Please generate an abstract before saving.');
      return;
    }

    if (!saveTitle.trim()) {
      setError('Please enter a title for your abstract.');
      return;
    }

    try {
      setIsLoading(true);
      setLoadingMessage('Saving abstract...');

      const abstractToSave = {
        title: saveTitle.trim(),
        conference: 'JACC' as const,
        abstractType: selectedAbstractType,
        abstractData: generatedAbstract,
        originalText: inputText,
        categories: selectedCategories,
        keywords: selectedKeywords
      };

      if (currentAbstractId) {
        await databaseService.updateAbstract(currentAbstractId, abstractToSave);
      } else {
        const id = await databaseService.saveAbstract(abstractToSave);
        setCurrentAbstractId(id);
      }

      setShowSaveModal(false);
      setSaveTitle('');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save abstract');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAbstractData = (abstract: SavedAbstract) => {
    setInputText(abstract.originalText);
    setGeneratedAbstract(abstract.abstractData);
    setSelectedCategories(abstract.categories);
    setSelectedKeywords(abstract.keywords);
    setSelectedAbstractType(abstract.abstractType);
    setCurrentAbstractId(abstract.id);
    setSaveTitle(abstract.title);
    
    setAnalysisResult({
      categories: abstract.categories,
      keywords: abstract.keywords
    });
  };

  const handleNewAbstract = () => {
    setInputText('');
    setCurrentAbstractId(null);
    setSaveTitle('');
    resetWorkflow();
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
                    Upload File (.txt, .pdf, .docx) or Paste Text
                  </label>
                  <input 
                    id="file-upload" 
                    type="file" 
                    accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
                    onChange={handleFileChange} 
                    className="block w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-primary/20 file:text-brand-primary hover:file:bg-brand-primary/30"
                  />
                  <div className="relative mt-2">
                    <textarea 
                      value={inputText} 
                      onChange={(e) => handleTextChange(e.target.value)} 
                      placeholder="Paste your cardiovascular research paper or study details here for JACC abstract generation..." 
                      className="w-full h-60 p-3 bg-base-100 border border-base-300 rounded-md focus:ring-2 focus:ring-brand-primary focus:outline-none transition" 
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-base-100 p-4 rounded-lg">
                  <label htmlFor="creative-prompt" className="block text-sm font-medium text-text-secondary mb-2">
                    Creative Expansion: Cardiovascular Research Idea for JACC
                  </label>
                  <input 
                    id="creative-prompt" 
                    type="text" 
                    value={inputText} 
                    onChange={(e) => handleTextChange(e.target.value)} 
                    placeholder="e.g., Novel biomarker for predicting heart failure outcomes in diabetic patients." 
                    className="w-full p-3 bg-base-100 border border-base-300 rounded-md focus:ring-2 focus:ring-brand-primary focus:outline-none transition" 
                  />
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-4">
                {abstractMode === 'standard' ? (
                  <>
                    <button 
                      onClick={handleAnalyze} 
                      disabled={isLoading || !inputText.trim()} 
                      className="flex-1 flex items-center justify-center gap-2 bg-base-300 hover:bg-opacity-80 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-base-300/50 disabled:cursor-not-allowed"
                    >
                      <SvgIcon type="sparkles" className="h-5 w-5" />
                      1. Analyze for JACC
                    </button>
                    <button 
                      onClick={handleGenerateAbstract} 
                      disabled={isLoading || !selectedAbstractType} 
                      className="flex-1 flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-base-300/50 disabled:cursor-not-allowed"
                    >
                      <SvgIcon type="document" className="h-5 w-5" />
                      2. Generate
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={handleGenerateCreative} 
                    disabled={isLoading || !inputText.trim()} 
                    className="w-full flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-base-300/50 disabled:cursor-not-allowed"
                  >
                    <SvgIcon type="sparkles" className="h-5 w-5" />
                    Generate Creatively
                  </button>
                )}
              </div>
              
              {generatedAbstract && (
                <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-base-300">
                  <button 
                    onClick={() => {
                      setSaveTitle(currentAbstractId ? saveTitle : `JACC Abstract - ${new Date().toLocaleDateString()}`);
                      setShowSaveModal(true);
                    }} 
                    disabled={isLoading} 
                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-base-300/50 disabled:cursor-not-allowed"
                  >
                    <SvgIcon type="download" className="h-5 w-5" />
                    {currentAbstractId ? 'Update' : 'Save'} Abstract
                  </button>
                  <button 
                    onClick={handleNewAbstract} 
                    disabled={isLoading} 
                    className="flex-1 flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-base-300/50 disabled:cursor-not-allowed"
                  >
                    <SvgIcon type="document" className="h-5 w-5" />
                    New Abstract
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'figure' && (
            <div className="space-y-4 animate-fade-in">
              <ImageModeSelector mode={imageMode} setMode={setImageMode} creativeDisabled={!generatedAbstract} creativeTooltip="Generate an abstract first to enable this mode." />
              {imageMode === 'standard' ? (
                <div className="bg-base-100 p-4 rounded-lg">
                  <label htmlFor="image-upload" className="block text-sm font-medium text-text-secondary mb-2">Upload Cardiovascular Image</label>
                  <input 
                    id="image-upload" 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageFileChange} 
                    className="block w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-primary/20 file:text-brand-primary hover:file:bg-brand-primary/30"
                  />
                  {imageState.base64 && (
                    <img 
                      src={`data:image/png;base64,${imageState.base64}`} 
                      alt="Preview" 
                      className="mt-4 rounded-lg max-h-40 object-contain mx-auto"
                    />
                  )}
                </div>
              ) : (
                <div className="p-4 bg-base-100/50 rounded-lg text-center">
                  <SvgIcon type="info" className="mx-auto h-8 w-8 text-brand-primary mb-2"/>
                  <p className="text-text-secondary font-medium">Creative mode will generate a cardiovascular figure based on your JACC abstract content.</p>
                </div>
              )}
              <div className="bg-base-100 p-4 rounded-lg">
                <label htmlFor="image-specs" className="block text-sm font-medium text-text-secondary mb-2">Image Specifications & Guidelines</label>
                <textarea 
                  id="image-specs" 
                  value={imageState.specs} 
                  onChange={(e) => setImageState({...imageState, specs: e.target.value})} 
                  placeholder="e.g., 'Highlight coronary arteries', 'Add ejection fraction measurements', 'Create before/after comparison'." 
                  className="w-full h-32 p-3 bg-base-100 border border-base-300 rounded-md focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
                />
              </div>
              <button 
                onClick={handleGenerateImage} 
                disabled={isLoading} 
                className="w-full flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-base-300/50 disabled:cursor-not-allowed"
              >
                <SvgIcon type="image" className="h-5 w-5" />
                Generate Figure
              </button>
            </div>
          )}
        </div>
        <OutputDisplay 
          abstract={generatedAbstract} 
          image={generatedImage} 
          isLoading={isLoading} 
          error={error} 
          loadingMessage={loadingMessage}
          conference="JACC"
          abstractType={selectedAbstractType || 'JACC Scientific Abstract'}
        />
      </div>
      
      {isModalOpen && analysisResult && (
        <Modal onClose={() => setIsModalOpen(false)}>
          {modalStep === 'analysis' ? (
            <JACCAnalysisStep result={analysisResult} onConfirm={handleAnalysisConfirmation} />
          ) : (
            <TypeSuggestionStep suggestions={typeSuggestions} onSelect={handleTypeSelection} />
          )}
        </Modal>
      )}

      {showSaveModal && (
        <Modal onClose={() => setShowSaveModal(false)}>
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-text-primary">
              {currentAbstractId ? 'Update Abstract' : 'Save Abstract'}
            </h2>
            <p className="text-text-secondary">
              {currentAbstractId ? 'Update the title for your JACC abstract.' : 'Enter a title for your JACC abstract to save it for later use.'}
            </p>
            <div>
              <label htmlFor="save-title" className="block text-sm font-medium text-text-secondary mb-2">
                Abstract Title
              </label>
              <input
                id="save-title"
                type="text"
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                placeholder="Enter a descriptive title..."
                className="w-full p-3 bg-base-100 border border-base-300 rounded-md focus:ring-2 focus:ring-brand-primary focus:outline-none transition"
                autoFocus
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-text-secondary border border-base-300 rounded-md hover:bg-base-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAbstract}
                disabled={!saveTitle.trim() || isLoading}
                className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-secondary transition-colors disabled:bg-base-300/50 disabled:cursor-not-allowed"
              >
                {currentAbstractId ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

// Local Components for JACCPanel
const TabButton: React.FC<{id: 'abstract' | 'figure', activeTab: string, setActiveTab: (tab: any) => void, label: string, icon: 'text' | 'image'}> = ({ id, activeTab, setActiveTab, label, icon}) => (
  <button 
    onClick={() => setActiveTab(id)} 
    className={`flex items-center gap-2 text-sm font-medium py-2 px-4 rounded-t-lg transition-colors duration-200 focus:outline-none ${
      activeTab === id 
        ? 'border-b-2 border-brand-primary text-brand-primary' 
        : 'text-text-secondary hover:bg-base-300/50'
    }`}
  >
    <SvgIcon type={icon} className="h-5 w-5" />
    {label}
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
    <button 
      onClick={onClick} 
      disabled={disabled} 
      className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-semibold transition-all duration-300 ${
        active 
          ? 'bg-brand-primary text-white shadow-md' 
          : 'text-text-secondary hover:bg-base-200/50'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <SvgIcon type={icon} className="h-5 w-5" />
      {label}
    </button>
    {disabled && tooltip && (
      <span className="absolute bottom-full z-10 mb-2 w-max bg-base-300 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        {tooltip}
      </span>
    )}
  </div>
);

const JACCAnalysisStep: React.FC<{result: AnalysisResult, onConfirm: (cats: Category[], keys: string[]) => void}> = ({result, onConfirm}) => {
  const [selectedCats, setSelectedCats] = useState<Category[]>(result.categories.filter(c => c.probability > 0.25));
  const [selectedKeys, setSelectedKeys] = useState<string[]>(result.keywords);
  
  const toggleCategory = (cat: Category) => 
    setSelectedCats(prev => 
      prev.some(c => c.name === cat.name) 
        ? prev.filter(c => c.name !== cat.name) 
        : [...prev, cat]
    );
  
  const toggleKeyword = (key: string) => 
    setSelectedKeys(prev => 
      prev.includes(key) 
        ? prev.filter(k => k !== key) 
        : [...prev, key]
    );
  
  // JACC-specific color mapping (cardiovascular theme)
  const catColorMap = { 
    main: 'bg-red-100 text-red-800', 
    sub: 'bg-blue-100 text-blue-800', 
    secondary: 'bg-green-100 text-green-800' 
  };
  const catBorderColorMap = { 
    main: 'border-red-500', 
    sub: 'border-blue-500', 
    secondary: 'border-green-500' 
  };
  
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-text-primary">JACC Analysis Complete</h2>
      <p className="text-text-secondary">Please review and confirm the suggested cardiovascular categories and keywords for your JACC abstract.</p>
      
      <div>
        <h3 className="font-semibold mb-2">Suggested JACC Categories</h3>
        <div className="flex flex-wrap gap-2">
          {result.categories.filter(c => c.probability > 0.25).map(cat => (
            <button 
              key={cat.name} 
              onClick={() => toggleCategory(cat)} 
              className={`px-3 py-1 text-sm font-medium rounded-full border-2 transition-all ${
                selectedCats.some(c => c.name === cat.name) 
                  ? `${catBorderColorMap[cat.type]} ${catColorMap[cat.type]}` 
                  : 'border-base-300 bg-base-100 hover:border-brand-primary'
              }`}
            >
              {cat.name} <span className="text-xs opacity-70">({cat.type})</span>
            </button>
          ))}
        </div>
      </div>
      
      <div>
        <h3 className="font-semibold mb-2">Suggested Keywords</h3>
        <div className="flex flex-wrap gap-2">
          {result.keywords.map(key => (
            <button 
              key={key} 
              onClick={() => toggleKeyword(key)} 
              className={`px-3 py-1 text-sm rounded-full border-2 transition-all ${
                selectedKeys.includes(key) 
                  ? 'border-brand-primary bg-brand-primary/20 text-brand-primary' 
                  : 'border-base-300 bg-base-100 hover:border-brand-primary'
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>
      
      <button 
        onClick={() => onConfirm(selectedCats, selectedKeys)} 
        className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg mt-4"
      >
        Confirm Selections & Proceed
      </button>
    </div>
  );
}

const TypeSuggestionStep: React.FC<{suggestions: AbstractTypeSuggestion[], onSelect: (type: AbstractType) => void}> = ({suggestions, onSelect}) => (
  <div className="space-y-4">
    <h2 className="text-xl font-bold text-text-primary">JACC Abstract Type</h2>
    <p className="text-text-secondary">Select the JACC abstract type for your cardiovascular research submission.</p>
    <div className="space-y-2">
      {suggestions.map(suggestion => (
        <button 
          key={suggestion.type} 
          onClick={() => onSelect(suggestion.type)} 
          className="w-full text-left p-3 bg-base-100 hover:bg-base-300/50 border border-base-300 rounded-lg transition-all"
        >
          <div className="flex justify-between items-center">
            <span className="font-semibold text-text-primary">{suggestion.type}</span>
            <span className="text-xs font-mono px-2 py-1 bg-brand-primary/20 text-brand-primary rounded">
              {`${(suggestion.probability * 100).toFixed(0)}% match`}
            </span>
          </div>
        </button>
      ))}
    </div>
  </div>
);

export default JACCPanel;