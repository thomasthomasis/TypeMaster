package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"math/rand/v2"
	"sort"
	"unicode/utf8"

	"github.com/heroiclabs/nakama-common/runtime"
)

const (
	matchModule      = "typing99"
	tickRate         = 10 // loop runs 10 times a second
	countdownSeconds = 3
	raceWordCount    = 30
	maxKeysPerTick   = 30                // 300 keys/sec, far above any human
	raceTimeLimit    = 3 * 60 * tickRate // ticks
	emptyMatchTicks  = 30 * tickRate     // close a match 30s after everyone leaves
	resultsTicks     = 10 * tickRate     // keep a finished match open 10s for the results screen
)

// Op codes. Client -> server:
const (
	opKeys  int64 = 1 // data: the characters typed, as raw UTF-8 (no JSON)
	opStart int64 = 2 // host starts a private match
)

// Server -> client (JSON):
const (
	opLobby    int64 = 10 // players, host, phase
	opGameInit int64 = 11 // the text and countdown
	opProgress int64 = 12 // everyone's position, sent when anything changed
	opGameOver int64 = 13 // final results
)

type phase string

const (
	phaseLobby     phase = "lobby"
	phaseCountdown phase = "countdown"
	phasePlaying   phase = "playing"
	phaseFinished  phase = "finished"
)

type player struct {
	presence  runtime.Presence
	UserID    string `json:"id"`
	Username  string `json:"username"`
	Connected bool   `json:"connected"`
	Pos       int    `json:"pos"`    // characters typed correctly
	Errors    int    `json:"errors"` // wrong keystrokes
	Place     int    `json:"place,omitempty"`
	TimeMs    int64  `json:"time_ms,omitempty"` // time to finish
}

type matchState struct {
	mode          gameMode
	private       bool
	code          string
	hostID        string
	phase         phase
	players       map[string]*player
	order         []string // join order, so lists stay stable
	text          []rune
	startTick     int64 // tick when typing begins
	endTick       int64 // tick when the match closes after results
	finishedCount int
	emptyTicks    int64
	dirty         bool // progress changed since the last broadcast
}

type typingMatch struct{}

func newTypingMatch(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule) (runtime.Match, error) {
	return &typingMatch{}, nil
}

// --- helpers ---

func (s *matchState) label() string {
	b, _ := json.Marshal(map[string]any{
		"mode":    s.mode.ID,
		"private": s.private,
		"code":    s.code,
		"open":    s.phase == phaseLobby,
		"players": len(s.players),
	})
	return string(b)
}

func (s *matchState) presences() []runtime.Presence {
	out := make([]runtime.Presence, 0, len(s.players))
	for _, p := range s.players {
		if p.Connected {
			out = append(out, p.presence)
		}
	}
	return out
}

func (s *matchState) playerList() []*player {
	out := make([]*player, 0, len(s.order))
	for _, id := range s.order {
		if p, ok := s.players[id]; ok {
			out = append(out, p)
		}
	}
	return out
}

func broadcast(d runtime.MatchDispatcher, op int64, v any, to []runtime.Presence) {
	b, _ := json.Marshal(v)
	_ = d.BroadcastMessage(op, b, to, nil, true)
}

func (s *matchState) sendLobby(d runtime.MatchDispatcher) {
	broadcast(d, opLobby, map[string]any{
		"mode":    s.mode,
		"private": s.private,
		"code":    s.code,
		"host":    s.hostID,
		"phase":   s.phase,
		"players": s.playerList(),
	}, s.presences())
}

// results: finishers by place, then everyone else by how far they got.
func (s *matchState) results() []*player {
	list := s.playerList()
	sort.SliceStable(list, func(i, j int) bool {
		a, b := list[i], list[j]
		if (a.Place > 0) != (b.Place > 0) {
			return a.Place > 0
		}
		if a.Place > 0 {
			return a.Place < b.Place
		}
		return a.Pos > b.Pos
	})
	return list
}

func (s *matchState) finish(d runtime.MatchDispatcher, tick int64) {
	s.phase = phaseFinished
	s.endTick = tick + resultsTicks
	broadcast(d, opGameOver, map[string]any{"results": s.results()}, s.presences())
	_ = d.MatchLabelUpdate(s.label())
}

// --- runtime.Match ---

func (m *typingMatch) MatchInit(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, params map[string]interface{}) (interface{}, int, string) {
	modeID, _ := params["mode"].(string)
	mode, ok := gameModes[modeID]
	if !ok {
		mode = gameModes["squad"]
	}
	private, _ := params["private"].(bool)
	code, _ := params["code"].(string)

	s := &matchState{
		mode:    mode,
		private: private,
		code:    code,
		phase:   phaseLobby,
		players: map[string]*player{},
	}
	return s, tickRate, s.label()
}

func (m *typingMatch) MatchJoinAttempt(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, d runtime.MatchDispatcher, tick int64, state interface{}, presence runtime.Presence, metadata map[string]string) (interface{}, bool, string) {
	s := state.(*matchState)
	if s.phase != phaseLobby {
		return s, false, "match has already started"
	}
	if p, ok := s.players[presence.GetUserId()]; ok && p.Connected {
		return s, false, "you are already in this match"
	}
	if len(s.players) >= s.mode.MaxPlayers {
		return s, false, "match is full"
	}
	return s, true, ""
}

func (m *typingMatch) MatchJoin(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, d runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
	s := state.(*matchState)
	for _, pr := range presences {
		id := pr.GetUserId()
		if p, ok := s.players[id]; ok {
			p.presence, p.Connected = pr, true // same player, new connection
			continue
		}
		s.players[id] = &player{presence: pr, UserID: id, Username: pr.GetUsername(), Connected: true}
		s.order = append(s.order, id)
		if s.hostID == "" {
			s.hostID = id
		}
	}
	s.emptyTicks = 0
	_ = d.MatchLabelUpdate(s.label())
	s.sendLobby(d)
	return s
}

func (m *typingMatch) MatchLeave(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, d runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
	s := state.(*matchState)
	for _, pr := range presences {
		id := pr.GetUserId()
		p, ok := s.players[id]
		if !ok || p.presence.GetSessionId() != pr.GetSessionId() {
			continue // an old connection we already replaced
		}
		if s.phase == phaseLobby {
			// Before the game starts, leaving frees the slot.
			delete(s.players, id)
			for i, oid := range s.order {
				if oid == id {
					s.order = append(s.order[:i], s.order[i+1:]...)
					break
				}
			}
		} else {
			// Mid-game we keep their progress. Rejoining comes in a later batch.
			p.Connected = false
			s.dirty = true
		}
		if s.hostID == id {
			s.hostID = ""
			for _, oid := range s.order {
				if s.players[oid].Connected {
					s.hostID = oid
					break
				}
			}
		}
	}
	_ = d.MatchLabelUpdate(s.label())
	s.sendLobby(d)
	return s
}

func (m *typingMatch) MatchLoop(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, d runtime.MatchDispatcher, tick int64, state interface{}, messages []runtime.MatchData) interface{} {
	s := state.(*matchState)

	// Close the match when it's empty or the results screen has had its time.
	if len(s.presences()) == 0 {
		s.emptyTicks++
		if s.emptyTicks > emptyMatchTicks {
			return nil
		}
	} else {
		s.emptyTicks = 0
	}
	if s.phase == phaseFinished && tick >= s.endTick {
		return nil
	}

	for _, msg := range messages {
		p, ok := s.players[msg.GetUserId()]
		if !ok {
			continue
		}
		switch msg.GetOpCode() {
		case opStart:
			m.handleStart(s, d, tick, p)
		case opKeys:
			m.handleKeys(s, tick, p, msg.GetData())
		}
	}

	if s.phase == phaseCountdown && tick >= s.startTick {
		s.phase = phasePlaying
	}

	if s.phase == phasePlaying {
		allDone := true
		for _, p := range s.players {
			if p.Connected && p.Place == 0 {
				allDone = false
				break
			}
		}
		if s.dirty {
			broadcast(d, opProgress, map[string]any{"players": s.playerList()}, s.presences())
			s.dirty = false
		}
		if allDone || tick-s.startTick >= raceTimeLimit {
			s.finish(d, tick)
		}
	}
	return s
}

func (m *typingMatch) handleStart(s *matchState, d runtime.MatchDispatcher, tick int64, p *player) {
	if s.phase != phaseLobby || p.UserID != s.hostID {
		return
	}
	// Private matches can start with anyone present (handy for testing and practice).
	if !s.private && len(s.players) < s.mode.MinPlayers {
		return
	}
	rng := rand.New(rand.NewPCG(uint64(tick), rand.Uint64()))
	s.text = []rune(generateText(rng, raceWordCount))
	s.phase = phaseCountdown
	s.startTick = tick + countdownSeconds*tickRate

	broadcast(d, opGameInit, map[string]any{
		"text":         string(s.text),
		"countdown_ms": countdownSeconds * 1000,
	}, s.presences())
	_ = d.MatchLabelUpdate(s.label())
	s.sendLobby(d)
}

// handleKeys checks each typed character against the text. Right advances the
// cursor; wrong counts an error and the cursor stays put.
func (m *typingMatch) handleKeys(s *matchState, tick int64, p *player, data []byte) {
	if s.phase != phasePlaying || p.Place > 0 || !utf8.Valid(data) {
		return
	}
	for i, r := range []rune(string(data)) {
		if i >= maxKeysPerTick || p.Pos >= len(s.text) {
			break
		}
		if r == s.text[p.Pos] {
			p.Pos++
		} else {
			p.Errors++
		}
		s.dirty = true
	}
	if p.Pos >= len(s.text) && p.Place == 0 {
		s.finishedCount++
		p.Place = s.finishedCount
		p.TimeMs = (tick - s.startTick) * 1000 / tickRate
	}
}

func (m *typingMatch) MatchTerminate(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, d runtime.MatchDispatcher, tick int64, state interface{}, graceSeconds int) interface{} {
	return state
}

func (m *typingMatch) MatchSignal(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, d runtime.MatchDispatcher, tick int64, state interface{}, data string) (interface{}, string) {
	return state, ""
}