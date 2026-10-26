import { create } from 'zustand'
import { Session, type Client } from '@heroiclabs/nakama-js'
import { nakama, getDeviceId, forgetDeviceId, rpcPublic } from '../lib/nakama'

export type ApiAccount = Awaited<ReturnType<Client['getAccount']>>

const TOKEN_KEY = 'tm_token'
const REFRESH_KEY = 'tm_refresh'
const REFRESH_MARGIN_SEC = 300 // refresh when less than 5 minutes are left

type Status = 'loading' | 'signedOut' | 'signedIn'

interface AuthState {
  status: Status
  session: Session | null
  account: ApiAccount | null

  init: () => Promise<void>
  ensureSession: () => Promise<Session>
  refreshAccount: () => Promise<void>

  loginGuest: () => Promise<void>
  loginEmail: (email: string, password: string) => Promise<void>
  registerEmail: (email: string, password: string, username: string) => Promise<void>
  loginDiscord: (code: string) => Promise<void>

  linkEmail: (email: string, password: string) => Promise<void>
  linkDiscord: (code: string) => Promise<void>

  verifyEmail: (code: string) => Promise<void>
  resendVerification: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  resetPassword: (email: string, code: string, password: string) => Promise<void>

  logout: () => Promise<void>
}

function saveSession(s: Session) {
  localStorage.setItem(TOKEN_KEY, s.token)
  localStorage.setItem(REFRESH_KEY, s.refresh_token)
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

let initPromise: Promise<void> | null = null

export const useAuthStore = create<AuthState>()((set, get) => {
  // Shared by every sign-in method: persist the session, load the account.
  async function signIn(session: Session) {
    saveSession(session)
    const account = await nakama.getAccount(session)
    set({ status: 'signedIn', session, account })
  }

  // After a guest links a real login, stop this browser's device ID from
  // being a password-free way into the account.
  async function dropDevice(session: Session) {
    try {
      await nakama.unlinkDevice(session, { id: getDeviceId() })
    } catch {
      // Not a guest, or the device was already unlinked.
    }
    forgetDeviceId()
  }

  return {
    status: 'loading',
    session: null,
    account: null,

    init: () => {
      // StrictMode runs effects twice; only restore once.
      initPromise ??= (async () => {
        const token = localStorage.getItem(TOKEN_KEY)
        const refresh = localStorage.getItem(REFRESH_KEY)
        if (!token || !refresh) {
          set({ status: 'signedOut' })
          return
        }
        try {
          let session = Session.restore(token, refresh)
          const now = Date.now() / 1000
          if (session.isrefreshexpired(now)) throw new Error('expired')
          if (session.isexpired(now + REFRESH_MARGIN_SEC)) {
            session = await nakama.sessionRefresh(session)
          }
          await signIn(session)
        } catch {
          clearSession()
          set({ status: 'signedOut', session: null, account: null })
        }
      })()
      return initPromise
    },

    // Call this to get a session before talking to the server.
    ensureSession: async () => {
      const session = get().session
      if (!session) throw new Error('Not signed in')
      if (session.isexpired(Date.now() / 1000 + REFRESH_MARGIN_SEC)) {
        try {
          await nakama.sessionRefresh(session) // updates the session in place
          saveSession(session)
        } catch (err) {
          clearSession()
          set({ status: 'signedOut', session: null, account: null })
          throw err
        }
      }
      return session
    },

    refreshAccount: async () => {
      const session = await get().ensureSession()
      set({ account: await nakama.getAccount(session) })
    },

    loginGuest: async () => {
      await signIn(await nakama.authenticateDevice(getDeviceId(), true))
    },

    loginEmail: async (email, password) => {
      await signIn(await nakama.authenticateEmail(email, password, false))
    },

    registerEmail: async (email, password, username) => {
      await signIn(await nakama.authenticateEmail(email, password, true, username || undefined))
    },

    loginDiscord: async (code) => {
      // The server's before-hook swaps the code for "discord:<id>".
      await signIn(await nakama.authenticateCustom(code, true))
    },

    linkEmail: async (email, password) => {
      const session = await get().ensureSession()
      await nakama.linkEmail(session, { email, password })
      await dropDevice(session)
      await get().refreshAccount()
    },

    linkDiscord: async (code) => {
      const session = await get().ensureSession()
      await nakama.linkCustom(session, { id: code })
      await dropDevice(session)
      await get().refreshAccount()
    },

    verifyEmail: async (code) => {
      const session = await get().ensureSession()
      await nakama.rpc(session, 'verify_email', { code })
      await get().refreshAccount()
    },

    resendVerification: async () => {
      const session = await get().ensureSession()
      await nakama.rpc(session, 'resend_verification', {})
    },

    requestPasswordReset: async (email) => {
      await rpcPublic('request_password_reset', { email })
    },

    resetPassword: async (email, code, password) => {
      await rpcPublic('reset_password', { email, code, password })
    },

    logout: async () => {
      const { session } = get()
      if (session) {
        try {
          await nakama.sessionLogout(session, session.token, session.refresh_token)
        } catch {
          // Already invalid on the server; sign out locally anyway.
        }
      }
      clearSession()
      set({ status: 'signedOut', session: null, account: null })
    },
  }
})

// --- Derived helpers ---

export function isGuest(account: ApiAccount | null): boolean {
  return !!account && !account.email && !account.custom_id
}

export function hasDiscord(account: ApiAccount | null): boolean {
  return !!account?.custom_id?.startsWith('discord:')
}

export function isEmailVerified(account: ApiAccount | null): boolean {
  try {
    return JSON.parse(account?.user?.metadata || '{}').email_verified === true
  } catch {
    return false
  }
}

// An email account that hasn't entered its code yet.
export function needsVerification(account: ApiAccount | null): boolean {
  return !!account?.email && !isEmailVerified(account)
}