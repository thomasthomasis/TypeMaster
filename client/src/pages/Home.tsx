import { Link } from 'react-router'
import { useAuthStore, isGuest, needsVerification, canPlayRanked } from '../store/useAuthStore'

export default function Home() {
  const { account, logout } = useAuthStore()

  return (
    <div className="panel">
      <h1>&gt; TYPEMASTER_</h1>
      <p>
        welcome, <strong>{account?.user?.username}</strong>
        {isGuest(account) && <span className="muted"> (guest)</span>}
      </p>

      {needsVerification(account) && (
        <p className="muted">
          <Link to="/verify-email">verify your email</Link> to unlock ranked
        </p>
      )}
      {!canPlayRanked(account) && !needsVerification(account) && (
        <p className="muted">
          casual only. <Link to="/account">link an email or discord</Link> to unlock ranked
        </p>
      )}
        <Link to="/play">play</Link>
        <Link to="/account">account</Link>
        <button onClick={logout}>sign out</button>
    </div>
  )
}