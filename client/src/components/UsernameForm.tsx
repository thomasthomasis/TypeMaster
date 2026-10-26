import { useState, type FormEvent } from 'react'
import { useAuthStore, USERNAME_PATTERN } from '../store/useAuthStore'
import { useAsyncAction } from './useAsyncAction'

// Used by the first-sign-in screen and the account page.
export function UsernameForm({ submitLabel, onDone }: { submitLabel: string; onDone?: () => void }) {
  const setUsername = useAuthStore((s) => s.setUsername)
  const [name, setName] = useState('')
  const { busy, error, run } = useAsyncAction()
  const valid = USERNAME_PATTERN.test(name)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (await run(() => setUsername(name))) {
      setName('')
      onDone?.()
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <input
        placeholder="username"
        autoComplete="username"
        maxLength={16}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <p className="muted">3-16 letters, numbers or underscores</p>
      <button type="submit" disabled={busy || !valid}>
        {submitLabel}
      </button>
      {error && <p className="error">! {error}</p>}
    </form>
  )
}