import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import {
  useMatchStore,
  MAX_HP,
  METER_MAX,
  ATTACK_COST,
  SHIELD_COST,
  MAX_SHIELDS,
  type MatchPlayer,
} from '../store/useMatchStore'
import { useAuthStore } from '../store/useAuthStore'
import { DevBotsPanel, DevAutopilotPanel } from '../components/DevPanel'

const WINDOW_BEFORE = 30 // characters of typed text left visible
const WINDOW_AFTER = 220 // characters of upcoming text shown

// Number keys spend the meter; the word list never contains digits.
const ACTION_KEYS = { '1': 'attack', '2': 'shield', '3': 'target' } as const

export default function Match() {
  const { matchId, phase } = useMatchStore()

  if (!matchId) return <Navigate to="/play" replace />

  return (
    <div className="panel match">
      {phase === 'lobby' && <Lobby />}
      {(phase === 'countdown' || phase === 'playing') && <Battle />}
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
            {p.bot && <span className="muted"> (bot)</span>}
          </li>
        ))}
      </ul>
      {myId === hostId ? (
        <button onClick={start}>start</button>
      ) : (
        <p className="muted">waiting for the host to start...</p>
      )}
      {import.meta.env.DEV && myId === hostId && <DevBotsPanel />}
      <LeaveButton />
    </>
  )
}

function Battle() {
  const { text, garbage, localPos, self, players, storm, stormCps, startsAt, events, typeKey, act } =
    useMatchStore()
  const myId = useAuthStore((s) => s.session?.user_id)
  const secondsLeft = useCountdown(startsAt)
  const me = players.find((p) => p.id === myId)

  // Type anywhere on the page; no input box to click into.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return
      e.preventDefault() // stop space from scrolling the page
      const action = ACTION_KEYS[e.key as keyof typeof ACTION_KEYS]
      if (action) act(action)
      else typeKey(e.key)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [typeKey, act])

  const lead = me ? Math.floor(me.progress - storm) : 0
  const start = Math.max(0, localPos - WINDOW_BEFORE)
  const end = Math.min(text.length, localPos + WINDOW_AFTER)

  let status = 'type!'
  if (secondsLeft > 0) status = `starting in ${secondsLeft}...`
  else if (self && !self.alive) status = 'eliminated - spectating'

  return (
    <>
      <h1>&gt; {status}_</h1>

      <div className="hud">
        <Bar label="hp" value={self?.hp ?? MAX_HP} max={MAX_HP} danger={lead < 0} />
        <Bar label="meter" value={self?.meter ?? 0} max={METER_MAX} />
        <p className="muted">
          shields {'●'.repeat(self?.shields ?? 0)}
          {'○'.repeat(MAX_SHIELDS - (self?.shields ?? 0))} · target: {self?.target ?? 'random'}
        </p>
        <p className="muted">
          [1] attack ({ATTACK_COST}) · [2] shield ({SHIELD_COST}) · [3] change target
        </p>
        <p className={lead < 0 ? 'error' : 'muted'}>
          {lead < 0 ? `STORM IS ON YOU (${-lead} behind)` : `storm ${lead} chars behind you`} · storm{' '}
          {Math.round(stormCps * 12)} wpm
        </p>
      </div>

      <p className="race-text">
        {Array.from(text.slice(start, end), (ch, i) => {
          const at = start + i
          const cls = [at < localPos ? 'typed' : '', at === localPos ? 'cursor' : '', garbage[at] ? 'garbage' : '']
          return (
            <span key={at} className={cls.join(' ')}>
              {ch}
            </span>
          )
        })}
      </p>

      <ul className="events">
        {events.map((e, i) => (
          <li key={i} className="muted">
            {e}
          </li>
        ))}
      </ul>

      <PlayerList players={players} myId={myId} />
      {import.meta.env.DEV && <DevAutopilotPanel />}
      <LeaveButton />
    </>
  )
}

function Bar({ label, value, max, danger }: { label: string; value: number; max: number; danger?: boolean }) {
  return (
    <div className={`bar ${danger ? 'danger' : ''}`}>
      <span>{label}</span>
      <progress max={max} value={value} />
      <span>{value}</span>
    </div>
  )
}

function PlayerList({ players, myId }: { players: MatchPlayer[]; myId?: string }) {
  // Alive players first, furthest ahead on top.
  const sorted = [...players].sort((a, b) => Number(b.alive) - Number(a.alive) || b.progress - a.progress)
  return (
    <ul className="player-list">
      {sorted.map((p) => (
        <li key={p.id} className={p.alive && p.connected ? '' : 'muted'}>
          <span>
            {p.username}
            {p.id === myId && ' (you)'}
            {!p.alive && ` #${p.place}`}
            {p.shields > 0 && ` ${'●'.repeat(p.shields)}`}
          </span>
          <span className="muted">{Math.round(p.cps * 12)} wpm</span>
          <progress max={MAX_HP} value={p.hp} />
        </li>
      ))}
    </ul>
  )
}

function Results() {
  const results = useMatchStore((s) => s.results)
  const myId = useAuthStore((s) => s.session?.user_id)

  return (
    <>
      <h1>&gt; results_</h1>
      <table className="results">
        <thead>
          <tr>
            <th>#</th>
            <th>player</th>
            <th>avg wpm</th>
            <th>peak wpm</th>
            <th>errors</th>
            <th>attacks</th>
            <th>survived</th>
          </tr>
        </thead>
        <tbody>
          {results.map((p) => (
            <tr key={p.id} className={p.id === myId ? 'me' : ''}>
              <td>{p.place}</td>
              <td>{p.username}</td>
              <td>{Math.round(p.avg_cps * 12)}</td>
              <td>{Math.round(p.peak_cps * 12)}</td>
              <td>{p.errors}</td>
              <td>{p.attacks_sent}</td>
              <td>{p.alive_seconds}s</td>
            </tr>
          ))}
        </tbody>
      </table>
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