import React from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import styles from './Hero.module.css';

export const Hero: React.FC = () => {
  return (
    <motion.main 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={styles.heroWrapper}
    >
      <div className={styles.contentEntry}>
        <h1 className={styles.mainTitle}>
          SURVIVE THE <span className={styles.highlight}>STROKES</span>
        </h1>
        
        <p className={styles.subtitle}>
          The world's fastest Battle Royale typing game.
        </p>

        <div className={styles.ctaContainer}>
          <motion.button 
            whileHover={{ x: -4, y: -4, boxShadow: "12px 12px 0px 0px #000" }}
            whileTap={{ x: 0, y: 0, boxShadow: "0px 0px 0px 0px #000" }}
            className={styles.primaryBtn}
          >
            <Zap size={20} fill="currentColor" />
            QUICK PLAY
          </motion.button>
          
          <div className={styles.metaInfo}>
            <span className={styles.statusDot}></span>
            942 TYPISTS ONLINE // REGION: EU-WEST
          </div>
        </div>
      </div>
      
      {/* Decorative SVG Grid Background */}
      <div className={styles.bgGrid}></div>
    </motion.main>
  );
};