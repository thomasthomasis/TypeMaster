import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useAuthStore } from '../store/useAuthStore'
import { useAsyncAction } from '../components/useAsyncAction'
import { discordEnabled, startDiscordAuth } from '../lib/discord'

export default function Login() {
  const [mode, setMode] = useState<'signin' | 'register'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const { loginEmail, registerEmail, loginGuest } = useAuthStore()
  const { busy, error, run } = useAsyncAction()

  // On success the store flips to signedIn and RedirectIfSignedIn sends us on.
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    run(() =>
      mode === 'signin' ? loginEmail(email, password) : registerEmail(email, password, username),
    )
  }

  return (
    <div className="panel">
      <h1>&gt; TYPEMASTER_</h1>

      <div className="tabs">
        <button className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>
          sign in
        </button>
        <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>
          create account
        </button>
      </div>

      <form onSubmit={onSubmit}>
        {mode === 'register' && (
          <input placeholder="username (optional)" value={username} onChange={(e) => setUsername(e.target.value)} />
        )}
        <input type="email" placeholder="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          type="password"
          placeholder="password (8+ chars)"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" disabled={busy}>
          {mode === 'signin' ? 'sign in' : 'create account'}
        </button>
      </form>

      {error && <p className="error">! {error}</p>}

      <div className="divider">or</div>
      {discordEnabled && (
        <button disabled={busy} onClick={() => startDiscordAuth('login')}>
          continue with discord
        </button>
      )}
      <button disabled={busy} onClick={() => run(loginGuest)}>
        play as guest
      </button>

      <p className="muted">
        <Link to="/forgot-password">forgot password?</Link>
      </p>
    </div>
  )
}