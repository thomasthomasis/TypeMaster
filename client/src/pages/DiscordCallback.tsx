import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useAuthStore } from '../store/useAuthStore'
import { finishDiscordAuth } from '../lib/discord'
import { errorMessage } from '../lib/nakama'

export default function DiscordCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const handled = useRef(false) // a Discord code only works once; StrictMode runs effects twice

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    ;(async () => {
      const code = params.get('code')
      const mode = finishDiscordAuth(params.get('state'))
      if (!code || !mode) {
        setError(params.get('error_description') || 'Discord sign-in was cancelled or expired.')
        return
      }
      try {
        const store = useAuthStore.getState()
        await store.init() // make sure a saved session is restored before linking
        if (mode === 'link') {
          await store.linkDiscord(code)
          navigate('/account', { replace: true })
        } else {
          await store.loginDiscord(code)
          navigate('/', { replace: true })
        }
      } catch (err) {
        setError(await errorMessage(err))
      }
    })()
  }, [params, navigate])

  return (
    <div className="panel">
      <h1>&gt; discord_</h1>
      {error ? (
        <>
          <p className="error">! {error}</p>
          <Link to="/">back</Link>
        </>
      ) : (
        <p className="muted">&gt; signing in...</p>
      )}
    </div>
  )
}