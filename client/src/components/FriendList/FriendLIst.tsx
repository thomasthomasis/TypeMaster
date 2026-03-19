import React from 'react';
import { motion } from 'framer-motion';
import { Wifi, WifiOff, MessageSquare } from 'lucide-react';
import styles from './FriendList.module.css';

export const FriendList: React.FC = () => {
  const friends = [
    { name: 'V0ID_WALKER', status: 'ONLINE', wpm: 142 },
    { name: 'CYBER_PUNK', status: 'IN_MATCH', wpm: 128 },
    { name: 'NE0N_GHOST', status: 'OFFLINE', wpm: 0 },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={styles.moduleOverlay}>
      <header className={styles.moduleHeader}>
        <MessageSquare size={20} /> <span>ACTIVE_NODES_IN_NETWORK</span>
      </header>

      <div className={styles.moduleContent}>
        <ul className={styles.friendList}>
          {friends.map(f => (
            <li key={f.name} className={styles.friendItem}>
              <div className={styles.friendInfo}>
                {f.status === 'OFFLINE' ? <WifiOff size={14} color="#333" /> : <Wifi size={14} color="var(--voltage-green)" />}
                <span className={styles.friendName}>{f.name}</span>
              </div>
              <div className={styles.friendMeta}>
                {f.status !== 'OFFLINE' && <span>{f.wpm} WPM</span>}
                <span className={styles.statusBadge}>{f.status}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
};