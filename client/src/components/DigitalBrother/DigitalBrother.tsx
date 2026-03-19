import React from 'react';
import { motion } from 'framer-motion';
import styles from './DigitalBrother.module.css';

export const DigitalBrother: React.FC = () => {
  return (
    <motion.div 
      className={styles.mascotContainer}
      animate={{ 
        boxShadow: [
          '0 0 20px rgba(0,255,102,0.2)',
          '0 0 40px rgba(0,255,102,0.4)',
          '0 0 20px rgba(0,255,102,0.2)'
        ]
      }}
      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
    >
      <div className={styles.zolaHead}>
        {/* Layer 1: The Intensity of the Shining Glasses */}
        <div className={styles.glassesBlock}>
          <div className={styles.leftLens} />
          <div className={styles.rightLens} />
        </div>

        {/* Layer 2: The Steepled Hands (Mouth Area) */}
        <div className={styles.mouthHandsBlock}>
          <div className={styles.handLeft} />
          <div className={styles.handRight} />
        </div>
      </div>

      {/* Arnim Zola Matrix Scans (Persistent Overlays) */}
      <div className={styles.scanlineOverlay} />
      <div className={styles.vignetteOverlay} />
    </motion.div>
  );
};