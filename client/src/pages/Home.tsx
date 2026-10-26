import { Link } from 'react-router'
import { useAuthStore, isGuest } from '../store/useAuthStore'

export default function Home() {
  const { account, logout } = useAuthStore()

  return (
    <div className="panel">
      <h1>&gt; TYPEMASTER_</h1>
      <p>
        welcome, <strong>{account?.user?.display_name || account?.user?.username}</strong>
        {isGuest(account) && <span className="muted"> (guest)</span>}
      </p>
      <Link to="/account">account</Link>
      <button onClick={logout}>sign out</button>
    </div>
  )
}