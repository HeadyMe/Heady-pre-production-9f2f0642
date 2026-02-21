import React from 'react';

const HeadyWatermark = () => {
  return (
    <div 
      className="fixed bottom-4 right-4 z-50 pointer-events-none opacity-30"
      style={{
        background: 'linear-gradient(45deg, #f59e0b, #ef4444, #8b5cf6, #3b82f6)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        fontSize: '14px',
        fontWeight: 'bold',
        textShadow: '0 0 10px rgba(0,0,0,0.3)',
        animation: 'shimmer 3s ease-in-out infinite',
        padding: '4px 8px',
        borderRadius: '4px',
        backdropFilter: 'blur(2px)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}
    >
      Heady Systems
    </div>
  );
};

export default HeadyWatermark;
