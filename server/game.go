package main

import (
	"math"
	"slices"
	"unicode/utf8"

	"github.com/heroiclabs/nakama-common/runtime"
)

// Gameplay tuning. Everything that decides how the game feels lives here.
const (
	maxHP          = 100
	maxKeysPerTick = 30 // 300 keys/sec, far above any human

	lookaheadChars = 150 // keep at least this much text ahead of each cursor

	meterMax    = 60
	attackCost  = 15
	attackSize  = 15 // garbage characters per attack
	shieldCost  = 30
	maxShields  = 3
	garbageGap  = 8 // garbage lands at least this far ahead of the cursor
	garbageRune = "#$%&@*+=?!"

	stormGraceTicks    = 5 * tickRate  // storm waits 5s after the start
	stormBaseCPS       = 1.0           // starting speed, characters per second
	stormRampCPS       = 0.5           // added every stormRampEvery
	stormRampEvery     = 30 * tickRate // ticks
	stormLobbyFactor   = 0.5           // storm is at least this fraction of the lobby's median speed
	stormDamagePerTick = 1             // 10 HP per second while the storm is ahead of you

	cpsWindow = 5 // seconds used for live speed
)

const (
	targetRandom   = "random"
	targetLeader   = "leader"
	targetAttacker = "attacker"
)

var targetModes = []string{targetRandom, targetLeader, targetAttacker}

type player struct {
	presence  runtime.Presence
	UserID    string
	Username  string
	Connected bool
	Alive     bool
	HP        int
	Place     int // set when eliminated, or 1 for the winner
	Progress  int // base-text characters typed; typing garbage doesn't count
	Shields   int
	Bot 	  bool // dev bot; has no presence and never gets messages

	// Private to the player.
	text         []rune
	garbage      []bool // which characters of text are garbage
	pos          int    // cursor into text
	keys         int    // every character received, so the client can tell when it's caught up
	errors       int
	meter        int
	nextWord     int // index into the shared word stream
	targetMode   string
	lastAttacker string

	// Stats.
	history         [cpsWindow]int // Progress at each of the last few seconds
	cps, peakCPS    float64
	aliveTicks      int64
	attacksSent     int
	garbageReceived int

	// Bots only.
	botCPS float64
	botBudget float64 // keystrokes owed, so fractional speeds work
}

func newPlayer(pr runtime.Presence) *player {
	p := &player{
		presence:   pr,
		Connected:  true,
		Alive:      true,
		HP:         maxHP,
		targetMode: targetRandom,
	}
	if pr != nil {
		p.UserID, p.Username = pr.GetUserId(), pr.GetUsername()
	}
	return p
}

// playerView is what everyone can see about a player.
type playerView struct {
	ID        string  `json:"id"`
	Username  string  `json:"username"`
	Connected bool    `json:"connected"`
	Alive     bool    `json:"alive"`
	HP        int     `json:"hp"`
	Place     int     `json:"place,omitempty"`
	Progress  int     `json:"progress"`
	Shields   int     `json:"shields"`
	CPS       float64 `json:"cps"`
	Bot 	  bool	  `json:"bot,omitempty"`
}

func (p *player) view() playerView {
	return playerView{p.UserID, p.Username, p.Connected, p.Alive, p.HP, p.Place, p.Progress, p.Shields, round1(p.cps), p.Bot}
}

type playerResult struct {
	ID              string  `json:"id"`
	Username        string  `json:"username"`
	Place           int     `json:"place"`
	Progress        int     `json:"progress"`
	Errors          int     `json:"errors"`
	PeakCPS         float64 `json:"peak_cps"`
	AvgCPS          float64 `json:"avg_cps"`
	AliveSeconds    int64   `json:"alive_seconds"`
	AttacksSent     int     `json:"attacks_sent"`
	GarbageReceived int     `json:"garbage_received"`
}

func (p *player) result() playerResult {
	secs := p.aliveTicks / tickRate
	avg := 0.0
	if secs > 0 {
		avg = float64(p.Progress) / float64(secs)
	}
	return playerResult{p.UserID, p.Username, p.Place, p.Progress, p.errors,
		round1(p.peakCPS), round1(avg), secs, p.attacksSent, p.garbageReceived}
}

func round1(f float64) float64 { return math.Round(f*10) / 10 }

// --- text ---

func (s *matchState) word(i int) string {
	for len(s.words) <= i {
		s.words = append(s.words, wordList[s.rng.IntN(len(wordList))])
	}
	return s.words[i]
}

// ensureLookahead appends shared words to a player's text when they get close to the end.
func (s *matchState) ensureLookahead(d runtime.MatchDispatcher, p *player) {
	if len(p.text)-p.pos >= lookaheadChars {
		return
	}
	var added []rune
	for len(p.text)+len(added)-p.pos < lookaheadChars {
		if len(p.text)+len(added) > 0 {
			added = append(added, ' ')
		}
		added = append(added, []rune(s.word(p.nextWord))...)
		p.nextWord++
	}
	p.text = append(p.text, added...)
	p.garbage = append(p.garbage, make([]bool, len(added))...)
	sendTo(d, p, opText, map[string]any{"op": "append", "text": string(added)})
}

// insertGarbage puts n garbage characters (plus a space) at the start of a word
// a little ahead of the cursor, so it never lands under keys already in flight.
func (s *matchState) insertGarbage(d runtime.MatchDispatcher, p *player, n int) {
	at := len(p.text)
	for i := p.pos + garbageGap; i < len(p.text); i++ {
		if p.text[i-1] == ' ' {
			at = i
			break
		}
	}
	chunk := make([]rune, 0, n+1)
	for range n {
		chunk = append(chunk, rune(garbageRune[s.rng.IntN(len(garbageRune))]))
	}
	chunk = append(chunk, ' ')

	p.text = append(p.text[:at], append(chunk, p.text[at:]...)...)
	flags := make([]bool, len(chunk))
	for i := range flags {
		flags[i] = true
	}
	p.garbage = append(p.garbage[:at], append(flags, p.garbage[at:]...)...)
	p.garbageReceived += n
	sendTo(d, p, opText, map[string]any{"op": "insert", "at": at, "text": string(chunk)})
}

// --- input ---

// handleKeys checks each typed character. Right moves the cursor and fills the
// meter; wrong only counts as an error.
func (s *matchState) handleKeys(d runtime.MatchDispatcher, p *player, data []byte) {
	if !utf8.Valid(data) {
		return
	}
	for i, r := range []rune(string(data)) {
		p.keys++ // count everything so the client's "caught up" check works
		if s.phase != phasePlaying || !p.Alive || i >= maxKeysPerTick || p.pos >= len(p.text) {
			continue
		}
		if r == p.text[p.pos] {
			if !p.garbage[p.pos] {
				p.Progress++
			}
			p.pos++
			p.meter = min(p.meter+1, meterMax)
		} else {
			p.errors++
		}
	}
	s.ensureLookahead(d, p)
}

func (s *matchState) handleAction(d runtime.MatchDispatcher, p *player, action string) {
	if s.phase != phasePlaying || !p.Alive {
		return
	}
	switch action {
	case "attack":
		if p.meter < attackCost {
			return
		}
		target := s.pickTarget(p)
		if target == nil {
			return
		}
		p.meter -= attackCost
		p.attacksSent++
		target.lastAttacker = p.UserID
		blocked := target.Shields > 0
		if blocked {
			target.Shields--
		} else {
			s.insertGarbage(d, target, attackSize)
		}
		sendTo(d, target, opEvent, map[string]any{"type": "attacked", "by": p.Username, "blocked": blocked})
		sendTo(d, p, opEvent, map[string]any{"type": "attack_sent", "to": target.Username, "blocked": blocked})
	case "shield":
		if p.meter >= shieldCost && p.Shields < maxShields {
			p.meter -= shieldCost
			p.Shields++
		}
	case "target":
		for i, m := range targetModes {
			if m == p.targetMode {
				p.targetMode = targetModes[(i+1)%len(targetModes)]
				break
			}
		}
	}
}

func (s *matchState) pickTarget(p *player) *player {
	var others []*player
	for _, id := range s.order {
		if o := s.players[id]; o.Alive && o.UserID != p.UserID {
			others = append(others, o)
		}
	}
	if len(others) == 0 {
		return nil
	}
	switch p.targetMode {
	case targetLeader:
		best := others[0]
		for _, o := range others[1:] {
			if o.Progress > best.Progress {
				best = o
			}
		}
		return best
	case targetAttacker:
		if a, ok := s.players[p.lastAttacker]; ok && a.Alive {
			return a
		}
	}
	return others[s.rng.IntN(len(others))]
}

// --- the storm, health, speed and the end of the game ---

func (s *matchState) gameTick(d runtime.MatchDispatcher, tick int64) {
	elapsed := tick - s.startTick
	s.runBots(d)

	// Live speed, once a second: progress over the last cpsWindow seconds.
	if elapsed > 0 && elapsed%tickRate == 0 {
		second := int(elapsed / tickRate)
		var speeds []float64
		for _, p := range s.players {
			if !p.Alive {
				continue
			}
			slot := second % cpsWindow
			window := min(second, cpsWindow)
			p.cps = float64(p.Progress-p.history[slot]) / float64(window)
			p.history[slot] = p.Progress
			p.peakCPS = max(p.peakCPS, p.cps)
			if p.Connected {
				speeds = append(speeds, p.cps)
			}
		}
		// The median, so one very fast player doesn't speed the storm up for everyone.
		if len(speeds) > 0 {
			slices.Sort(speeds)
			s.lobbyCPS = speeds[len(speeds)/2]
		}
	}

	// Move the storm: it ramps up over time and keeps pace with fast lobbies.
	if elapsed > stormGraceTicks {
		ramp := float64((elapsed - stormGraceTicks) / stormRampEvery)
		s.stormSpeed = max(stormBaseCPS+stormRampCPS*ramp, stormLobbyFactor*s.lobbyCPS)
		s.storm += s.stormSpeed / tickRate
	}

	// Damage anyone the storm has passed.
	for _, id := range s.order {
		p := s.players[id]
		if !p.Alive {
			continue
		}
		p.aliveTicks++
		if float64(p.Progress) < s.storm {
			p.HP -= stormDamagePerTick
			if p.HP <= 0 {
				s.eliminate(d, p)
			}
		}
	}

	// Private state every tick, everyone's public state a few times a second.
	for _, p := range s.players {
		sendTo(d, p, opSelf, map[string]any{
			"pos": p.pos, "keys": p.keys, "errors": p.errors, "meter": p.meter,
			"shields": p.Shields, "hp": p.HP, "alive": p.Alive, "target": p.targetMode,
		})
	}
	if tick%progressEvery == 0 {
		broadcast(d, opProgress, map[string]any{
			"storm": round1(s.storm), "storm_cps": round1(s.stormSpeed), "players": s.publicList(),
		}, s.presences())
	}

	// Last one standing wins. A solo private match ends when you go down.
	alive := s.aliveCount()
	if (len(s.players) > 1 && alive <= 1) || alive == 0 {
		s.finish(d, tick)
	}
}

func (s *matchState) eliminate(d runtime.MatchDispatcher, p *player) {
	p.Alive = false
	p.HP = 0
	p.Place = s.aliveCount() + 1
	broadcast(d, opEvent, map[string]any{"type": "eliminated", "username": p.Username, "place": p.Place}, s.presences())
}