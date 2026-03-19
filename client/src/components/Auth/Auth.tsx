import React, { useState } from 'react';
import { Mail, Lock, LogIn, UserPlus } from 'lucide-react';
import { SiDiscord, SiGoogle } from 'react-icons/si';
import { nakamaService } from '../../services/nakama';
import styles from './Auth.module.css';
import { generateCodeChallenge, generateCodeVerifier } from '../../utils/pcke';

const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;

interface AuthProps {
  onAuthSuccess: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {


    const [regEmail, setRegEmail] = useState('');
    const [regEmailVerify, setRegEmailVerify] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [regPasswordVerify, setRegPasswordVerify] = useState('');
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(true);


  const handleAuth = async (e: React.FormEvent, type: 'login' | 'register') => {
    e.preventDefault();
    const email = type === 'login' ? loginEmail : regEmail;
    const password = type === 'login' ? loginPassword : regPassword;
    
    try {
      await nakamaService.authenticateEmail(email, password, type === 'register');
      // If rememberMe is false, we could handle token cleanup on tab close, 
      // but Nakama's restoreSession handles most of this via LocalStorage anyway.
      onAuthSuccess();
    } catch (err) {
      console.error(`${type.toUpperCase()}_FAILURE`, err);
    }
  };

  const handleDiscordLogin = async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);

    sessionStorage.setItem('discord_verifier', verifier);

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: 'http://localhost:5173/auth/callback',
        response_type: 'code', // We want a CODE, not a token
        scope: 'identify email',
        code_challenge: challenge,
        code_challenge_method: 'S256'
    })

    window.location.href = `https://discord.com/api/oauth2/authorize?${params}`;
  }

 return (
    <div className={styles.authPage}>
      <div className={styles.splitWrapper}>
        
        {/* LEFT SIDE: REGISTER */}
        <div className={styles.authSection}>
          <div className={styles.sectionHeader}>
            <UserPlus size={18} />
            <span>register_account</span>
          </div>
          <form onSubmit={(e) => handleAuth(e, 'register')}>
            <div className={styles.inputGroup}>
              <Mail size={14} />
              <input type="email" placeholder="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
            </div>
            <div className={styles.inputGroup}>
              <Mail size={14} />
              <input type="email_confirm" placeholder="verify_email" value={regEmailVerify} onChange={e => setRegEmailVerify(e.target.value)} required />
            </div>
            <div className={styles.inputGroup}>
              <Lock size={14} />
              <input type="password" placeholder="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} required />
            </div>
            <div className={styles.inputGroup}>
              <Lock size={14} />
              <input type="password" placeholder="verify_password" value={regPasswordVerify} onChange={e => setRegPasswordVerify(e.target.value)} required />
            </div>
            <button type="submit" className={styles.actionBtn} disabled>
              <UserPlus size={16} /> register
            </button>
          </form>
        </div>

        <div className={styles.verticalDivider} />

        {/* RIGHT SIDE: LOGIN */}
        <div className={styles.authSection}>
          <div className={styles.sectionHeader}>
            <LogIn size={18} />
            <span>login</span>
          </div>
          
          <div className={styles.socialFooter}>
            <button className={styles.socialIconBtn} onClick={() => handleDiscordLogin()}>
            <SiDiscord size={20} />
            </button>
            <button className={styles.socialIconBtn}>
            <SiGoogle size={20} />
            </button>
        </div>
          <form onSubmit={(e) => handleAuth(e, 'login')}>
            <div className={styles.inputGroup}>
              <Mail size={14} />
              <input type="email" placeholder="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
            </div>
            <div className={styles.inputGroup}>
              <Lock size={14} />
              <input type="password" placeholder="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
            </div>
            
            <div className={styles.formFooter}>
              <label className={styles.checkboxContainer}>
                <input type="checkbox" checked={rememberMe} onChange={() => setRememberMe(!rememberMe)} />
                <span className={styles.customCheck}></span>
                <span className={styles.labelTitle}>
                    remember_me
                </span>
              </label>
              <button type="submit" className={styles.actionBtn}>
                <LogIn size={16} /> login
              </button>
              <p className={styles.forgotBtn}>
                forgot_password_?
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* SOCIAL FOOTER */}
      
    </div>
  );
};