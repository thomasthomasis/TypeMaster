import React from 'react';
import { motion } from 'framer-motion';
import { User, Activity, Zap, Target, Award } from 'lucide-react';
import styles from './Profile.module.css';

export const Profile: React.FC = () => {
  const stats = [
    { label: 'AVERAGE_WPM', value: '104', color: 'var(--voltage-green)' },
    { label: 'PEAK_WPM', value: '142', color: '#fff' },
    { label: 'ACCURACY', value: '98.4%', color: 'var(--voltage-green)' },
    { label: 'MATCHES_WON', value: '842', color: '#fff' },
  ];

  const history = [
    { id: '#882', mode: 'RANKED_BR', placement: '01/100', wpm: '112', status: 'VICTORY' },
    { id: '#881', mode: 'STRIKE_1V1', placement: '02/02', wpm: '98', status: 'DEFEAT' },
    { id: '#880', mode: 'RANKED_BR', placement: '04/100', wpm: '108', status: 'TOP_10' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      className={styles.profileContainer}
    >
      <div className={styles.sidebar}>
        <div className={styles.avatarSection}>
          <div className={styles.avatarHex}>
            <User size={48} color="var(--voltage-green)" />
          </div>
          <h2 className={styles.username}>PRO_TYPIST_99</h2>
          <span className={styles.idTag}>UID: 992-001-X88</span>
        </div>

        <nav className={styles.sideNav}>
          <div className={styles.navItemActive}>COMBAT_RECORD</div>
          <div className={styles.navItem}>HARDWARE_CONFIG</div>
          <div className={styles.navItem}>SECURITY_LOGS</div>
        </nav>
      </div>

      <div className={styles.mainContent}>
        <section className={styles.statsGrid}>
          {stats.map((stat) => (
            <div key={stat.label} className={styles.statCard}>
              <span className={styles.statLabel}>{stat.label}</span>
              <span className={styles.statValue} style={{ color: stat.color }}>{stat.value}</span>
            </div>
          ))}
        </section>

        <section className={styles.historySection}>
          <h3 className={styles.sectionTitle}><Activity size={14} /> HISTORICAL_STRIKES</h3>
          <div className={styles.historyTable}>
            <div className={styles.tableHeader}>
              <span>MATCH_ID</span>
              <span>MODE</span>
              <span>RESULT</span>
              <span>WPM</span>
            </div>
            {history.map((match) => (
              <div key={match.id} className={styles.tableRow}>
                <span className={styles.matchId}>{match.id}</span>
                <span>{match.mode}</span>
                <span className={match.status === 'VICTORY' ? styles.win : styles.neutral}>
                  {match.status}
                </span>
                <span className={styles.matchWpm}>{match.wpm}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </motion.div>
  );
};