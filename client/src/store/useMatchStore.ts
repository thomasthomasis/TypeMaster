import { create } from 'zustand'
import type { Socket } from '@heroiclabs/nakama-js'
import { nakama } from '../lib/nakama'
import { useAuthStore } from './useAuthStore'

// Must match the op codes in server/match.go.
const OP_KEYS = 1
const OP_START = 2
const OP_ACTION = 3
const OP_ADD_BOTS = 4 // dev only
const OP_LOBBY = 10
const OP_GAME_INIT = 11
const OP_PROGRESS = 12
const OP_GAME_OVER = 13
const OP_TEXT = 14
const OP_SELF = 15
const OP_EVENT = 16

export type Phase = 'lobby' | 'countdown' | 'playing' | 'finished'
export type Action = 'attack' | 'shield' | 'target'

// Must match the tuning in server/game.go.
export const MAX_HP = 100
export const METER_MAX = 60
export const ATTACK_COST = 15
export const SHIELD_COST = 30
export const MAX_SHIELDS = 3

export interface MatchPlayer {
  id: string
  username: string
  connected: boolean
  alive: boolean
  hp: number
  place?: number
  progress: number
  shields: number
  cps: number
  bot?: boolean
}

export interface PlayerResult {
  id: string
  username: string
  place: number
  progress: number
  errors: number
  peak_cps: number
  avg_cps: number
  alive_seconds: number
  attacks_sent: number
  garbage_received: number
}

export interface SelfState {
  pos: number
  keys: number
  errors: number
  meter: number
  shields: number
  hp: number
  alive: boolean
  target: string
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
  startsAt: number // Date.now() when typing opens
  text: string // our own text: shared words plus any garbage sent to us
  garbage: boolean[] // which characters of text are garbage
  localPos: number // our cursor, moved instantly as we type
  self: SelfState | null // the server's view of us
  storm: number
  stormCps: number
  events: string[] // newest first
  results: PlayerResult[]
  error: string | null

  createPrivate: (mode: string) => Promise<void>
  joinByCode: (code: string) => Promise<void>
  start: () => void
  typeKey: (key: string) => void
  act: (action: Action) => void
  addBots: (count: number, minWpm: number, maxWpm: number) => void
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
  startsAt: 0,
  text: '',
  garbage: [],
  localPos: 0,
  self: null,
  storm: 0,
  stormCps: 0,
  events: [],
  results: [],
  error: null,
}

// Keys are batched for a few ms so fast typists don't send one message per key.
let pendingKeys = ''
let flushTimer: ReturnType<typeof setTimeout> | null = null
// Characters typed this game. When the server has seen them all, we can trust its cursor.
let typedCount = 0

export const useMatchStore = create<MatchState>()((set, get) => {
  function addEvent(line: string) {
    set({ events: [line, ...get().events].slice(0, 5) })
  }

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
          typedCount = 0
          pendingKeys = ''
          set({
            startsAt: Date.now() + data.countdown_ms,
            text: '',
            garbage: [],
            localPos: 0,
            self: null,
            storm: 0,
            events: [],
            results: [],
          })
          break

        case OP_TEXT: {
          const { text, garbage } = get()
          const chunk: string = data.text
          if (data.op === 'append') {
            set({ text: text + chunk, garbage: [...garbage, ...Array(chunk.length).fill(false)] })
          } else {
            const at: number = data.at
            set({
              text: text.slice(0, at) + chunk + text.slice(at),
              garbage: [...garbage.slice(0, at), ...Array(chunk.length).fill(true), ...garbage.slice(at)],
            })
          }
          break
        }

        case OP_SELF: {
          const self: SelfState = data
          // Once the server has processed every key we typed, its cursor is the truth.
          const caughtUp = self.keys === typedCount && pendingKeys === ''
          set({ self, ...(caughtUp ? { localPos: self.pos } : {}) })
          break
        }

        case OP_PROGRESS:
          set({ players: data.players, storm: data.storm, stormCps: data.storm_cps, phase: 'playing' })
          break

        case OP_EVENT:
          if (data.type === 'attacked') addEvent(data.blocked ? `shield blocked ${data.by}'s attack` : `${data.by} attacked you!`)
          if (data.type === 'attack_sent') addEvent(data.blocked ? `${data.to} blocked your attack` : `you hit ${data.to}`)
          if (data.type === 'eliminated') addEvent(`${data.username} was eliminated (#${data.place})`)
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

    // Mirrors the server's check so our cursor moves instantly.
    typeKey: (key) => {
      const { text, localPos, startsAt, phase, self } = get()
      if (phase !== 'playing' && phase !== 'countdown') return
      if (Date.now() < startsAt || self?.alive === false || localPos >= text.length) return

      if (key === text[localPos]) set({ localPos: localPos + 1 })

      typedCount += key.length
      pendingKeys += key
      flushTimer ??= setTimeout(flush, 30)
    },

    act: (action) => {
      const { socket, matchId, phase } = get()
      if (socket && matchId && phase === 'playing') socket.sendMatchState(matchId, OP_ACTION, action)
    },

    // Dev only: the server ignores this unless it runs with DEV_MODE=true.
    addBots: (count, minWpm, maxWpm) => {
        const { socket, matchId } = get()
        const data = JSON.stringify({ count, min_wpm: minWpm, max_wpm: maxWpm })
        if(socket && matchId) socket.sendMatchState(matchId, OP_ADD_BOTS, data)
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