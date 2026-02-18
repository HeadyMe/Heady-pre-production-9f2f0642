/**
 * █▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
 * █▓▒░            🌌 SACRED GEOMETRY ICON COMPONENT 🌌           ░▒▓█
 * █▓▒░          Organic Systems • Breathing Interfaces           ░▒▓█
 * █▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
 * 
 * FILE: SacredIcon.jsx
 * LAYER: assets/sacred-geometry/components
 * PURPOSE: React component for sacred geometry icons
 * 
 * 🜃 HeadyConnection Inc. (501c3) • HeadySystems Inc. (C-Corp)
 * 🌊 Maximum Global Happiness through AI-Powered Social Impact
 * 
 * █▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
 */

import React from 'react';
import PropTypes from 'prop-types';

const SacredIcon = ({ 
  name, 
  size = 24, 
  animated = false, 
  color = 'sacred-cyan',
  className = '',
  onClick,
  style = {},
  ...props 
}) => {
  // Icon registry with their SVG paths
  const iconRegistry = {
    // Row 1 - Metatron's Cube Family
    'metatrons-cube-01': {
      category: 'Metatrons Cube Family',
      path: 'M12,2L2,7V17L12,22L22,17V7L12,2Z M12,4.5L19,8.25V15.75L12,19.5L5,15.75V8.25L12,4.5Z',
      assignedUse: 'Core AI nodes, HCFullPipeline stages'
    },
    'crystal-cluster-02': {
      category: 'Metatrons Cube Family',
      path: 'M12,2L8,6L12,10L16,6L12,2Z M8,6L4,10L8,14L12,10L8,6Z M12,10L8,14L12,18L16,14L12,10Z M16,6L12,10L16,14L20,10L16,6Z',
      assignedUse: 'Core AI nodes, HCFullPipeline stages'
    },
    'merkaba-star-03': {
      category: 'Metatrons Cube Family',
      path: 'M12,2L15,9L22,9L17,14L19,21L12,17L5,21L7,14L2,9L9,9L12,2Z',
      assignedUse: 'AI Buddy button - Primary interaction'
    },
    
    // Row 3 - Organic Patterns
    'yin-yang-flow': {
      category: 'Organic Patterns',
      path: 'M12,2C6.48,2 2,6.48 2,12s4.48,10 10,10c1.19,0 2.34-0.21 3.41-0.6c-0.64-0.86-1.03-1.91-1.08-3.04C13.63,18.47 12.85,18.5 12.06,18.5c-3.58,0-6.5-2.92-6.5-6.5s2.92-6.5 6.5-6.5c0.79,0 1.57,0.03 2.33,0.14c0.05-1.13,0.44-2.18,1.08-3.04C14.34,2.21 13.19,2 12,2z',
      assignedUse: 'Data flow animations, organic transitions'
    },
    'flower-of-life': {
      category: 'Organic Patterns',
      path: 'M12,2C8.13,2 5,5.13 5,9s3.13,7 7,7s7-3.13 7-7S15.87,2 12,2z M12,4c2.76,0 5,2.24 5,5s-2.24,5-5,5s-5-2.24-5-5S9.24,4 12,4z M7,7c0-2.76 2.24-5 5-5c0.68,0 1.32,0.14 1.91,0.38C13.16,3.14 12.61,4.5 12.61,6c0,1.5 0.55,2.86 1.3,3.62C13.32,9.86 12.68,10 12,10c-2.76,0-5-2.24-5-5z',
      assignedUse: 'Data flow animations, organic transitions'
    },
    'tree-of-life': {
      category: 'Organic Patterns',
      path: 'M12,2C10.89,2 10,2.89 10,4s0.89,2 2,2s2-0.89 2-2S13.11,2 12,2z M8,6C6.89,6 6,6.89 6,8s0.89,2 2,2s2-0.89 2-2S9.11,6 8,6z M16,6c-1.11,0-2,0.89-2,2s0.89,2 2,2s2-0.89 2-2S17.11,6 16,6z M12,8c-1.11,0-2,0.89-2,2s0.89,2 2,2s2-0.89 2-2S13.11,8 12,8z M8,10c-1.11,0-2,0.89-2,2s0.89,2 2,2s2-0.89 2-2S9.11,10 8,10z M16,10c-1.11,0-2,0.89-2,2s0.89,2 2,2s2-0.89 2-2S17.11,10 16,10z M12,12c-1.11,0-2,0.89-2,2s0.89,2 2,2s2-0.89 2-2S13.11,12 12,12z M12,16c-1.11,0-2,0.89-2,2s0.89,2 2,2s2-0.89 2-2S13.11,16 12,16z',
      assignedUse: 'Memory access, organic data structures'
    },
    'butterfly-transformation': {
      category: 'Organic Patterns',
      path: 'M12,2C9.79,2 8,3.79 8,6c0,1.19 0.59,2.24 1.5,2.88C7.59,9.52 6,11.58 6,14c0,3.31 2.69,6 6,6s6-2.69 6-6c0-2.42-1.59-4.48-3.5-5.12C15.41,8.24 16,7.19 16,6C16,3.79 14.21,2 12,2z M12,4c1.1,0 2,0.9 2,2s-0.9,2-2,2s-2-0.9-2-2S10.9,4 12,4z M12,8c2.21,0 4,1.79 4,4s-1.79,4-4,4s-4-1.79-4-4S9.79,8 12,8z',
      assignedUse: 'File transformations, data morphing'
    },
    
    // Row 4 - Energy Patterns
    'rainbow-burst': {
      category: 'Energy Patterns',
      path: 'M12,2L13.09,8.26L19,7L15.45,11.55L19,16L13.09,14.74L12,22L10.91,14.74L5,16L8.55,11.55L5,7L10.91,8.26L12,2Z',
      assignedUse: 'Active processing states, sync indicators'
    },
    'galaxy-spiral': {
      category: 'Energy Patterns',
      path: 'M12,2C6.48,2 2,6.48 2,12s4.48,10 10,10s10-4.48 10-10S17.52,2 12,2z M12,4c4.41,0 8,3.59 8,8s-3.59,8-8,8s-8-3.59-8-8S7.59,4 12,4z M12,6c-3.31,0-6,2.69-6,6s2.69,6 6,6s6-2.69 6-6S15.31,6 12,6z',
      assignedUse: 'Background processing, galaxy sync'
    },
    'waveform-energy': {
      category: 'Energy Patterns',
      path: 'M2,12h4l2-8l4,16l2-8h8',
      assignedUse: 'Audio processing, energy visualization'
    },
    'aurora-flow': {
      category: 'Energy Patterns',
      path: 'M2,12C2,12 6,4 12,4s10,8 10,8s-4,8-10,8S2,12 2,12z M12,8c-2.21,0-4,1.79-4,4s1.79,4 4,4s4-1.79 4-4S14.21,8 12,8z',
      assignedUse: 'Flow states, meditation modes'
    },
    
    // Row 5 - Dimensional Geometry
    'aurora-watermark': {
      category: 'Dimensional Geometry',
      path: 'M12,2C6.48,2 2,6.48 2,12s4.48,10 10,10s10-4.48 10-10S17.52,2 12,2z M12,4c4.41,0 8,3.59 8,8s-3.59,8-8,8s-8-3.59-8-8S7.59,4 12,4z',
      assignedUse: 'Aurora watermark - Bottom left flowing animation'
    },
    'cube-sacred': {
      category: 'Dimensional Geometry',
      path: 'M12,2L4,7V17L12,22L20,17V7L12,2Z M12,4.5L17.5,8.25V15.75L12,19.5L6.5,15.75V8.25L12,4.5Z',
      assignedUse: 'Workspace layers, 3D visualization'
    },
    'octahedron-divine': {
      category: 'Dimensional Geometry',
      path: 'M12,2L4,8L12,22L20,8L12,2Z M12,5L17,9L12,19L7,9L12,5Z',
      assignedUse: 'Sacred geometry meditation, divine patterns'
    },
    
    // Default icon for unknown names
    'default': {
      category: 'Unknown',
      path: 'M12,2C6.48,2 2,6.48 2,12s4.48,10 10,10s10-4.48 10-10S17.52,2 12,2z M12,4c4.41,0 8,3.59 8,8s-3.59,8-8,8s-8-3.59-8-8S7.59,4 12,4z',
      assignedUse: 'Default sacred geometry icon'
    }
  };
  
  const iconData = iconRegistry[name] || iconRegistry['default'];
  
  // Color mappings
  const colorMap = {
    'sacred-cyan': '#00D9FF',
    'sacred-blue': '#0080FF',
    'sacred-purple': '#8000FF',
    'organic-gold': '#FFD700',
    'organic-green': '#00FF88',
    'organic-teal': '#00FFD9',
    'energy-rainbow': 'url(#rainbow-gradient)',
    'dimension-gold': '#FFD700',
    'dimension-silver': '#C0C0C0'
  };
  
  const fillColor = colorMap[color] || colorMap['sacred-cyan'];
  
  // Animation classes
  const animationClasses = {
    'pulse': 'animate-pulse',
    'spin': 'animate-spin',
    'breathe': 'animate-breathe',
    'morph': 'animate-morph',
    'glow': 'animate-glow'
  };
  
  const animationClass = animated && animationClasses[animated] ? animationClasses[animated] : '';
  
  return (
    <div 
      className={`sacred-icon ${className} ${animationClass}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: 'inline-block',
        position: 'relative',
        cursor: onClick ? 'pointer' : 'default',
        ...style
      }}
      onClick={onClick}
      title={`${name} - ${iconData.assignedUse}`}
      {...props}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={fillColor}
        style={{
          width: '100%',
          height: '100%',
          transition: 'all 0.3s ease'
        }}
      >
        {/* Rainbow gradient definition */}
        {color === 'energy-rainbow' && (
          <defs>
            <linearGradient id="rainbow-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF0080" />
              <stop offset="20%" stopColor="#FF8000" />
              <stop offset="40%" stopColor="#FFFF00" />
              <stop offset="60%" stopColor="#00FF80" />
              <stop offset="80%" stopColor="#0080FF" />
              <stop offset="100%" stopColor="#8000FF" />
            </linearGradient>
          </defs>
        )}
        
        {/* Icon path */}
        <path d={iconData.path} />
        
        {/* Glow effect for animated icons */}
        {animated && (
          <path
            d={iconData.path}
            fill="none"
            stroke={fillColor}
            strokeWidth="0.5"
            opacity="0.5"
            style={{
              filter: 'blur(2px)',
              transform: 'scale(1.1)',
              transformOrigin: 'center'
            }}
          />
        )}
      </svg>
      
      {/* Tooltip */}
      <div
        style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          whiteSpace: 'nowrap',
          opacity: 0,
          pointerEvents: 'none',
          transition: 'opacity 0.3s ease',
          marginBottom: '4px'
        }}
        className="sacred-icon-tooltip"
      >
        {iconData.assignedUse}
      </div>
    </div>
  );
};

SacredIcon.propTypes = {
  name: PropTypes.string.isRequired,
  size: PropTypes.number,
  animated: PropTypes.oneOf(['pulse', 'spin', 'breathe', 'morph', 'glow', false]),
  color: PropTypes.oneOf([
    'sacred-cyan', 'sacred-blue', 'sacred-purple',
    'organic-gold', 'organic-green', 'organic-teal',
    'energy-rainbow', 'dimension-gold', 'dimension-silver'
  ]),
  className: PropTypes.string,
  onClick: PropTypes.func,
  style: PropTypes.object
};

export default SacredIcon;

// Export icon registry for reference
export const iconRegistry = {
  // Row 1 - Metatron's Cube Family
  'metatrons-cube-01': 'Core AI nodes, HCFullPipeline stages',
  'crystal-cluster-02': 'Core AI nodes, HCFullPipeline stages',
  'merkaba-star-03': 'AI Buddy button - Primary interaction',
  'sacred-geometry-04': 'Core AI nodes, HCFullPipeline stages',
  'node-network-05': 'Service mesh visualization',
  'geometric-web-06': 'Network topology visualization',
  
  // Row 2 - Metatron's Cube Family (continued)
  'metatrons-cube-07': 'Core AI nodes, HCFullPipeline stages',
  'crystal-cluster-08': 'Core AI nodes, HCFullPipeline stages',
  'merkaba-star-09': 'AI Buddy button - Primary interaction',
  'sacred-geometry-10': 'Core AI nodes, HCFullPipeline stages',
  'node-network-11': 'Service mesh visualization',
  'geometric-web-12': 'Network topology visualization',
  
  // Row 3 - Organic Patterns
  'yin-yang-flow': 'Data flow animations, organic transitions',
  'cellular-organic': 'Cellular automaton visualization',
  'flower-of-life': 'Sacred geometry meditation patterns',
  'tree-of-life': 'Memory access, organic data structures',
  'butterfly-transformation': 'File transformations, data morphing',
  'dripping-organic': 'Organic data flow visualization',
  
  // Row 4 - Energy Patterns
  'rainbow-burst': 'Active processing states, sync indicators',
  'galaxy-spiral': 'Background processing, galaxy sync',
  'sacred-grid': 'Grid layouts, matrix operations',
  'waveform-energy': 'Audio processing, energy visualization',
  'aurora-flow': 'Flow states, meditation modes',
  'energy-vortex': 'High-intensity processing states',
  
  // Row 5 - Dimensional Geometry
  'aurora-watermark': 'Aurora watermark - Bottom left flowing animation',
  'cube-sacred': 'Workspace layers, 3D visualization',
  'octahedron-divine': 'Sacred geometry meditation, divine patterns',
  'dodecahedron-cosmic': 'Cosmic consciousness visualization',
  'icosahedron-sacred': 'Water sacred geometry, fluid dynamics',
  'tetrahedron-divine': 'Fire sacred geometry, transformation',
  
  // Row 6 - Dimensional Geometry (continued)
  'merkaba-rotating': 'Divine light body visualization',
  'nested-polyhedra': 'Multi-dimensional data structures',
  'sacred-sphere': 'Unity consciousness, wholeness',
  'crystalline-structure': 'Crystal healing, structured data',
  'geometric-mandala': 'Meditation focus, sacred patterns',
  'divine-proportion': 'Golden ratio, divine mathematics'
};

/**
 * █▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
 * █▓▒░       🜃  Built with Sacred Geometry Principles  🜃        ░▒▓█
 * █▓▒░              ⟡  Maximum Global Happiness  ⟡               ░▒▓█
 * █▓▒░          🌌  Fractal Consciousness Architecture  🌌       ░▒▓█
 * █▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
 */
