package main

import (
	"encoding/json"
	"fmt"

	"github.com/heroiclabs/nakama-common/runtime"
)

// Dev-only bots, so you can test a full match on your own. They type through
// the same handleKeys/handleAction code as real players, so they exercise the
// real rules. Only allowed when the server runs with DEV_MODE=true.

const opAddBots int64 = 4 // client -> server, host only, private lobby only

const (
	botMistakeRate = 0.04 // chance each keystroke is wrong
	botAttackOdds  = 0.05 // chance per tick to attack when the meter allows
)

var botNames = []string{
	"ada", "byte", "cache", "delta", "echo", "flux", "glitch", "hex", "ion", "jolt",
	"kilo", "lambda", "mux", "nano", "octet", "pixel", "qubit", "rune", "sigma", "tensor",
}

func (s *matchState) handleAddBots(d runtime.MatchDispatcher, p *player, data []byte) {
	if cfg.DevMode != "true" || !s.private || s.phase != phaseLobby || p.UserID != s.hostID {
		return
	}
	var req struct {
		Count  int     `json:"count"`
		MinWPM float64 `json:"min_wpm"`
		MaxWPM float64 `json:"max_wpm"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}
	minWPM := min(max(req.MinWPM, 10), 250)
	maxWPM := min(max(req.MaxWPM, minWPM), 250)

	for i := 0; i < req.Count && len(s.players) < s.mode.MaxPlayers; i++ {
		wpm := minWPM + s.rng.Float64()*(maxWPM-minWPM)
		id := fmt.Sprintf("bot-%d", s.rng.Uint32())
		name := fmt.Sprintf("%s_bot_%d", botNames[s.rng.IntN(len(botNames))], int(wpm))
		bot := newPlayer(nil)
		bot.UserID, bot.Username = id, name
		bot.Bot = true
		bot.botCPS = wpm / 12 // 1 word = 5 characters + a space, roughly
		s.players[id] = bot
		s.order = append(s.order, id)
	}
	_ = d.MatchLabelUpdate(s.label())
	s.sendLobby(d)
}

// runBots types for every bot that's still alive. Called once per tick.
func (s *matchState) runBots(d runtime.MatchDispatcher) {
	for _, id := range s.order {
		p := s.players[id]
		if !p.Bot || !p.Alive {
			continue
		}
		// Speed wobbles ±20% each tick so bots don't move in lockstep.
		p.botBudget += p.botCPS * (0.8 + 0.4*s.rng.Float64()) / tickRate

		var keys []rune
		pos := p.pos
		for p.botBudget >= 1 && pos < len(p.text) {
			p.botBudget--
			if s.rng.Float64() < botMistakeRate {
				keys = append(keys, '~') // never appears in the text
				continue
			}
			keys = append(keys, p.text[pos])
			pos++
		}
		if len(keys) > 0 {
			s.handleKeys(d, p, []byte(string(keys)))
		}

		// Keep a shield up, otherwise attack now and then.
		switch {
		case p.Shields == 0 && p.meter >= shieldCost:
			s.handleAction(d, p, "shield")
		case p.meter >= attackCost && s.rng.Float64() < botAttackOdds:
			s.handleAction(d, p, "attack")
		}
	}
}