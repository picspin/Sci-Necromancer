import React from 'react';
import { AbstractData, Category } from '../types';

interface OutputDisplayProps {
  abstractData: AbstractData | null;
  categories?: Category[];
}

const OutputDisplay: React.FC<OutputDisplayProps> = ({ abstractData, categories }) => {
  if (!abstractData) {
    return (
      <div className="text-center text-text-secondary py-8">
        <p>No abstract generated yet. Start by analyzing your content.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Impact Section */}
      {abstractData.impact && (
        <div className="bg-base-200 p-4 rounded-lg border-l-4 border-blue-500">
          <h3 className="text-lg font-semibold text-blue-400 mb-2">Impact</h3>
          <p className="text-text-primary">{abstractData.impact}</p>
        </div>
      )}

      {/* Synopsis Section */}
      {abstractData.synopsis && (
        <div className="bg-base-200 p-4 rounded-lg border-l-4 border-green-500">
          <h3 className="text-lg font-semibold text-green-400 mb-2">Synopsis</h3>
          <p className="text-text-primary">{abstractData.synopsis}</p>
        </div>
      )}

      {/* Categories */}
      {categories && categories.length > 0 && (
        <div className="bg-base-200 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-purple-400 mb-3">Categories</h3>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat, idx) => (
              <span
                key={idx}
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  cat.type === 'main'
                    ? 'bg-category-main text-black'
                    : cat.type === 'sub'
                    ? 'bg-category-sub text-black'
                    : 'bg-category-secondary text-black'
                }`}
              >
                {cat.name} ({Math.round(cat.probability * 100)}%)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Keywords */}
      {abstractData.keywords && abstractData.keywords.length > 0 && (
        <div className="bg-base-200 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-orange-400 mb-3">Keywords</h3>
          <div className="flex flex-wrap gap-2">
            {abstractData.keywords.map((keyword, idx) => (
              <span key={idx} className="px-3 py-1 bg-orange-600 text-white rounded-full text-sm">
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OutputDisplay;
