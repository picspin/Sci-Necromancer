import React from 'react';
import { useTheme } from '../lib/hooks/useTheme';
import Modal from './Modal';
import { SvgIcon } from './SvgIcon';

interface AccessibilitySettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Accessibility settings panel for high contrast mode, font size, and reduced motion
 */
const AccessibilitySettings: React.FC<AccessibilitySettingsProps> = ({ isOpen, onClose }) => {
  const { theme, toggleHighContrast, setFontSize, toggleReducedMotion, resetTheme, isHighContrast } = useTheme();

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Accessibility Settings"
      size="md"
      ariaLabel="Accessibility settings dialog"
    >
      <div className="space-y-6">
        {/* High Contrast Mode */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-text-primary">High Contrast Mode</h3>
              <p className="text-sm text-text-secondary">Increase contrast for better visibility</p>
            </div>
            <button
              onClick={toggleHighContrast}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-3 focus:ring-brand-primary ${
                isHighContrast ? 'bg-brand-primary' : 'bg-base-300'
              }`}
              role="switch"
              aria-checked={isHighContrast}
              aria-label="Toggle high contrast mode"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isHighContrast ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Font Size */}
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-text-primary">Font Size</h3>
          <p className="text-sm text-text-secondary mb-3">Adjust text size for better readability (supports up to 200% zoom)</p>
          <div className="flex gap-2" role="radiogroup" aria-label="Font size selection">
            <button
              onClick={() => setFontSize('normal')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all focus:outline-none focus:ring-3 focus:ring-brand-primary min-h-[44px] ${
                theme.fontSize === 'normal'
                  ? 'bg-brand-primary text-white'
                  : 'bg-base-200 text-text-secondary hover:bg-base-300'
              }`}
              role="radio"
              aria-checked={theme.fontSize === 'normal'}
              aria-label="Normal font size"
            >
              Normal
            </button>
            <button
              onClick={() => setFontSize('large')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all focus:outline-none focus:ring-3 focus:ring-brand-primary min-h-[44px] ${
                theme.fontSize === 'large'
                  ? 'bg-brand-primary text-white'
                  : 'bg-base-200 text-text-secondary hover:bg-base-300'
              }`}
              role="radio"
              aria-checked={theme.fontSize === 'large'}
              aria-label="Large font size (125%)"
            >
              Large
            </button>
            <button
              onClick={() => setFontSize('x-large')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all focus:outline-none focus:ring-3 focus:ring-brand-primary min-h-[44px] ${
                theme.fontSize === 'x-large'
                  ? 'bg-brand-primary text-white'
                  : 'bg-base-200 text-text-secondary hover:bg-base-300'
              }`}
              role="radio"
              aria-checked={theme.fontSize === 'x-large'}
              aria-label="Extra large font size (150%)"
            >
              X-Large
            </button>
          </div>
        </div>

        {/* Reduced Motion */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-text-primary">Reduce Motion</h3>
              <p className="text-sm text-text-secondary">Minimize animations and transitions</p>
            </div>
            <button
              onClick={toggleReducedMotion}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-3 focus:ring-brand-primary ${
                theme.reducedMotion ? 'bg-brand-primary' : 'bg-base-300'
              }`}
              role="switch"
              aria-checked={theme.reducedMotion}
              aria-label="Toggle reduced motion"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  theme.reducedMotion ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-base-100 p-4 rounded-lg border border-base-300">
          <div className="flex gap-3">
            <SvgIcon type="info" className="h-5 w-5 text-brand-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-sm text-text-secondary">
              <p className="font-medium text-text-primary mb-1">Accessibility Features</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>All interactive elements have minimum 44x44px touch targets</li>
                <li>Full keyboard navigation support with visible focus indicators</li>
                <li>Screen reader compatible with ARIA labels</li>
                <li>Responsive design for mobile and tablet devices</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between gap-3 pt-4 border-t border-base-300">
          <button
            onClick={resetTheme}
            className="px-4 py-2 rounded-md text-text-secondary hover:bg-base-300 transition-colors focus:outline-none focus:ring-3 focus:ring-brand-primary min-h-[44px]"
            aria-label="Reset all accessibility settings to default"
          >
            Reset to Default
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-md bg-brand-primary hover:bg-brand-secondary text-white font-semibold transition-colors focus:outline-none focus:ring-3 focus:ring-brand-primary min-h-[44px]"
            aria-label="Close accessibility settings"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default AccessibilitySettings;
