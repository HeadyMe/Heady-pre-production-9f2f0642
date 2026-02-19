
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Heady Systems - HCFP Full Auto Mode        ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: aurora-watermark-component.js                                   ║
// ║  UPDATED: 20260218-211102                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/*
 * ✅ SCANNED: 20260218-211102
 * 🔍 INSPECTED: All content reviewed
 * 🏷️  BRANDED: Heady Systems branding applied
 * 📊 STATUS: Fully compliant with HCFP Full Auto Mode
 */

/**
 * █▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
 * █▓▒░            🌌 AURORA WATERMARK COMPONENT 🌌               ░▒▓█
 * █▓▒░          Organic Systems • Breathing Interfaces           ░▒▓█
 * █▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
 * 
 * FILE: aurora-watermark-component.js
 * LAYER: assets/sacred-geometry/watermark
 * PURPOSE: Flowing aurora watermark for bottom-left placement
 * 
 * 🜃 HeadyConnection Inc. (501c3) • HeadySystems Inc. (C-Corp)
 * 🌊 Maximum Global Happiness through AI-Powered Social Impact
 * 
 * █▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
 */

class AuroraWatermark {
    constructor(options = {}) {
        this.options = {
            size: options.size || 80,
            opacity: options.opacity || 0.3,
            position: options.position || 'bottom-left',
            animationSpeed: options.animationSpeed || 8,
            glowIntensity: options.glowIntensity || 0.5,
            ...options
        };
        
        this.container = null;
        this.watermarkElement = null;
        this.animationFrame = null;
        this.particles = [];
        
        this.init();
    }
    
    init() {
        this.createWatermarkElement();
        this.createParticles();
        this.startAnimation();
        this.addEventListeners();
    }
    
    createWatermarkElement() {
        // Create the main watermark container
        this.watermarkElement = document.createElement('div');
        this.watermarkElement.className = 'heady-aurora-watermark';
        this.watermarkElement.setAttribute('data-heady-watermark', 'true');
        
        // Apply base styles
        Object.assign(this.watermarkElement.style, {
            position: 'fixed',
            width: `${this.options.size}px`,
            height: `${this.options.size}px`,
            opacity: this.options.opacity,
            pointerEvents: 'none',
            zIndex: '9999',
            mixBlendMode: 'screen',
            filter: 'blur(2px)',
            transition: 'all 0.3s ease'
        });
        
        // Set position based on option
        this.setPosition();
        
        // Create the aurora gradient background
        this.createAuroraBackground();
        
        // Add to body
        document.body.appendChild(this.watermarkElement);
    }
    
    setPosition() {
        const positions = {
            'bottom-left': {
                bottom: '16px',
                left: '16px'
            },
            'bottom-right': {
                bottom: '16px',
                right: '16px'
            },
            'top-left': {
                top: '16px',
                left: '16px'
            },
            'top-right': {
                top: '16px',
                right: '16px'
            }
        };
        
        const pos = positions[this.options.position] || positions['bottom-left'];
        Object.assign(this.watermarkElement.style, pos);
    }
    
    createAuroraBackground() {
        // Create SVG aurora effect
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '100');
        svg.setAttribute('height', '100');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.style.width = '100%';
        svg.style.height = '100%';
        
        // Define gradients
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        
        // Aurora gradient
        const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
        gradient.setAttribute('id', 'aurora-gradient');
        gradient.setAttribute('cx', '50%');
        gradient.setAttribute('cy', '50%');
        gradient.setAttribute('r', '50%');
        
        const colors = [
            { offset: '0%', color: '#00FF88', opacity: '0.8' },
            { offset: '30%', color: '#00D9FF', opacity: '0.6' },
            { offset: '60%', color: '#8000FF', opacity: '0.4' },
            { offset: '100%', color: '#FF00FF', opacity: '0.2' }
        ];
        
        colors.forEach(({ offset, color, opacity }) => {
            const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            stop.setAttribute('offset', offset);
            stop.setAttribute('stop-color', color);
            stop.setAttribute('stop-opacity', opacity);
            gradient.appendChild(stop);
        });
        
        defs.appendChild(gradient);
        svg.appendChild(defs);
        
        // Create aurora shape
        const aurora = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        aurora.setAttribute('cx', '50');
        aurora.setAttribute('cy', '50');
        aurora.setAttribute('rx', '40');
        aurora.setAttribute('ry', '25');
        aurora.setAttribute('fill', 'url(#aurora-gradient)');
        aurora.setAttribute('transform', 'rotate(45 50 50)');
        
        svg.appendChild(aurora);
        this.watermarkElement.appendChild(svg);
    }
    
    createParticles() {
        // Create floating particles for enhanced effect
        for (let i = 0; i < 8; i++) {
            const particle = document.createElement('div');
            particle.className = 'aurora-particle';
            
            Object.assign(particle.style, {
                position: 'absolute',
                width: '3px',
                height: '3px',
                background: '#00D9FF',
                borderRadius: '50%',
                opacity: Math.random() * 0.5 + 0.2,
                pointerEvents: 'none'
            });
            
            this.watermarkElement.appendChild(particle);
            
            this.particles.push({
                element: particle,
                x: Math.random() * this.options.size,
                y: Math.random() * this.options.size,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                life: Math.random() * 100
            });
        }
    }
    
    startAnimation() {
        const animate = () => {
            this.updateWatermark();
            this.updateParticles();
            this.animationFrame = requestAnimationFrame(animate);
        };
        animate();
    }
    
    updateWatermark() {
        const time = Date.now() / 1000;
        const scale = 1 + Math.sin(time / this.options.animationSpeed) * 0.05;
        const rotation = (time / this.options.animationSpeed) * 45;
        const opacity = this.options.opacity + Math.sin(time / (this.options.animationSpeed / 2)) * 0.1;
        
        this.watermarkElement.style.transform = `scale(${scale}) rotate(${rotation}deg)`;
        this.watermarkElement.style.opacity = opacity;
    }
    
    updateParticles() {
        this.particles.forEach(particle => {
            // Update position
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life--;
            
            // Wrap around edges
            if (particle.x < 0) particle.x = this.options.size;
            if (particle.x > this.options.size) particle.x = 0;
            if (particle.y < 0) particle.y = this.options.size;
            if (particle.y > this.options.size) particle.y = 0;
            
            // Reset particle if life expired
            if (particle.life <= 0) {
                particle.x = Math.random() * this.options.size;
                particle.y = Math.random() * this.options.size;
                particle.life = Math.random() * 100;
            }
            
            // Update element position
            particle.element.style.left = `${particle.x}px`;
            particle.element.style.top = `${particle.y}px`;
            particle.element.style.opacity = (particle.life / 100) * 0.5;
        });
    }
    
    addEventListeners() {
        // Hide on hover to avoid interference
        this.watermarkElement.addEventListener('mouseenter', () => {
            this.watermarkElement.style.opacity = '0.1';
        });
        
        this.watermarkElement.addEventListener('mouseleave', () => {
            this.watermarkElement.style.opacity = this.options.opacity;
        });
        
        // Responsive adjustments
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }
    
    handleResize() {
        // Adjust size for mobile
        if (window.innerWidth < 768) {
            this.watermarkElement.style.width = '60px';
            this.watermarkElement.style.height = '60px';
        } else if (window.innerWidth < 480) {
            this.watermarkElement.style.width = '48px';
            this.watermarkElement.style.height = '48px';
        } else {
            this.watermarkElement.style.width = `${this.options.size}px`;
            this.watermarkElement.style.height = `${this.options.size}px`;
        }
    }
    
    // Public methods
    show() {
        this.watermarkElement.style.display = 'block';
    }
    
    hide() {
        this.watermarkElement.style.display = 'none';
    }
    
    updateOptions(newOptions) {
        Object.assign(this.options, newOptions);
        this.setPosition();
        this.handleResize();
    }
    
    destroy() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        if (this.watermarkElement && this.watermarkElement.parentNode) {
            this.watermarkElement.parentNode.removeChild(this.watermarkElement);
        }
    }
}

// Auto-initialize for all Heady pages
function initHeadyWatermark() {
    // Check if watermark already exists
    if (document.querySelector('[data-heady-watermark]')) {
        return;
    }
    
    // Create watermark with default options
    const watermark = new AuroraWatermark({
        size: 80,
        opacity: 0.3,
        position: 'bottom-left',
        animationSpeed: 8,
        glowIntensity: 0.5
    });
    
    // Add to global scope for access
    window.headyWatermark = watermark;
    
    console.log('🌌 Heady Aurora Watermark initialized');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeadyWatermark);
} else {
    initHeadyWatermark();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuroraWatermark;
} else if (typeof window !== 'undefined') {
    window.AuroraWatermark = AuroraWatermark;
}

/**
 * CSS companion styles (include in your CSS file):
 * 
 * .heady-aurora-watermark {
 *   position: fixed;
 *   bottom: 16px;
 *   left: 16px;
 *   width: 80px;
 *   height: 80px;
 *   opacity: 0.3;
 *   pointer-events: none;
 *   z-index: 9999;
 *   mix-blend-mode: screen;
 *   filter: blur(2px);
 *   animation: gentle-flow 8s ease-in-out infinite;
 * }
 * 
 * @keyframes gentle-flow {
 *   0%, 100% { 
 *     opacity: 0.3; 
 *     transform: scale(1) rotate(0deg); 
 *   }
 *   50% { 
 *     opacity: 0.5; 
 *     transform: scale(1.05) rotate(180deg); 
 *   }
 * }
 * 
 * █▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
 * █▓▒░       🜃  Built with Sacred Geometry Principles  🜃        ░▒▓█
 * █▓▒░              ⟡  Maximum Global Happiness  ⟡               ░▒▓█
 * █▓▒░          🌌  Fractal Consciousness Architecture  🌌       ░▒▓█
 * █▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
 */
