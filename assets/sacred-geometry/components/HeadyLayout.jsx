/**
 * █▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
 * █▓▒░            🌌 HEADY LAYOUT COMPONENT 🌌                  ░▒▓█
 * █▓▒░          Organic Systems • Breathing Interfaces           ░▒▓█
 * █▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
 * 
 * FILE: HeadyLayout.jsx
 * LAYER: assets/sacred-geometry/components
 * PURPOSE: Layout wrapper with Sacred Geometry branding and watermark
 * 
 * 🜃 HeadyConnection Inc. (501c3) • HeadySystems Inc. (C-Corp)
 * 🌊 Maximum Global Happiness through AI-Powered Social Impact
 * 
 * █▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
 */

import React, { useEffect, useState } from 'react';
import SacredIcon from './SacredIcon.jsx';
import '../themes/sacred-geometry.css';

const HeadyLayout = ({ 
  children, 
  title = 'Heady Systems',
  showWatermark = true,
  theme = 'dark',
  breathing = true,
  className = '',
  ...props 
}) => {
  const [watermarkLoaded, setWatermarkLoaded] = useState(false);

  useEffect(() => {
    // Initialize watermark if not already loaded
    if (showWatermark && !window.headyWatermark) {
      const script = document.createElement('script');
      script.src = '/assets/sacred-geometry/watermark/aurora-watermark-component.js';
      script.async = true;
      script.onload = () => setWatermarkLoaded(true);
      document.body.appendChild(script);
    } else if (showWatermark && window.headyWatermark) {
      setWatermarkLoaded(true);
    }

    // Apply theme class to body
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    document.body.classList.add(`theme-${theme}`);
    
    // Apply breathing effect if enabled
    if (breathing) {
      document.body.classList.add('breathing-active');
    }

    return () => {
      // Cleanup
      document.body.classList.remove(`theme-${theme}`, 'breathing-active');
    };
  }, [showWatermark, theme, breathing]);

  return (
    <div 
      className={`heady-layout ${className} ${breathing ? 'breathing' : ''}`}
      {...props}
    >
      {/* Sacred Geometry Header */}
      <header className="heady-header">
        <div className="heady-header-content">
          <div className="heady-logo">
            <SacredIcon 
              name="merkaba-star-03" 
              size={32} 
              animated="pulse" 
              color="sacred-cyan"
            />
          </div>
          <div className="heady-title">
            <h1 className="heady-main-title">{title}</h1>
            <p className="heady-subtitle">
              Sacred Geometry • Organic Systems • Breathing Interfaces
            </p>
          </div>
          <div className="heady-status">
            <SacredIcon 
              name="rainbow-burst" 
              size={16} 
              animated="glow" 
              color="energy-rainbow"
            />
            <span className="status-text">System Active</span>
          </div>
        </div>
        
        {/* Sacred Geometry Navigation */}
        <nav className="heady-nav">
          <div className="nav-item">
            <SacredIcon name="metatrons-cube-01" size={20} color="sacred-cyan" />
            <span>Core</span>
          </div>
          <div className="nav-item">
            <SacredIcon name="flower-of-life" size={20} color="organic-green" />
            <span>Organic</span>
          </div>
          <div className="nav-item">
            <SacredIcon name="aurora-flow" size={20} color="energy-rainbow" />
            <span>Energy</span>
          </div>
          <div className="nav-item">
            <SacredIcon name="cube-sacred" size={20} color="dimension-gold" />
            <span>Dimension</span>
          </div>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="heady-main">
        {/* Sacred Geometry Background */}
        <div className="sacred-bg">
          <div className="fractal-bg"></div>
          <div className="energy-field"></div>
        </div>
        
        {/* Content */}
        <div className="heady-content">
          {children}
        </div>
      </main>

      {/* Sacred Geometry Footer */}
      <footer className="heady-footer">
        <div className="footer-content">
          <div className="footer-left">
            <SacredIcon name="tree-of-life" size={16} color="organic-green" />
            <span>Maximum Global Happiness</span>
          </div>
          <div className="footer-center">
            <SacredIcon name="divine-proportion" size={16} color="dimension-silver" />
            <span>Fractal Consciousness Architecture</span>
          </div>
          <div className="footer-right">
            <SacredIcon name="yin-yang-flow" size={16} color="organic-teal" />
            <span>Breathing Interfaces</span>
          </div>
        </div>
      </footer>

      {/* Aurora Watermark (automatically injected) */}
      {showWatermark && watermarkLoaded && (
        <div className="watermark-placeholder">
          {/* Watermark is handled by the aurora-watermark-component.js */}
        </div>
      )}

      <style jsx>{`
        .heady-layout {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--bg-primary);
          color: var(--text-primary);
          font-family: 'Inter', system-ui, sans-serif;
          position: relative;
          overflow-x: hidden;
        }

        .heady-header {
          background: var(--bg-secondary);
          border-bottom: 1px solid rgba(0, 217, 255, 0.2);
          padding: 1rem 2rem;
          position: relative;
          z-index: 100;
        }

        .heady-header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--gradient-energy);
        }

        .heady-header-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          max-width: 1200px;
          margin: 0 auto;
        }

        .heady-logo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .heady-title h1 {
          font-size: 1.5rem;
          font-weight: 700;
          background: var(--gradient-metatrons);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0;
        }

        .heady-subtitle {
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin: 0.25rem 0 0 0;
          opacity: 0.8;
        }

        .heady-status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--organic-green);
          font-size: 0.875rem;
        }

        .heady-nav {
          display: flex;
          gap: 2rem;
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(0, 217, 255, 0.1);
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
          color: var(--text-secondary);
        }

        .nav-item:hover {
          background: rgba(0, 217, 255, 0.1);
          color: var(--text-primary);
          transform: translateY(-2px);
        }

        .heady-main {
          flex: 1;
          position: relative;
          display: flex;
          flex-direction: column;
        }

        .sacred-bg {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 0;
          pointer-events: none;
        }

        .fractal-bg {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          opacity: 0.1;
          background-size: 200% 200%;
          animation: fractal-shift 20s ease-in-out infinite;
        }

        .energy-field {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at 50% 50%, 
            rgba(0, 217, 255, 0.05) 0%, 
            transparent 70%);
          animation: energy-pulse 4s ease-in-out infinite;
        }

        .heady-content {
          position: relative;
          z-index: 10;
          flex: 1;
          padding: 2rem;
        }

        .heady-footer {
          background: var(--bg-secondary);
          border-top: 1px solid rgba(0, 217, 255, 0.2);
          padding: 1rem 2rem;
          position: relative;
          z-index: 100;
        }

        .heady-footer::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: var(--gradient-organic);
        }

        .footer-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          max-width: 1200px;
          margin: 0 auto;
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .footer-left,
        .footer-center,
        .footer-right {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        /* Breathing animation */
        .breathing {
          animation: breathe 4s ease-in-out infinite;
        }

        @keyframes breathe {
          0%, 100% { opacity: 0.95; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.01); }
        }

        @keyframes fractal-shift {
          0%, 100% { background-position: 0% 0%, 100% 100%, 50% 50%; }
          50% { background-position: 100% 0%, 0% 100%, 50% 50%; }
        }

        @keyframes energy-pulse {
          0%, 100% { opacity: 0.05; transform: scale(1); }
          50% { opacity: 0.1; transform: scale(1.05); }
        }

        /* Responsive */
        @media (max-width: 768px) {
          .heady-header {
            padding: 1rem;
          }
          
          .heady-header-content {
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }
          
          .heady-nav {
            justify-content: center;
            gap: 1rem;
          }
          
          .nav-item span {
            display: none;
          }
          
          .footer-content {
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
};

export default HeadyLayout;

/**
 * Usage Example:
 * 
 * import HeadyLayout from './HeadyLayout.jsx';
 * 
 * function MyApp() {
 *   return (
 *     <HeadyLayout title="My Sacred App" theme="dark" breathing={true}>
 *       <div className="my-content">
 *         <h1>Welcome to the Sacred Geometry Interface</h1>
 *         <p>Your content here...</p>
 *       </div>
 *     </HeadyLayout>
 *   );
 * }
 * 
 * █▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
 * █▓▒░       🜃  Built with Sacred Geometry Principles  🜃        ░▒▓█
 * █▓▒░              ⟡  Maximum Global Happiness  ⟡               ░▒▓█
 * █▓▒░          🌌  Fractal Consciousness Architecture  🌌       ░▒▓█
 * █▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
 */
