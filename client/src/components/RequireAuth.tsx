import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuthStore, needsVerification } from '../store/useAuthStore'

// Wrap routes that need a signed-in, verified player.
export function RequireAuth() {
  const status = useAuthStore((s) => s.status)
  const account = useAuthStore((s) => s.account)
  const location = useLocation()

  if (status === 'loading') return <p className="muted">&gt; connecting...</p>
  if (status === 'signedOut') return <Navigate to="/login" replace state={{ from: location }} />
  if (needsVerification(account)) return <Navigate to="/verify-email" replace />
  return <Outlet />
}

// Wrap pages that only make sense when signed out (login, forgot password).
export function RedirectIfSignedIn() {
  const status = useAuthStore((s) => s.status)
  if (status === 'loading') return <p className="muted">&gt; connecting...</p>
  if (status === 'signedIn') return <Navigate to="/" replace />
  return <Outlet />
}