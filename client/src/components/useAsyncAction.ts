import { useState } from 'react'
import { errorMessage } from '../lib/nakama'

// Runs an async action and tracks its busy and error state for a form.
export function useAsyncAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<void>): Promise<boolean> {
    setBusy(true)
    setError(null)
    try {
      await action()
      return true
    } catch (err) {
      setError(await errorMessage(err))
      return false
    } finally {
      setBusy(false)
    }
  }

  return { busy, error, setError, run }
}