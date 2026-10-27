import { create } from 'zustand'
import type { Socket } from '@heroiclabs/nakama-js'
import { nakama } from '../lib/nakama'
import { useAuthStore } from './useAuthStore'

// Must match the op codes in server/match.go.
const OP_KEYS = 1
const OP_START = 2
const OP_LOBBY = 10
const OP_GAME_INIT = 11
const OP_PROGRESS = 12
const OP_GAME_OVER = 13

export type Phase = 'lobby' | 'countdown' | 'playing' | 'finished'

export interface MatchPlayer {
  id: string
  username: string
  connected: boolean
  pos: number
  errors: number
  place?: number
  time_ms?: number
}

export interface GameMode {
  id: string
  name: string
  min_players: number
  max_players: number
}

interface MatchState {
  socket: Socket | null
  matchId: string | null
  code: string | null
  mode: GameMode | null
  hostId: string | null
  phase: Phase | null
  players: MatchPlayer[]
  text: string
  startsAt: number // Date.now() when typing opens
  localPos: number // our own cursor, updated instantly as we type
  localErrors: number
  results: MatchPlayer[]
  error: string | null

  createPrivate: (mode: string) => Promise<void>
  joinByCode: (code: string) => Promise<void>
  start: () => void
  typeKey: (key: string) => void
  leave: () => Promise<void>
}

const decoder = new TextDecoder()
const encoder = new TextEncoder()

const initial = {
  matchId: null,
  code: null,
  mode: null,
  hostId: null,
  phase: null,
  players: [],
  text: '',
  startsAt: 0,
  localPos: 0,
  localErrors: 0,
  results: [],
  error: null,
}

// Keys are batched for a few ms so fast typists don't send one message per key.
let pendingKeys = ''
let flushTimer: ReturnType<typeof setTimeout> | null = null

export const useMatchStore = create<MatchState>()((set, get) => {
  async function getSocket(): Promise<Socket> {
    const existing = get().socket
    if (existing) return existing

    const session = await useAuthStore.getState().ensureSession()
    const socket = nakama.createSocket(import.meta.env.VITE_NAKAMA_SSL === 'true')
    socket.ondisconnect = () => set({ ...initial, socket: null, error: 'disconnected from server' })
    socket.onmatchdata = (msg) => {
      const data = JSON.parse(decoder.decode(msg.data))
      switch (msg.op_code) {
        case OP_LOBBY:
          set({ mode: data.mode, code: data.code, hostId: data.host, phase: data.phase, players: data.players })
          break
        case OP_GAME_INIT:
          set({
            text: data.text,
            startsAt: Date.now() + data.countdown_ms,
            localPos: 0,
            localErrors: 0,
            results: [],
          })
          break
        case OP_PROGRESS:
          set({ players: data.players, phase: 'playing' })
          break
        case OP_GAME_OVER:
          set({ results: data.results, phase: 'finished' })
          break
      }
    }
    await socket.connect(session, true)
    set({ socket })
    return socket
  }

  async function joinMatch(matchId: string) {
    const socket = await getSocket()
    await socket.joinMatch(matchId) // the server replies with a lobby message
    set({ matchId, error: null })
  }

  function flush() {
    flushTimer = null
    const { socket, matchId } = get()
    if (socket && matchId && pendingKeys) {
      socket.sendMatchState(matchId, OP_KEYS, encoder.encode(pendingKeys))
    }
    pendingKeys = ''
  }

  return {
    socket: null,
    ...initial,

    createPrivate: async (mode) => {
      const session = await useAuthStore.getState().ensureSession()
      const res = await nakama.rpc(session, 'create_private_match', { mode })
      const { match_id } = res.payload as { match_id: string }
      await joinMatch(match_id)
    },

    joinByCode: async (code) => {
      const session = await useAuthStore.getState().ensureSession()
      const res = await nakama.rpc(session, 'find_private_match', { code })
      const { match_id } = res.payload as { match_id: string }
      await joinMatch(match_id)
    },

    start: () => {
      const { socket, matchId } = get()
      if (socket && matchId) socket.sendMatchState(matchId, OP_START, '')
    },

    // Mirrors the server's check so our cursor moves instantly. The server's
    // count is the real one; it uses the same rule so they stay in step.
    typeKey: (key) => {
      const { text, localPos, startsAt, phase } = get()
      if (phase === 'finished' || !text || Date.now() < startsAt || localPos >= text.length) return

      if (key === text[localPos]) set({ localPos: localPos + 1 })
      else set({ localErrors: get().localErrors + 1 })

      pendingKeys += key
      flushTimer ??= setTimeout(flush, 30)
    },

    leave: async () => {
      const { socket, matchId } = get()
      if (flushTimer) clearTimeout(flushTimer)
      flushTimer = null
      pendingKeys = ''
      if (socket && matchId) {
        try {
          await socket.leaveMatch(matchId)
        } catch {
          // Match already closed.
        }
      }
      set({ ...initial })
    },
  }
})