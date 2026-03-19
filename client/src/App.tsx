import React, { useEffect, useState } from 'react';
import { AnimatePresence, resolveElements } from 'framer-motion';
import { BootLoader } from './components/BootLoader/BootLoader';
import { Home } from './components/Home/Home';
import { MatchFound } from './components/MatchFound/MatchFound';
import { RankedTier } from './components/RankedTier/RankedTier';
import { FriendList } from './components/FriendList/FriendLIst';
import { Profile } from './components/Profile/Profile';
import { Header } from './components/Header/Header';
import { Auth } from './components/Auth/Auth';

import { Session } from "@heroiclabs/nakama-js"; // For the Type
import { nakamaService } from './services/nakama';

// import { Battle } from './components/Battle/Battle;'
import './styles/variables.css';
import './App.css';


type SystemPhase = 'HOME' | 'MATCHING' | 'BATTLE' | 'RANKED' | 'FRIENDS' | 'PROFILE' | 'LOGIN';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [userAccount, setUserAccount] = useState<any>(null);

  const [isBooted, setIsBooted] = useState<boolean>(false);
  const [phase, setPhase] = useState<SystemPhase>('HOME');

  const handleAuthSuccess = (newSession: Session) => {
    setSession(newSession);
    setPhase('HOME'); // Redirect back to lobby after successful login
  };

  const handleLogout = () => {
    setSession(null);
    setUserAccount(null);
    setPhase('HOME');
  };

  useEffect(() => {
    const initAuth = async () => {
      const restored = nakamaService.restoreSession();

      if(!restored) {
        console.log("No session found.")
        return;
      }

      try {
        // 2. Manual JWT Validation (replacing .isexpired)
        const payload = JSON.parse(atob(restored.token.split('.')[1]));
        const isExpired = Date.now() >= (payload.exp * 1000 - 10000);

        if (isExpired) {
          console.warn("session expired.");
          localStorage.removeItem("nakama_token");
          localStorage.removeItem("nakama_refresh_token");
          setSession(null);
          return;
        }

        // 3. Session is valid -> Fetch Account Data
        console.log("SESSION_VERIFIED // SYNCING_NODE_DATA...");
        setSession(restored);
        
        const account = await nakamaService.getAccount(restored);
        setUserAccount(account.user);
        if(account.user) {
           console.log(`WELCOME_BACK // ${account.user.username}`);
        }
       

      } catch (err) {
        console.error("AUTH_SYNC_ERROR // EMERGENCY_LOGOUT", err);
        setSession(null);
      }
    }
    initAuth();
  }, [])
  
  return (
    <div className="app-container">
      <AnimatePresence mode="wait">
        {!isBooted ? (
          <BootLoader 
            key="loader" 
            onBootComplete={() => setIsBooted(true)} 
          />
        ) : (
          <>
            <Header 
              onNavigate={(newPhase: SystemPhase) => setPhase(newPhase)} 
              currentPhase={phase}
              session={session}
              username={session?.username || "UNAUTHORIZED_NODE"}
              onLogout={handleLogout}
            />
            <main className="system-viewport">
                {phase === 'HOME' && <Home onFindMatch={() => setPhase('MATCHING')} />}
                {phase === 'LOGIN' && <Auth onAuthSuccess={handleAuthSuccess} />}
                {phase === 'MATCHING' && <MatchFound onMatchLocked={() => setPhase('BATTLE')} />}
                {phase === 'RANKED' && <RankedTier />}
                {phase === 'FRIENDS' && <FriendList />}
                {phase === 'PROFILE' && <Profile />}
            </main>
          </>
         
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;