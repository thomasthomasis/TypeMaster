import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router'
import { useMatchStore } from '../store/useMatchStore'
import { useAsyncAction } from '../components/useAsyncAction'

const MODES = [
  { id: 'duel', label: 'duel (2)' },
  { id: 'squad', label: 'squad (up to 8)' },
  { id: 'royale', label: 'royale (up to 99)' },
]

export default function Play() {
  const { matchId, error: matchError, createPrivate, joinByCode } = useMatchStore()
  const [mode, setMode] = useState('squad')
  const [code, setCode] = useState('')
  const { busy, error, run } = useAsyncAction()

  // Once we're in a match, the match screen takes over.
  if (matchId) return <Navigate to="/match" replace />

  function onJoin(e: FormEvent) {
    e.preventDefault()
    run(() => joinByCode(code))
  }

  return (
    <div className="panel">
      <h1>&gt; private match_</h1>

      <p className="muted">create a lobby and share the code:</p>
      <div className="tabs">
        {MODES.map((m) => (
          <button key={m.id} className={mode === m.id ? 'active' : ''} onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      <button disabled={busy} onClick={() => run(() => createPrivate(mode))}>
        create lobby
      </button>

      <div className="divider">or</div>

      <form onSubmit={onJoin}>
        <input
          placeholder="JOIN CODE"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        <button type="submit" disabled={busy || code.length !== 6}>
          join
        </button>
      </form>

      {(error || matchError) && <p className="error">! {error || matchError}</p>}
      <Link to="/">back</Link>
    </div>
  )
}