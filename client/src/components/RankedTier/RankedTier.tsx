import React from 'react';
import { motion } from 'framer-motion';
import { Shield, TrendingUp, Target } from 'lucide-react';
import styles from './RankedTier.module.css';

export const RankedTier: React.FC = () => {
  const ranks = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'STRIKE_MASTER'];
  const currentRank = 'GOLD III';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={styles.moduleOverlay}>
      <header className={styles.moduleHeader}>
        <Shield size={20} /> <span>RANKED_HIERARCHY_V4.2</span>
      </header>
      
      <div className={styles.moduleContent}>
        <div className={styles.rankProgress}>
          {ranks.map((rank, i) => (
            <div key={rank} className={`${styles.rankNode} ${currentRank.includes(rank) ? styles.activeRank : ''}`}>
              <div className={styles.rankIndex}>0{i + 1}</div>
              <div className={styles.rankLabel}>{rank}</div>
            </div>
          ))}
        </div>

        <section className={styles.statsGrid}>
          <div className={styles.statCard}>
            <TrendingUp size={16} /> <span>AVG_PLACEMENT: #12</span>
          </div>
          <div className={styles.statCard}>
            <Target size={16} /> <span>STRIKE_ACCURACY: 98.4%</span>
          </div>
        </section>
      </div>
    </motion.div>
  );
};