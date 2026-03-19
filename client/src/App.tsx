import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

import { BootLoader } from './components/BootLoader/BootLoader';
import { Home } from './components/Home/Home';
import { FriendList } from './components/FriendList/FriendLIst';
import { Profile } from './components/Profile/Profile';
import { Header } from './components/Header/Header';
import { Auth } from './components/Auth/Auth';
import { DiscordCallback } from './components/DiscordCallback/DiscordCallback';

import { nakamaService } from './services/nakama';
import { setAuth, clearAuth } from './store/authSlice';
import { useAuth } from './hooks/useAuth';

// import { Battle } from './components/Battle/Battle;'
import './styles/variables.css';
import styles from './App.module.css';


export type SystemPhase = 'HOME' | 'MATCHING' | 'BATTLE' | 'TYPING_TEST' | 'GAME_MODES' | 'GLOBAL_INTEL' | 'LOGIN' | 'PROFILE' | 'FRIENDS' | 'SETTINGS';

const App: React.FC = () => {

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isAuthenticated, session } = useAuth();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const bootSequence = async () => {
      setIsInitializing(true);
      try {
        const restored = await nakamaService.restoreSession();
        
        if (restored) {
          const payload = JSON.parse(atob(restored.token.split('.')[1]));
          const isExpired = Date.now() >= (payload.exp * 1000 - 10000);

          if (!isExpired) {
            // Here, we need to know if the restored session was a guest
            // If you store 'is_guest' in localStorage during login, check it here
            const wasGuest = localStorage.getItem("is_guest") === "true";
            dispatch(setAuth({ session: restored, isGuest: wasGuest }));
          } else {
            dispatch(clearAuth());
          }
        } else {
          // Do not call authenticateGuest() here. 
          // Leave the user unauthenticated so they see the clean Landing Page.
          dispatch(clearAuth()); 
        }
      } catch (err) {
        dispatch(clearAuth());
      } finally {
        setIsInitializing(false);
      }
  };

  bootSequence();
}, [dispatch]);

  if(isInitializing) {
    return <BootLoader key="loader" onBootComplete={() => {}} />;
  }
 
  
  return (
      <div className={styles.appWrapper}>
        <Header />

        <main className={styles.viewport}>
          <Routes>
            {/* PUBLIC ROUTES */}
            <Route path="/auth/callback" element={<DiscordCallback />} />
            
            {/* AUTH PROTECTION LOGIC */}
            <Route 
              path="/login" 
              element={!isAuthenticated ? <Auth onAuthSuccess={() => {}} /> : <Navigate to="/" />} 
            />

            {/* PROTECTED ROUTES */}
            <Route 
              path="/" 
              element={<Home onFindMatch={() => navigate('/matchmaking')} />} 
            />
            
            <Route 
              path="/profile" 
              element={isAuthenticated ? <Profile /> : <Navigate to="/login" />} 
            />
            
            <Route 
              path="/friends" 
              element={isAuthenticated ? <FriendList /> : <Navigate to="/login" />} 
            />

            {/* FALLBACK */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>

        <footer className={styles.terminalFooter}>
          <span>status: {isAuthenticated ? 'user_authenticated' : 'guest_access'} // </span>
          <span>latency: 24ms</span>
        </footer>
      </div>
  );
};

export default App;