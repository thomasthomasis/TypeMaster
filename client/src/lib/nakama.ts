import { Client } from '@heroiclabs/nakama-js'

const env = import.meta.env

export const nakama = new Client(
  env.VITE_NAKAMA_SERVER_KEY,
  env.VITE_NAKAMA_HOST,
  env.VITE_NAKAMA_PORT,
  env.VITE_NAKAMA_SSL === 'true',
)

// Used for RPCs that run while signed out (password reset).
const HTTP_KEY: string = env.VITE_NAKAMA_HTTP_KEY
const BASE_URL = `${env.VITE_NAKAMA_SSL === 'true' ? 'https' : 'http'}://${env.VITE_NAKAMA_HOST}:${env.VITE_NAKAMA_PORT}`

// Calls an RPC while signed out. nakama-js's rpcHttpKey sends the input as a GET query parameter, which Nakama ignores (and which would put passwords in URLS)
// so we POST the JSON body ourselves. "unwrap" sends the body as-is.
export async function rpcPublic(id: string, input: object): Promise<void> {
    const url = `${BASE_URL}/v2/rpc/${encodeURIComponent(id)}?http_key=${encodeURIComponent(HTTP_KEY)}&unwrap`
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    })
    if(!res.ok) throw res // errorMessage() reads the server's message from it
}

const DEVICE_KEY = 'tm_device_id'

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

export function forgetDeviceId() {
  localStorage.removeItem(DEVICE_KEY)
}

// nakama-js throws the raw fetch Response on HTTP errors.
export async function errorMessage(err: unknown): Promise<string> {
  if (err instanceof Response) {
    try {
      const body = await err.json()
      return body.message || `Error ${err.status}`
    } catch {
      return `Error ${err.status}`
    }
  }
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message
  return 'Something went wrong'
}