import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogIn, User, ChevronDown, ShieldAlert } from 'lucide-react';
import type { RootState } from '../../store/store';
import { clearAuth } from '../../store/authSlice';
import styles from './Header.module.css';

export const Header: React.FC = () => {

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // SELECTORS: Pluck exactly what we need from Redux
  const { session, isGuest } = useSelector((state: RootState) => state.auth);
  const username = session?.username || "guest_user";

  const handleLogout = () => {
    // 1. Wipe Redux state
    dispatch(clearAuth());
    // 2. Wipe LocalStorage
    localStorage.removeItem("nakama_token");
    localStorage.removeItem("nakama_refresh_token");
    // 3. Kick to Home
    navigate('/');
    setIsDropdownOpen(false);
  };

  // Helper for clean NavLink classes
  const getNavClass = ({ isActive }: { isActive: boolean}) => {
    return `${styles.navBtn} ${isActive ? styles.active : ''}`;
  }
  
  return (
    <nav className={styles.header}>
      {/* Logo now links to root */}
      <NavLink to="/" className={styles.logo}>
        <span>type_master</span>
        <span className={styles.versionBadge}>v1.0.4_STABLE</span>
      </NavLink>

      <div className={styles.navLinks}>
        <NavLink to="/" className={getNavClass} end>
          home_page
        </NavLink>

        <NavLink to="/typing-test" className={getNavClass}>
          typing_test
        </NavLink>

        <NavLink to="/game-modes" className={getNavClass}>
          game_modes
        </NavLink>

        <NavLink to="/global-intel" className={getNavClass}>
          global_intel
        </NavLink>
      </div>

      <div className={styles.authSlot}>
        {/* not authenticated at all */}
        {!session && (
          <NavLink to="/login" className={styles.loginBtn}>
            <LogIn size={16} />
            <span>login</span>
          </NavLink>
        )}

        {/* guest authenticated (Show both ID and Link option) */}
        {session && isGuest && (
          <div className={styles.guestContainer}>
            <div className={styles.guestBadge}>
              <ShieldAlert size={14} />
              <span>guets_mode</span>
            </div>
            <NavLink to="/login" className={styles.saveBtn}>
              [ save_progress ]
            </NavLink>
          </div>
        )}
        
        {/* Actual authentication (Standard Profile) */}
        {session && !isGuest && (
          <div 
            className={styles.userWrapper}
            onMouseEnter={() => setIsDropdownOpen(true)}
            onMouseLeave={() => setIsDropdownOpen(false)}
          >
            <div className={`${styles.navBtn} ${styles.userProfileBtn}`}>
              <User size={16} color="var(--voltage-green)" />
              <span>{username}</span>
              <ChevronDown size={12} className={isDropdownOpen ? styles.rotate : ''} />
            </div>

            {isDropdownOpen && (
              <div className={styles.dropdown}>
                {/* Dropdown items use NavLink for internal routing */}
                <NavLink to="/profile" onClick={() => setIsDropdownOpen(false)}>
                  [01] player_profile
                </NavLink>
                <NavLink to="/friends" onClick={() => setIsDropdownOpen(false)}>
                  [02] friends
                </NavLink>
                <NavLink to="/settings" onClick={() => setIsDropdownOpen(false)}>
                  [03] account_settings
                </NavLink>
                
                <div className={styles.dropDivider} />
                
                <button onClick={handleLogout} className={styles.logoutBtn}>
                  [04] logout
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};