import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Terminal } from 'lucide-react';
import styles from './BootLoader.module.css';

const BOOT_LOGS = [
  "INITIALIZING NAKAMA_V3_CORE...",
  "ESTABLISHING SECURE_WS_RELAY...",
  "SYSTEM_READY // WELCOME TO TYPING 99"
];

interface BootLoaderProps {
  onBootComplete: () => void; // Change 'onComplete' to 'onBootComplete'
}

export const BootLoader: React.FC<BootLoaderProps> = ({ onBootComplete }) => {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    BOOT_LOGS.forEach((log, i) => {
      setTimeout(() => {
        setLogs(prev => [...prev, log]);
        if (i === BOOT_LOGS.length - 1) setTimeout(onBootComplete, 1000);
      }, i * 200);
    });
  }, [onBootComplete]);

  return (
    <motion.div 
      exit={{ opacity: 0, filter: "blur(20px)" }}
      className={styles.overlay}
    >
      <div className={styles.terminalContainer}>
        <div className={styles.header}>
          <Terminal size={20} />
          <span>T99_OS_TERMINAL</span>
        </div>
        
        <div className={styles.logArea}>
          {logs.map((log, i) => (
            <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={styles.logRow}>
              <span className={styles.timestamp}>[{new Date().toLocaleTimeString()}]</span>
              {log}
            </motion.div>
          ))}
          <span className={styles.cursor} />
        </div>
      </div>
    </motion.div>
  );
};