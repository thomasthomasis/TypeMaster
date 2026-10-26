import { Navigate, useNavigate } from 'react-router'
import { useAuthStore, hasChosenUsername, needsVerification } from '../store/useAuthStore'
import { UsernameForm } from '../components/UsernameForm'

export default function ChooseUsername() {
  const { status, account, logout } = useAuthStore()
  const navigate = useNavigate()

  if (status === 'loading') return <p className="muted">&gt; connecting...</p>
  if (status === 'signedOut') return <Navigate to="/login" replace />
  if (hasChosenUsername(account)) return <Navigate to="/" replace />

  return (
    <div className="panel">
      <h1>&gt; choose a username_</h1>
      <p className="muted">This is the name other players see.</p>
      <UsernameForm
        submitLabel="continue"
        // New email accounts go on to verify; everyone else goes home.
        onDone={() => navigate(needsVerification(useAuthStore.getState().account) ? '/verify-email' : '/', { replace: true })}
      />
      <button onClick={logout}>sign out</button>
    </div>
  )
}