import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useAuthStore, isGuest, hasDiscord } from '../store/useAuthStore'
import { useAsyncAction } from '../components/useAsyncAction'
import { discordEnabled, startDiscordAuth } from '../lib/discord'

export default function Account() {
  const { account, linkEmail, logout } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { busy, error, run } = useAsyncAction()
  const guest = isGuest(account)

  // On success the account gains an email, and RequireAuth sends us to /verify-email.
  function onLinkEmail(e: FormEvent) {
    e.preventDefault()
    run(() => linkEmail(email, password))
  }

  return (
    <div className="panel">
      <h1>&gt; account_</h1>
      <p>
        user: <strong>{account?.user?.display_name || account?.user?.username}</strong>
      </p>
      <p className="muted">
        {guest ? 'guest account (inactive guests are removed after 30 days)' : ''}
        {account?.email ? `email: ${account.email}` : ''}
        {hasDiscord(account) ? ' · discord linked' : ''}
      </p>

      {!account?.email && (
        <form onSubmit={onLinkEmail}>
          <p className="muted">add an email{guest ? ' to keep your progress' : ''}:</p>
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
            link email
          </button>
        </form>
      )}

      {discordEnabled && !hasDiscord(account) && (
        <button disabled={busy} onClick={() => startDiscordAuth('link')}>
          link discord
        </button>
      )}

      {error && <p className="error">! {error}</p>}

      <Link to="/">back</Link>
      <button onClick={logout}>sign out</button>
    </div>
  )
}