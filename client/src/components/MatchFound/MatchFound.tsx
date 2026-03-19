import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import styles from './MatchFound.module.css';

const TOTAL_PLAYERS = 100;

const GENERATED_PLAYERS = Array.from({ length: 100 }, (_, i) => ({
  id: i,
  username: `USER_${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
  wpm: Math.floor(Math.random() * (140 - 40 + 1)) + 40,
  rank: ["BRONZE", "SILVER", "GOLD", "PLATINUM"][Math.floor(Math.random() * 4)],
}));

export const MatchFound: React.FC<{ onMatchLocked: () => void }> = ({ onMatchLocked }) => {
  const [joinedPlayers, setJoinedPlayers] = useState<number[]>([]);
  const [isFull, setIsFull] = useState(false);

  useEffect(() => {
    if (joinedPlayers.length < TOTAL_PLAYERS) {
      const timeout = setTimeout(() => {
        // Add 1-5 random players at a time
        const newBatchSize = Math.floor(Math.random() * 5) + 1;
        const newPlayers = Array.from({ length: newBatchSize }, () => Math.floor(Math.random() * TOTAL_PLAYERS));
        setJoinedPlayers(prev => Array.from(new Set([...prev, ...newPlayers])));
      }, Math.random() * 300 + 100);
      return () => clearTimeout(timeout);
    } else {
      setIsFull(true);
      setTimeout(onMatchLocked, 2000000); // Wait 2s before starting battle
    }
  }, [joinedPlayers, onMatchLocked]);

  return (
    <div className={styles.lobbyContainer}>
      {/* 10x10 Background Grid */}
      <div className={styles.gridBackground}>
        {Array.from({ length: TOTAL_PLAYERS }).map((_, i) => (
          <div 
            key={i} 
            className={`${styles.gridCell} ${joinedPlayers.includes(i) ? styles.cellActive : ''}`}
          >
            {joinedPlayers.includes(i) && (
                <motion.div 
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                className={styles.playerMiniCard}
                >
                <div className={styles.miniName}>{GENERATED_PLAYERS[i].username}</div>
                <div className={styles.miniStats}>
                    <span>{GENERATED_PLAYERS[i].wpm}WPM</span>
                    <span className={styles.miniRank}>{GENERATED_PLAYERS[i].rank[0]}</span>
                </div>
                </motion.div>
            )}
          </div>
        ))}
      </div>

      {/* Hero Player Card (You) */}
      <motion.div 
        className={styles.heroCard}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <div className={styles.heroHeader}>MATCH_INITIALIZED</div>
        <div className={styles.heroMain}>
          <div className={styles.avatarBox}>PRO_TYPIST_99</div>
          <div className={styles.countContainer}>
            <span className={styles.count}>{joinedPlayers.length}</span>
            <span className={styles.total}>/ {TOTAL_PLAYERS}</span>
          </div>
        </div>
        <div className={styles.progressBar}>
          <motion.div 
            className={styles.progressFill} 
            animate={{ width: `${(joinedPlayers.length / TOTAL_PLAYERS) * 100}%` }}
          />
        </div>
        <div className={styles.statusLine}>
          {isFull ? "ready_to_go" : "waiting_for_players..."}
        </div>
      </motion.div>
    </div>
  );
};