import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router'
import { useAuthStore, needsVerification } from '../store/useAuthStore'
import { useAsyncAction } from '../components/useAsyncAction'

export default function VerifyEmail() {
  const { status, account, verifyEmail, resendVerification, logout } = useAuthStore()
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const { busy, error, run } = useAsyncAction()

  if (status === 'loading') return <p className="muted">&gt; connecting...</p>
  if (status === 'signedOut') return <Navigate to="/login" replace />
  if (!needsVerification(account)) return <Navigate to="/" replace />

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setNotice(null)
    run(() => verifyEmail(code)) // success re-renders and redirects home
  }

  async function onResend() {
    setNotice(null)
    if (await run(resendVerification)) setNotice('new code sent')
  }

  return (
    <div className="panel">
      <h1>&gt; verify email_</h1>
      <p className="muted">We sent a 6-digit code to {account?.email}. Verifying unlocks ranked.</p>

      <form onSubmit={onSubmit}>
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />
        <button type="submit" disabled={busy || code.length !== 6}>
          verify
        </button>
      </form>

      {error && <p className="error">! {error}</p>}
      {notice && <p className="success">{notice}</p>}

      <button disabled={busy} onClick={onResend}>
        resend code
      </button>
        <Link to="/">skip for now</Link>
      <button onClick={logout}>sign out</button>
    </div>
  )
}