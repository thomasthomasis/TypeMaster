import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Activity } from 'lucide-react';
import { Header } from '../Header/Header';
import { MatrixRain } from '../MatrixRain/MatrixRain';
import { PlayButton } from '../PlayButton/PlayButton';
import styles from './Home.module.css';

const SYSTEM_MESSAGES = [
  "execute_strike_protocol",
  "initiate_system_purge",
  "access_combat_kernel",
  "authorize_digital_warfare"
];

interface HomeProps {
  onFindMatch: () => void;
}

export const Home: React.FC<HomeProps> = ({ onFindMatch }) => {

  const [isHovered, setIsHovered] = useState(false);
  const [isEmpActive, setIsEmpActive] = useState(false);
  const [pulseIntensity, setPulseIntensity] = useState(0);
  const [shake, setShake] = useState(0);

  const [coords, setCoords] = useState({ x: 0, y: 0 }); // New state for jitter
  const [displayText, setDisplayText] = useState("");
  const [msgIndex, setMsgIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const isLoggedIn = true;

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleFindMatch = () => {
    setIsEmpActive(true); // Kill the Matrix Rain and fire the pulse
    
    // Simulate the system "rebooting" into the lobby after the explosion
    setTimeout(() => {
      console.log("SIGNALING_APP_PHASE_CHANGE");
      onFindMatch();
    }, 1500);
  };

  // 1. Ramping up the Intensity
  useEffect(() => {
    if (isHovered) {
      timerRef.current = setInterval(() => {
        setShake(prev => Math.min(prev + 0.2, 12)); 
        setPulseIntensity(prev => Math.min(prev + 0.05, 1));
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setShake(0);
      setPulseIntensity(0);
      setCoords({ x: 0, y: 0 });
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isHovered]);

  // 2. High-Frequency Jitter (Matches your monitor's refresh rate)
  useEffect(() => {
    let frame: number;
    const jitter = () => {
      if (isHovered && shake > 0) {
        setCoords({
          x: (Math.random() - 0.5) * shake,
          y: (Math.random() - 0.5) * shake,
        });
      }
      frame = requestAnimationFrame(jitter);
    };
    frame = requestAnimationFrame(jitter);
    return () => cancelAnimationFrame(frame);
  }, [isHovered, shake]);

  // Typing effect logic
  useEffect(() => {
    const currentFullText = SYSTEM_MESSAGES[msgIndex];
    
    // Human-like typing: Random delay between 50ms and 150ms
    // Erasing: Faster, more mechanical delay
    const typingSpeed = isDeleting 
      ? 40 
      : Math.floor(Math.random() * (150 - 50 + 1)) + 50;

    const timeout = setTimeout(() => {
      if (!isDeleting && displayText === currentFullText) {
        // Pause at the end of the phrase before deleting
        setTimeout(() => setIsDeleting(true), 2000);
      } else if (isDeleting && displayText === "") {
        setIsDeleting(false);
        setMsgIndex((prev) => (prev + 1) % SYSTEM_MESSAGES.length);
      } else {
        const nextText = isDeleting
          ? currentFullText.substring(0, displayText.length - 1)
          : currentFullText.substring(0, displayText.length + 1);
        setDisplayText(nextText);
      }
    }, typingSpeed);

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, msgIndex]);

  return (
    <div 
      className={`${styles.homeContainer} ${isEmpActive ? styles.empFlash : ''}`}
      /* Pass the intensity to CSS for the grid pulses */
      style={{ '--pulse-intensity': pulseIntensity } as React.CSSProperties}
    >

      {/* Background Layer */}
      {!isEmpActive && <MatrixRain />}

      {/* 2. Electronic Grid Layer */}
      <div className={`${styles.electronicGrid} ${isHovered ? styles.gridActive : ''}`}>
        <div className={styles.gridLines} />
        {/* This div will use the --pulse-intensity variable in CSS */}
        <div className={styles.gridPulses} />
      </div>

      {/* 3. EMP & Shockwave Layers */}
      <div className={`${styles.empOverlay} ${isEmpActive ? styles.empFired : ''}`} />
      {isEmpActive && (
        <motion.div 
          className={styles.shockwave}
          initial={{ scale: 0, opacity: 1, border: '10px solid var(--voltage-green)' }}
          animate={{ scale: 4, opacity: 0, border: '0px solid var(--voltage-green)' }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      )}

      {/* 4. Vignette (Should be above background but below text) */}
      <div className={`${styles.vignetteOverlay} ${isHovered ? styles.vignetteActive : ''}`} />
        
      <div 
        className={styles.shakeWrapper}
        style={{ 
          transform: `translate(${coords.x}px, ${coords.y}px)`,
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}
      >

      <main className={styles.content}>
          
          {/* LEFT COLUMN: Data Stack */}
          <aside className={styles.dataColumn}>
            {/* Top Card: Basic User Vitals */}
            <motion.section 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className={styles.card}
            >
              <div className={styles.cardHeader}><Activity size={16}/> user_stats</div>
              <div className={styles.rankedStats}>
                <div className={styles.rankTier}>current_rank: gold_3</div>
                <div className={styles.statLine}>avg_wpm: 104</div>
              </div>
            </motion.section>

            {/* Bottom Card: 10-Player Leaderboard */}
            <motion.section 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className={styles.card}
            >
              <div className={styles.cardHeader}><Trophy size={16}/> global_top_10</div>
              <ul className={styles.leaderList}>
                <li>01. V0ID_WALKER // 162_wpm</li>
                <li>02. CYBER_PUNK // 158_wpm</li>
                <li>03. NE0N_GHOST // 155_wpm</li>
                <li>04. TYPE_OR_DIE // 152_wpm</li>
                <li>05. BIT_CRUSHER // 149_wpm</li>
                <li>06. NULL_POINTER // 145_wpm</li>
                <li>07. ROOT_ACCESS // 142_wpm</li>
                <li>08. KERNEL_PANIC // 138_wpm</li>
                <li>09. SYNTAX_ERR // 135_wpm</li>
                <li>10. DATA_GHOST // 131_wpm</li>
              </ul>
            </motion.section>
          </aside>

          <section className={styles.playModule}>
            <h1 className={styles.heroTitle}>
              <span className={styles.ready}>
                 {displayText}<span className={styles.cursor}>_</span>
              </span>
            </h1>
            
            <PlayButton 
              onHoverStart={() => setIsHovered(true)}
              onHoverEnd={() => setIsHovered(false)}
              text="find_match"
              onFindMatch={handleFindMatch}
            />
            
            <div className={styles.queueMeta}>
              <p>wait_time: 00:14 // load: 421</p>
              <p className={styles.onlineCount}>active_typists_online: 1,402</p>
            </div>
          </section>

         
      </main>

      {/* FOOTER: System Diagnostics */}
     <footer className={styles.footer}>
        <div className={styles.sysInfo}>current_region: eu_west</div>
      </footer>

      
      </div>
    </div>
  );
};