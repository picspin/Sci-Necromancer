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
          <div className="bg-white p-8 rounded-xl shadow-2xl border-4 border-yellow-500">
            <img 
              src="/Weixin Image_830.jpg" 
              alt="WeChat QR Code for donation"
              className="w-96 h-96 object-contain"
            />
            <p className="text-center text-xl text-gray-800 mt-5 font-bold">扫码打赏 / Scan to Donate</p>
          </div>
          {/* Arrow pointer */}
          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-transparent border-b-yellow-500"></div>
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
