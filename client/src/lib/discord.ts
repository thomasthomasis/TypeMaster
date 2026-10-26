const STATE_KEY = 'tm_discord_state'
const MODE_KEY = 'tm_discord_mode'

export type DiscordMode = 'login' | 'link'

export const discordEnabled = Boolean(import.meta.env.VITE_DISCORD_CLIENT_ID)

// Sends the browser to Discord. It comes back to /auth/discord/callback.
export function startDiscordAuth(mode: DiscordMode) {
  const state = crypto.randomUUID()
  sessionStorage.setItem(STATE_KEY, state)
  sessionStorage.setItem(MODE_KEY, mode)

  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
    redirect_uri: import.meta.env.VITE_DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',
    state,
    prompt: 'none',
  })
  window.location.href = `https://discord.com/oauth2/authorize?${params}`
}

// Checks the state matches the one we sent (CSRF protection) and returns the mode.
export function finishDiscordAuth(returnedState: string | null): DiscordMode | null {
  const expected = sessionStorage.getItem(STATE_KEY)
  const mode = sessionStorage.getItem(MODE_KEY) as DiscordMode | null
  sessionStorage.removeItem(STATE_KEY)
  sessionStorage.removeItem(MODE_KEY)
  if (!expected || expected !== returnedState) return null
  return mode
}