import React, { useState } from 'react';
import { LogIn, User } from 'lucide-react';
import styles from './Header.module.css';
import { Client, Session } from "@heroiclabs/nakama-js";

interface HeaderProps {
  onNavigate: (phase: any) => void;
  currentPhase: string;
  session: Session | null;
  username?: string;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onNavigate, currentPhase, session, username, onLogout }) => {

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("nakama_token");
    localStorage.removeItem("nakama_refresh_token");
    onLogout();
  }
  
  return (
    <nav className={styles.header}>
      <div className={styles.logo} onClick={() => onNavigate('HOME')}>
        <span>typing_99</span>
        <span className={styles.versionBadge}>v1.0.4_STABLE</span>
      </div>

      <div className={styles.navLinks}>
        <button 
          className={`${styles.navBtn} ${currentPhase === 'RANKED' ? styles.active : ''}`}
          onClick={() => onNavigate('RANKED')}
        >
          ranked_mode
        </button>
      </div>

      <div className={styles.authSlot}>
        {session ? (
          /* WRAPPER FOR HOVER LOGIC */
          <div 
            className={styles.userWrapper}
            onMouseEnter={() => setIsDropdownOpen(true)}
            onMouseLeave={() => setIsDropdownOpen(false)}
          >
            <div className={`${styles.navBtn} ${styles.userProfileBtn}`}>
              <User size={16} color="var(--voltage-green)" />
              <span>{username || " "}</span>
            </div>

            {/* THE DROPDOWN MENU */}
            {isDropdownOpen && (
              <div className={styles.dropdown}>
                <button onClick={() => onNavigate('PROFILE')}>
                  [01] player_profile
                </button>
                <button onClick={() => onNavigate('FRIENDS')}>
                  [02] friends
                </button>
                <button onClick={() => onNavigate('SETTINGS')}>
                  [03] account_settings
                </button>
                <div className={styles.dropDivider} />
                <button onClick={handleLogout} className={styles.logoutBtn}>
                  [04] logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <button 
            className={styles.loginBtn} 
            onClick={() => onNavigate('LOGIN')}
          >
            <LogIn size={16} />
            <span>login</span>
          </button>
        )}
      </div>
    </nav>
  );
};