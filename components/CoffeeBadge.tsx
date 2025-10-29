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
          className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-50 animate-fade-in"
          style={{
            animation: 'fadeIn 0.3s ease-in-out'
          }}
        >
          <img 
            src="/Weixin Image_830.jpg" 
            alt="WeChat QR Code for donation"
            className="shadow-2xl rounded-lg w-[340px] md:w-[300px] sm:w-[260px] max-w-[90vw]"
          />
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default CoffeeBadge;
