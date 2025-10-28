import React, { useState } from 'react';
import Modal from './Modal';
import { SvgIcon } from './SvgIcon';

interface HelpDocumentationProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HelpSection {
  id: string;
  title: string;
  content: string;
  keywords: string[];
}

const helpSections: HelpSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    content: `Welcome to Sci-Necromancer! This tool helps you generate publication-ready abstracts for academic conferences.

To get started:
1. Select your target conference (JACC, RSNA, or ISMRM)
2. Choose between Standard or Creative mode
3. Upload your research paper or paste the text
4. Click "Analyze" to extract categories and keywords
5. Review and confirm the suggestions
6. Generate your spec-compliant abstract`,
    keywords: ['start', 'begin', 'introduction', 'how to'],
  },
  {
    id: 'standard-mode',
    title: 'Standard Analysis Mode',
    content: `Standard mode analyzes your existing research paper and generates a structured abstract.

Steps:
1. Upload a PDF or DOCX file, or paste your paper text
2. Click "Analyze" to extract key information
3. Review suggested categories and keywords in the popup
4. Select or deselect items as needed
5. Choose the recommended abstract type
6. Click "Generate" to create your abstract

The system will automatically format your abstract according to the selected conference requirements.`,
    keywords: ['standard', 'analyze', 'upload', 'pdf', 'docx', 'file'],
  },
  {
    id: 'creative-mode',
    title: 'Creative Expansion Mode',
    content: `Creative mode helps you expand a simple idea into a full abstract.

How to use:
1. Switch to "Creative" mode
2. Enter a one-sentence description of your research idea
3. Click "Generate Creatively"
4. The AI will expand your idea into a complete abstract with impact, synopsis, and keywords

This mode is perfect for brainstorming or early-stage research planning.`,
    keywords: ['creative', 'expand', 'idea', 'brainstorm'],
  },
  {
    id: 'categories-keywords',
    title: 'Categories and Keywords',
    content: `Categories and keywords help classify your research for conference submission.

Category Types:
• Main Category (Yellow): Primary research area
• Sub Category (Orange): Specific sub-field
• Secondary Category (Pink): Additional relevant areas

You can select or deselect any suggested categories and keywords. The system uses probability matching to suggest the most relevant options based on your content.`,
    keywords: ['category', 'keyword', 'classification', 'tags'],
  },
  {
    id: 'abstract-types',
    title: 'Abstract Types',
    content: `Different conferences require different abstract structures:

Standard Abstract:
• Introduction, Methods, Results, Discussion, Conclusion

Registered Abstract:
• Introduction, Hypothesis, Methods, Statistical Methods

Clinical Practice Abstract:
• Background, Teaching Point, Diagnosis, Significance, Key Points

ISMRT Abstract:
• Clinical or Research Focus structure

The system automatically suggests the best type based on your content using Occam's Razor classification.`,
    keywords: ['type', 'structure', 'format', 'standard', 'registered', 'clinical'],
  },
  {
    id: 'exporting',
    title: 'Exporting Your Abstract',
    content: `Once generated, you can export your abstract in multiple formats:

• PDF: Formatted document ready for submission
• DOCX: Microsoft Word format for editing
• JSON: Structured data for programmatic use
• Markdown: Plain text with formatting

Click the export buttons in the output panel to download your abstract. All exports include your impact statement, synopsis, keywords, and full abstract text.`,
    keywords: ['export', 'download', 'pdf', 'docx', 'save'],
  },
  {
    id: 'figure-generation',
    title: 'Figure Generation',
    content: `Generate or edit figures for your submission:

Standard Mode:
1. Upload an existing image
2. Provide specifications (e.g., "Add arrows", "Convert to grayscale")
3. Click "Generate Figure"

Creative Mode:
1. First generate an abstract
2. Switch to Figure tab and select Creative mode
3. The system will create a figure based on your abstract content

Provide detailed specifications for best results.`,
    keywords: ['figure', 'image', 'generate', 'edit', 'visual'],
  },
  {
    id: 'saved-abstracts',
    title: 'Managing Saved Abstracts',
    content: `Save and manage your work:

• Click "Show Saved Abstracts" to view your history
• Abstracts are automatically saved to local storage
• Optional cloud sync available with Supabase
• Export all abstracts for backup
• Load previous abstracts to continue editing

Your work is preserved across sessions, so you can return anytime.`,
    keywords: ['save', 'load', 'history', 'manage', 'storage'],
  },
  {
    id: 'accessibility',
    title: 'Accessibility Features',
    content: `Sci-Necromancer is designed to be accessible to all users:

• Full keyboard navigation (Tab, Enter, Escape, Arrow keys)
• Screen reader compatible with ARIA labels
• High contrast mode for better visibility
• Adjustable font sizes (up to 200% zoom)
• Reduced motion option
• Minimum 44x44px touch targets
• Visible focus indicators (3px outline)

Access these settings via the Accessibility button in the header.`,
    keywords: ['accessibility', 'keyboard', 'screen reader', 'contrast', 'a11y'],
  },
  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    content: `Navigate efficiently with keyboard shortcuts:

Global:
• Tab: Move to next element
• Shift+Tab: Move to previous element
• Enter/Space: Activate buttons
• Escape: Close modals and popups

In Modals:
• Arrow keys: Navigate between options
• Home: Jump to first option
• End: Jump to last option

Focus indicators show your current position with a 3px outline.`,
    keywords: ['keyboard', 'shortcuts', 'navigation', 'keys'],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    content: `Common issues and solutions:

File Upload Issues:
• Ensure file is PDF or DOCX format
• Check file size is under 10MB
• Try pasting text directly if upload fails

Generation Errors:
• Verify API key is configured
• Check internet connection
• Try regenerating with different parameters

Slow Performance:
• Large files may take longer to process
• Complex abstracts require more processing time
• Check your internet connection speed

If problems persist, try refreshing the page or clearing your browser cache.`,
    keywords: ['troubleshoot', 'error', 'problem', 'issue', 'help', 'fix'],
  },
];

const HelpDocumentation: React.FC<HelpDocumentationProps> = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  const filteredSections = helpSections.filter(
    (section) =>
      section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      section.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      section.keywords.some((keyword) =>
        keyword.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  const currentSection = selectedSection
    ? helpSections.find((s) => s.id === selectedSection)
    : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Help & Documentation"
      size="lg"
      ariaLabel="Help and documentation"
    >
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <label htmlFor="help-search" className="sr-only">
            Search help documentation
          </label>
          <input
            id="help-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search help topics..."
            className="w-full px-4 py-2 pl-10 bg-base-100 border border-base-300 rounded-md focus:ring-2 focus:ring-brand-primary focus:outline-none"
            aria-label="Search help documentation"
          />
          <SvgIcon
            type="document"
            className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary"
            aria-hidden="true"
          />
        </div>

        {/* Content */}
        {currentSection ? (
          <div className="space-y-4">
            <button
              onClick={() => setSelectedSection(null)}
              className="flex items-center gap-2 text-brand-primary hover:underline focus:outline-none focus:ring-3 focus:ring-brand-primary rounded-md"
              aria-label="Back to help topics list"
            >
              <span aria-hidden="true">←</span> Back to topics
            </button>
            <div>
              <h3 className="text-xl font-bold text-text-primary mb-3">
                {currentSection.title}
              </h3>
              <div className="prose prose-invert max-w-none text-text-secondary whitespace-pre-line">
                {currentSection.content}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2" role="list" aria-label="Help topics">
            {filteredSections.length > 0 ? (
              filteredSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setSelectedSection(section.id)}
                  className="w-full text-left p-4 bg-base-100 hover:bg-base-300/50 border border-base-300 rounded-lg transition-all focus:outline-none focus:ring-3 focus:ring-brand-primary"
                  role="listitem"
                  aria-label={`View help for ${section.title}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-text-primary">
                        {section.title}
                      </h4>
                      <p className="text-sm text-text-secondary mt-1 line-clamp-2">
                        {section.content.split('\n')[0]}
                      </p>
                    </div>
                    <span className="text-brand-primary" aria-hidden="true">
                      →
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center py-8 text-text-secondary">
                <SvgIcon
                  type="info"
                  className="h-12 w-12 mx-auto mb-3 opacity-50"
                  aria-hidden="true"
                />
                <p>No help topics found matching "{searchQuery}"</p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-2 text-brand-primary hover:underline focus:outline-none focus:ring-3 focus:ring-brand-primary rounded-md"
                >
                  Clear search
                </button>
              </div>
            )}
          </div>
        )}

        {/* Quick Links */}
        {!currentSection && !searchQuery && (
          <div className="pt-4 border-t border-base-300">
            <h4 className="text-sm font-semibold text-text-primary mb-2">
              Quick Links
            </h4>
            <div className="flex flex-wrap gap-2">
              {['getting-started', 'keyboard-shortcuts', 'accessibility', 'troubleshooting'].map(
                (id) => {
                  const section = helpSections.find((s) => s.id === id);
                  return (
                    <button
                      key={id}
                      onClick={() => setSelectedSection(id)}
                      className="px-3 py-1 text-sm bg-brand-primary/20 text-brand-primary rounded-full hover:bg-brand-primary/30 transition-colors focus:outline-none focus:ring-3 focus:ring-brand-primary"
                      aria-label={`Quick link to ${section?.title}`}
                    >
                      {section?.title}
                    </button>
                  );
                }
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default HelpDocumentation;
