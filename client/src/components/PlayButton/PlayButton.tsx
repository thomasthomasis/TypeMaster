import React, { useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { Zap } from 'lucide-react';
import styles from './PlayButton.module.css';

interface Props {
  onHoverStart: () => void;
  onHoverEnd: () => void;
  text: string;
  onFindMatch: () => void; // Callback to handle the transition
}

export const PlayButton: React.FC<Props> = ({ onHoverStart, onHoverEnd, text, onFindMatch }) => {

    const controls = useAnimation();
    const [isRuptured, setIsRuptured] = useState(false);

    // Handle the click sequence
    const handleClick = async () => {
        setIsRuptured(true); // Trigger the final visual "burst"

        // Animate a massive, violent pulse before transitioning
        await controls.start({
        scale: 1.15,
        filter: "brightness(5) contrast(1.5) blur(5px)", // "Burning Out" look
        transition: { duration: 0.1, ease: "easeInOut" }
        });

        // Provide some feedback "hang time"
        setTimeout(() => {
            onFindMatch(); // Execute the page load
        }, 400); // 0.4s delay for impact
    }
  
    return (
    <motion.button 
      className={`${styles.button} ${isRuptured ? styles.burstState : ''}`}
      
      // 1. Tense Initial State
      initial={{ scale: 1 }}
      
      // 2. Slow "Tension" Animation on Hover (4s to match vignette/shake)
      whileHover={{ 
        scale: 1.05,
        transition: { duration: 4.0, ease: "easeInOut" }
      }}

      // 3. Brutalist "Slam" Reset on Leave
      onMouseLeave={() => {
        onHoverEnd();
        controls.start({ scale: 1 });
      }}

      onMouseEnter={onHoverStart}
      onClick={handleClick} // Trigger the rupture
      animate={controls} // Connect the rupture animation controls
      whileTap={{ scale: 0.98 }}
    >
      {/* THE INNER Power Core GLITCH LAYER (Constant background jitter) */}
      <motion.div 
        className={styles.glitchOverlay}
        animate={{ opacity: [0, 0.2, 0, 0.1, 0] }}
        transition={{ duration: 0.2, repeat: Infinity }}
      />

      <Zap fill="currentColor" size={24} className={styles.icon} />
      <span className={styles.text}>{text}</span>
    </motion.button>
  );
};