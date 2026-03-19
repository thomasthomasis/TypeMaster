import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Github, Chrome, ShieldAlert, Zap } from 'lucide-react';
import { nakamaService } from '../../services/nakama';
import styles from './Auth.module.css';

interface AuthProps {
  onAuthSuccess: (session: any) => void;
}

export const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const session = await nakamaService.authenticate(email, password, isRegister);
      onAuthSuccess(session);

      console.log(session)
    } catch (err: any) {
      setError(err.message || "AUTHENTICATION_FAILED");
    }
  };

  const handleSocialLogin = (provider: 'google' | 'github') => {
    console.log(`INITIATING_${provider.toUpperCase()}_HANDSHAKE`);
    // Logic for window.location redirect to Nakama social provider endpoint
  };

  return (
    <div className={styles.authOverlay}>
      <motion.div 
        className={styles.authCard}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className={styles.header}>
          <ShieldAlert size={20} className={styles.iconGlow} />
          <h2>{isRegister ? 'CREATE_NEW_NODE' : 'SYSTEM_ACCESS_REQUIRED'}</h2>
        </div>

        {error && <div className={styles.errorMsg}>!! {error}</div>}

        <form onSubmit={handleEmailAuth} className={styles.form}>
          <div className={styles.inputGroup}>
            <Mail size={16} />
            <input 
              type="email" 
              placeholder="EMAIL / USERNAME" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>
          <div className={styles.inputGroup}>
            <Lock size={16} />
            <input 
              type="password" 
              placeholder="PASSWORD" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>
          
          <button type="submit" className={styles.primaryBtn}>
            <Zap size={16} /> {isRegister ? 'INITIALIZE_ACCOUNT' : 'GRANT_ACCESS'}
          </button>
        </form>

        <div className={styles.divider}><span>OR_EXTERNAL_PROVERS</span></div>

        <div className={styles.socialGrid}>
          <button onClick={() => handleSocialLogin('google')} className={styles.socialBtn}>
            <Chrome size={18} /> GOOGLE
          </button>
          <button onClick={() => handleSocialLogin('github')} className={styles.socialBtn}>
            <Github size={18} /> GITHUB
          </button>
        </div>

        <button 
          className={styles.toggleBtn}
          onClick={() => setIsRegister(!isRegister)}
        >
          {isRegister ? 'ALREADY_HAVE_ACCESS?_LOGIN' : 'NEW_IDENTIFIER?_REGISTER'}
        </button>
      </motion.div>
    </div>
  );
};