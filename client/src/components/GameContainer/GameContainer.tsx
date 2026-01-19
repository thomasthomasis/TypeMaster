import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useGameStore } from "../../store/useGameStore";

interface GameContainerProps {
  children: React.ReactNode;
}

export const GameContainer: React.FC<GameContainerProps> = ({ children }) => {
  const { health, isDead } = useGameStore();
  const [isShaking, setIsShaking] = useState(false);
  
  // Keep track of what health was in the previous render
  const prevHealthRef = useRef(health);

  useEffect(() => {
    // If health has dropped, trigger the shake
    if (health < prevHealthRef.current) {
      setIsShaking(true);
    }
    
    // Update the ref for the next comparison
    prevHealthRef.current = health;
  }, [health]);

  // Static shake values
  const shakeX = 8;
  const shakeY = 4;

  return (
    <motion.div
      className="game-container-wrapper"
      // Animate based on the local 'isShaking' state or 'isDead'
      animate={isShaking || isDead ? {
        x: [0, -shakeX, shakeX, -shakeX, shakeX, 0],
        y: [0, shakeY, -shakeY, shakeY, -shakeY, 0],
      } : {
        x: 0,
        y: 0
      }}
      transition={{ 
        duration: 0.2, 
        ease: "easeInOut" 
      }}
      // Reset the local toggle so it can be triggered again on next hit
      onAnimationComplete={() => setIsShaking(false)}
      style={{ 
        width: '100%', 
        position: 'relative',
        filter: isDead ? 'grayscale(100%) brightness(0.7)' : 'none',
        transition: 'filter 0.5s ease',
      }}
    >
      {children}

      {/* Red Flash Overlay triggered by the same local state */}
      {isShaking && !isDead && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.3, 0] }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'absolute',
            inset: -50,
            backgroundColor: 'rgba(239, 68, 68, 0.4)',
            pointerEvents: 'none',
            zIndex: 99,
            borderRadius: '8px'
          }}
        />
      )}
    </motion.div>
  );
};