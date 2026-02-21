import React, { useEffect, useRef } from 'react';

const SacredGeometryBackground = () => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let time = 0;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Sacred geometry patterns
    const patterns = {
      flowerOfLife: (ctx, x, y, size, time) => {
        const circles = 19;
        for (let i = 0; i < circles; i++) {
          const angle = (i * Math.PI * 2) / circles;
          const radius = size * 0.5;
          const cx = x + Math.cos(angle + time) * radius;
          const cy = y + Math.sin(angle + time) * radius;
          
          ctx.beginPath();
          ctx.arc(cx, cy, size * 0.15, 0, Math.PI * 2);
          ctx.strokeStyle = `hsla(${(time * 50 + i * 20) % 360}, 70%, 60%, 0.3)`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      },
      
      metatronCube: (ctx, x, y, size, time) => {
        const vertices = 6;
        for (let i = 0; i < vertices; i++) {
          const angle = (i * Math.PI * 2) / vertices + time;
          const vx = x + Math.cos(angle) * size;
          const vy = y + Math.sin(angle) * size;
          
          // Connect to center
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(vx, vy);
          ctx.strokeStyle = `hsla(${(time * 30 + i * 60) % 360}, 60%, 50%, 0.2)`;
          ctx.lineWidth = 1;
          ctx.stroke();
          
          // Connect to adjacent vertices
          const nextAngle = ((i + 1) % vertices * Math.PI * 2) / vertices + time;
          const nx = x + Math.cos(nextAngle) * size;
          const ny = y + Math.sin(nextAngle) * size;
          
          ctx.beginPath();
          ctx.moveTo(vx, vy);
          ctx.lineTo(nx, ny);
          ctx.strokeStyle = `hsla(${(time * 40 + i * 60) % 360}, 50%, 40%, 0.15)`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      },
      
      sriYantra: (ctx, x, y, size, time) => {
        const layers = 9;
        for (let i = 0; i < layers; i++) {
          const layerSize = size * (1 - i / layers);
          const triangles = 4;
          
          for (let j = 0; j < triangles; j++) {
            const angle = (j * Math.PI * 2) / triangles + time * 0.5;
            const x1 = x + Math.cos(angle) * layerSize;
            const y1 = y + Math.sin(angle) * layerSize;
            
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x1, y1);
            
            const nextAngle = ((j + 1) % triangles * Math.PI * 2) / triangles + time * 0.5;
            const x2 = x + Math.cos(nextAngle) * layerSize;
            const y2 = y + Math.sin(nextAngle) * layerSize;
            
            ctx.lineTo(x2, y2);
            ctx.closePath();
            
            ctx.strokeStyle = `hsla(${(time * 20 + i * 40 + j * 90) % 360}, 65%, 55%, ${0.1 + (layers - i) / layers * 0.2})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      },
      
      goldenSpiral: (ctx, x, y, size, time) => {
        const goldenRatio = 1.618033988749895;
        const points = 100;
        
        ctx.beginPath();
        for (let i = 0; i < points; i++) {
          const angle = i * 0.2 + time;
          const radius = size * Math.pow(goldenRatio, angle / (2 * Math.PI));
          const px = x + Math.cos(angle) * radius;
          const py = y + Math.sin(angle) * radius;
          
          if (i === 0) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        }
        
        ctx.strokeStyle = `hsla(${(time * 60) % 360}, 70%, 60%, 0.3)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    };

    const animate = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw multiple sacred geometry patterns
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const baseSize = Math.min(canvas.width, canvas.height) * 0.3;

      // Flower of Life
      patterns.flowerOfLife(ctx, centerX, centerY, baseSize, time * 0.5);
      
      // Metatron's Cube
      patterns.metatronCube(ctx, centerX, centerY, baseSize * 0.8, time * 0.3);
      
      // Sri Yantra
      patterns.sriYantra(ctx, centerX, centerY, baseSize * 1.2, time * 0.2);
      
      // Golden Spiral
      patterns.goldenSpiral(ctx, centerX, centerY, baseSize * 0.6, time * 0.7);

      // Add floating particles
      for (let i = 0; i < 50; i++) {
        const px = (Math.sin(time + i * 0.5) + 1) * canvas.width / 2;
        const py = (Math.cos(time * 0.7 + i * 0.3) + 1) * canvas.height / 2;
        const size = Math.sin(time + i) * 2 + 1;
        
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${(time * 50 + i * 7) % 360}, 70%, 60%, ${0.1 + Math.sin(time + i) * 0.1})`;
        ctx.fill();
      }

      time += 0.01;
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        opacity: 0.6,
        pointerEvents: 'none'
      }}
    />
  );
};

export default SacredGeometryBackground;
