import { useEffect, useState } from 'react'
import { useMatchStore, ATTACK_COST, SHIELD_COST } from '../store/useMatchStore'

// Dev-only testing tools. Match.tsx only renders this under `npm run dev`.

const AUTOPILOT_TICK_MS = 50
const AUTOPILOT_MISTAKE_RATE = 0.03

export function DevBotsPanel() {
  const addBots = useMatchStore((s) => s.addBots)
  const [count, setCount] = useState(5)
  const [minWpm, setMinWpm] = useState(40)
  const [maxWpm, setMaxWpm] = useState(90)

  return (
    <fieldset className="dev-panel">
      <legend>dev</legend>
      <label>
        bots <input type="number" min={1} max={98} value={count} onChange={(e) => setCount(+e.target.value)} />
      </label>
      <label>
        wpm <input type="number" min={10} max={250} value={minWpm} onChange={(e) => setMinWpm(+e.target.value)} />
        -
        <input type="number" min={10} max={250} value={maxWpm} onChange={(e) => setMaxWpm(+e.target.value)} />
      </label>
      <button onClick={() => addBots(count, minWpm, maxWpm)}>add bots</button>
      <p className="muted">needs DEV_MODE=true on the server</p>
    </fieldset>
  )
}

// Types for you at a steady speed and spends the meter like the bots do.
export function DevAutopilotPanel() {
  const [on, setOn] = useState(false)
  const [wpm, setWpm] = useState(60)

  useEffect(() => {
    if (!on) return
    let budget = 0
    const id = setInterval(() => {
      const { self, typeKey, act } = useMatchStore.getState()
      if (!self?.alive) return

      budget += ((wpm / 12) * AUTOPILOT_TICK_MS) / 1000
      for (; budget >= 1; budget--) {
        // Re-read each key: typing moves the cursor and garbage can arrive.
        const { text, localPos } = useMatchStore.getState()
        if (localPos >= text.length) break
        typeKey(Math.random() < AUTOPILOT_MISTAKE_RATE ? '~' : text[localPos])
      }

      if (self.shields === 0 && self.meter >= SHIELD_COST) act('shield')
      else if (self.meter >= ATTACK_COST && Math.random() < 0.05) act('attack')
    }, AUTOPILOT_TICK_MS)
    return () => clearInterval(id)
  }, [on, wpm])

  return (
    <fieldset className="dev-panel">
      <legend>dev</legend>
      <label>
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} /> autopilot
      </label>
      <label>
        <input type="range" min={10} max={200} value={wpm} onChange={(e) => setWpm(+e.target.value)} /> {wpm} wpm
      </label>
    </fieldset>
  )
}