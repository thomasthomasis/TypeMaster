package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"math/rand/v2"
	"sort"

	"github.com/heroiclabs/nakama-common/runtime"
)

const (
	matchModule      = "typing99"
	tickRate         = 10 // loop runs 10 times a second
	countdownSeconds = 3
	emptyMatchTicks  = 30 * tickRate // close a match 30s after everyone leaves
	resultsTicks     = 10 * tickRate // keep a finished match open 10s for the results screen
	progressEvery    = 2             // broadcast everyone's progress every 2 ticks (5/sec)
)

// Op codes. Client -> server:
const (
	opKeys   int64 = 1 // data: the characters typed, as raw UTF-8 (no JSON)
	opStart  int64 = 2 // host starts a private match
	opAction int64 = 3 // data: "attack", "shield" or "target"
)

// Server -> client (JSON):
const (
	opLobby    int64 = 10 // players, host, phase
	opGameInit int64 = 11 // countdown
	opProgress int64 = 12 // storm + everyone's public state
	opGameOver int64 = 13 // final results with stats
	opText     int64 = 14 // private: words appended / garbage inserted into your text
	opSelf     int64 = 15 // private: your cursor, meter, shields, hp...
	opEvent    int64 = 16 // attacks and eliminations
)

type phase string

const (
	phaseLobby     phase = "lobby"
	phaseCountdown phase = "countdown"
	phasePlaying   phase = "playing"
	phaseFinished  phase = "finished"
)

type matchState struct {
	mode       gameMode
	private    bool
	code       string
	hostID     string
	phase      phase
	players    map[string]*player
	order      []string // join order, so lists stay stable
	rng        *rand.Rand
	words      []string // the shared word stream every player types through
	startTick  int64    // tick when typing begins
	endTick    int64    // tick when the match closes after results
	storm      float64  // storm position, in base-text characters
	stormSpeed float64  // characters per second
	lobbyCPS   float64  // median live speed of players still alive
	emptyTicks int64
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
		if p.Connected && !p.Bot {
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
	if len(to) == 0 {
		return
	}
	b, _ := json.Marshal(v)
	_ = d.BroadcastMessage(op, b, to, nil, true)
}

// sendTo sends a private message to one player, if they're connected.
func sendTo(d runtime.MatchDispatcher, p *player, op int64, v any) {
	if p.Connected && !p.Bot {
		broadcast(d, op, v, []runtime.Presence{p.presence})
	}
}

func (s *matchState) sendLobby(d runtime.MatchDispatcher) {
	broadcast(d, opLobby, map[string]any{
		"mode":    s.mode,
		"private": s.private,
		"code":    s.code,
		"host":    s.hostID,
		"phase":   s.phase,
		"players": s.publicList(),
	}, s.presences())
}

func (s *matchState) publicList() []playerView {
	list := s.playerList()
	out := make([]playerView, len(list))
	for i, p := range list {
		out[i] = p.view()
	}
	return out
}

func (s *matchState) aliveCount() int {
	n := 0
	for _, p := range s.players {
		if p.Alive {
			n++
		}
	}
	return n
}

// finish: survivors share 1st (normally just the winner), then by elimination order.
func (s *matchState) finish(d runtime.MatchDispatcher, tick int64) {
	for _, p := range s.players {
		if p.Alive {
			p.Place = 1
		}
	}
	list := s.playerList()
	sort.SliceStable(list, func(i, j int) bool { return list[i].Place < list[j].Place })
	results := make([]playerResult, len(list))
	for i, p := range list {
		results[i] = p.result()
	}

	s.phase = phaseFinished
	s.endTick = tick + resultsTicks
	broadcast(d, opGameOver, map[string]any{"results": results}, s.presences())
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
		rng:     rand.New(rand.NewPCG(rand.Uint64(), rand.Uint64())),
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
		s.players[id] = newPlayer(pr)
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
			// Mid-game they stay in: the storm catches them unless they come back
			// (rejoining comes in the next batch).
			p.Connected = false
		}
		if s.hostID == id {
			s.hostID = ""
			for _, oid := range s.order {
				if o := s.players[oid]; o.Connected && !o.Bot {
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
			s.handleKeys(d, p, msg.GetData())
		case opAction:
			s.handleAction(d, p, string(msg.GetData()))
		case opAddBots:
			s.handleAddBots(d, p, msg.GetData())
		}
	}

	if s.phase == phaseCountdown && tick >= s.startTick {
		s.phase = phasePlaying
	}
	if s.phase == phasePlaying {
		s.gameTick(d, tick)
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
	s.phase = phaseCountdown
	s.startTick = tick + countdownSeconds*tickRate

	broadcast(d, opGameInit, map[string]any{"countdown_ms": countdownSeconds * 1000}, s.presences())
	for _, p := range s.players {
		s.ensureLookahead(d, p) // everyone gets the same opening words
	}
	_ = d.MatchLabelUpdate(s.label())
	s.sendLobby(d)
}

func (m *typingMatch) MatchTerminate(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, d runtime.MatchDispatcher, tick int64, state interface{}, graceSeconds int) interface{} {
	return state
}

func (m *typingMatch) MatchSignal(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, d runtime.MatchDispatcher, tick int64, state interface{}, data string) (interface{}, string) {
	return state, ""
}