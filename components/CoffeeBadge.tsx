import React, { useState } from 'react';
import { SvgIcon } from './SvgIcon';

const CoffeeBadge: React.FC = () => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Coffee Icon Badge */}
      <div 
        className="cursor-pointer transition-transform hover:scale-110"
        title="打赏 / Buy Me A Coffee"
      >
        <SvgIcon 
          type="coffee" 
          className="h-6 w-6 text-yellow-600 hover:text-yellow-500 transition-colors" 
        />
      </div>

      {/* QR Code Overlay */}
      {isHovered && (
        <div 
          className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-50 coffee-fade-in"
        >
          <img 
            src="/Weixin Image_830.jpg" 
            alt="WeChat QR Code for donation"
            className="shadow-2xl rounded-lg w-[340px] md:w-[300px] sm:w-[260px] max-w-[90vw]"
          />
        </div>
      )}

      <style>{`
        @keyframes coffeeFadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
        .coffee-fade-in {
          animation: coffeeFadeIn 240ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        @media (prefers-reduced-motion: reduce) {
          .coffee-fade-in {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
    </div>
  );
};

export default CoffeeBadge;
