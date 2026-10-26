import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useAuthStore } from '../store/useAuthStore'
import { useAsyncAction } from '../components/useAsyncAction'

export default function ForgotPassword() {
  const { requestPasswordReset, resetPassword } = useAuthStore()
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const { busy, error, run } = useAsyncAction()

  async function onRequest(e: FormEvent) {
    e.preventDefault()
    if (await run(() => requestPasswordReset(email))) setStep('reset')
  }

  async function onReset(e: FormEvent) {
    e.preventDefault()
    if (await run(() => resetPassword(email, code, password))) setStep('done')
  }

  return (
    <div className="panel">
      <h1>&gt; reset password_</h1>

      {step === 'request' && (
        <form onSubmit={onRequest}>
          <input type="email" placeholder="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <button type="submit" disabled={busy}>
            send reset code
          </button>
        </form>
      )}

      {step === 'reset' && (
        <form onSubmit={onReset}>
          <p className="muted">If {email} has an account, a code is on its way.</p>
          <input
            inputMode="numeric"
            placeholder="000000"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <input
            type="password"
            placeholder="new password (8+ chars)"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" disabled={busy || code.length !== 6}>
            set new password
          </button>
        </form>
      )}

      {step === 'done' && <p className="success">Password updated. You can sign in now.</p>}

      {error && <p className="error">! {error}</p>}

      <p className="muted">
        <Link to="/login">back to sign in</Link>
      </p>
    </div>
  )
}