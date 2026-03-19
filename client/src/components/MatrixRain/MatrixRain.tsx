import React, { useEffect, useRef } from 'react';
import styles from './MatrixRain.module.css';

export const MatrixRain: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle resizing
    const setCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    setCanvasSize();
    window.addEventListener('resize', setCanvasSize);

    const characters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const fontSize = 16; // Increased size = fewer columns (more sparse)
    const columns = canvas.width / fontSize;
    const drops: number[] = Array(Math.floor(columns)).fill(1);

    const draw = () => {
      // Darker trail for a cleaner look
      ctx.fillStyle = 'rgba(10, 10, 11, 0.15)'; 
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#00ff66'; 
      ctx.font = `${fontSize}px "JetBrains Mono", monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = characters.charAt(Math.floor(Math.random() * characters.length));
        
        // Only draw if the drop is active
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        // Reset drop to top with a very low probability (makes it fall less often)
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.99) {
          drops[i] = 0;
        }
        
        drops[i]++;
      }
    };

    // Slowed down from 33ms to 60ms for a more "drifting" feel
    const interval = setInterval(draw, 60); 

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', setCanvasSize);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.matrixCanvas} />;
};