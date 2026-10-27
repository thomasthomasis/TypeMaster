import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useMatchStore, type MatchPlayer } from '../store/useMatchStore'
import { useAuthStore } from '../store/useAuthStore'

export default function Match() {
  const { matchId, phase } = useMatchStore()

  if (!matchId) return <Navigate to="/play" replace />

  return (
    <div className="panel match">
      {phase === 'lobby' && <Lobby />}
      {(phase === 'countdown' || phase === 'playing') && <Race />}
      {phase === 'finished' && <Results />}
    </div>
  )
}

function LeaveButton() {
  const leave = useMatchStore((s) => s.leave)
  const navigate = useNavigate()
  return (
    <button
      onClick={async () => {
        await leave()
        navigate('/play')
      }}
    >
      leave
    </button>
  )
}

function Lobby() {
  const { code, mode, hostId, players, start } = useMatchStore()
  const myId = useAuthStore((s) => s.session?.user_id)

  return (
    <>
      <h1>&gt; lobby_</h1>
      <p>
        code: <strong className="code">{code}</strong>{' '}
        <span className="muted">
          ({mode?.name}, {players.length}/{mode?.max_players})
        </span>
      </p>
      <ul className="player-list">
        {players.map((p) => (
          <li key={p.id}>
            {p.username}
            {p.id === hostId && <span className="muted"> (host)</span>}
          </li>
        ))}
      </ul>
      {myId === hostId ? (
        <button onClick={start}>start</button>
      ) : (
        <p className="muted">waiting for the host to start...</p>
      )}
      <LeaveButton />
    </>
  )
}

function Race() {
  const { text, startsAt, localPos, localErrors, players, typeKey } = useMatchStore()
  const myId = useAuthStore((s) => s.session?.user_id)
  const secondsLeft = useCountdown(startsAt)

  // Type anywhere on the page; no input box to click into.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return
      e.preventDefault() // stop space from scrolling the page
      typeKey(e.key)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [typeKey])

  return (
    <>
      <h1>&gt; {secondsLeft > 0 ? `starting in ${secondsLeft}...` : 'type!'}_</h1>

      <p className="race-text">
        <span className="typed">{text.slice(0, localPos)}</span>
        <span className="cursor">{text[localPos] ?? ''}</span>
        <span>{text.slice(localPos + 1)}</span>
      </p>
      <p className="muted">errors: {localErrors}</p>

      <ProgressList players={players} textLength={text.length} myId={myId} />
      <LeaveButton />
    </>
  )
}

function ProgressList({ players, textLength, myId }: { players: MatchPlayer[]; textLength: number; myId?: string }) {
  return (
    <ul className="player-list">
      {players.map((p) => (
        <li key={p.id} className={p.connected ? '' : 'muted'}>
          <span>
            {p.username}
            {p.id === myId && ' (you)'}
            {p.place ? ` #${p.place}` : ''}
          </span>
          <progress max={textLength} value={p.pos} />
        </li>
      ))}
    </ul>
  )
}

function Results() {
  const { results, text } = useMatchStore()
  const myId = useAuthStore((s) => s.session?.user_id)

  return (
    <>
      <h1>&gt; results_</h1>
      <ol className="player-list">
        {results.map((p) => (
          <li key={p.id}>
            <span>
              {p.username}
              {p.id === myId && ' (you)'}
            </span>
            <span className="muted">
              {p.place ? `${(p.time_ms! / 1000).toFixed(1)}s` : `${Math.round((p.pos / text.length) * 100)}%`} ·{' '}
              {p.errors} errors
            </span>
          </li>
        ))}
      </ol>
      <LeaveButton />
    </>
  )
}

// Whole seconds until `at`, re-rendering every 100ms while counting down.
function useCountdown(at: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (now >= at) return
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [at, now])
  return Math.max(0, Math.ceil((at - now) / 1000))
}