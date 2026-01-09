package main

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/heroiclabs/nakama-common/runtime"
)

const (
	moduleName = "typing99"
)

// MatchState holds the state of the match
type MatchState struct {
	Paragraph       string                  `json:"paragraph"`
	Players         map[string]*PlayerState `json:"players"`
	MatchTime       float64                 `json:"match_time"`
	TickRate        int                     `json:"tick_rate"`
	BaseDangerSpeed float64                 `json:"base_danger_speed"`
}

// PlayerState holds individual player data
type PlayerState struct {
	UserID              string  `json:"user_id"`
	Username            string  `json:"username"`
	CaretPosition       int     `json:"caret_position"`        // How many chars typed
	DangerCaretPosition float64 `json:"danger_caret_position"` // Danger zone position
	DangerSpeed         float64 `json:"danger_speed"`          // Current danger speed
	Health              int     `json:"health"`                // 0-100
	IsAlive             bool    `json:"is_alive"`
	Score               int     `json:"score"` // Points earned
}

// Typing99Match implements the Match Interface
type Typing99Match struct{}

// MatchInit is called when the match is created
func (m *Typing99Match) MatchInit(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, params map[string]interface{}) (interface{}, int, string) {
	logger.Info("Initializing Typing 99 Match")

	// Generate a paragraph for the match
	paragraph := generateParagraph()

	// Initialize match state
	state := &MatchState{
		Paragraph:       paragraph,
		Players:         make(map[string]*PlayerState),
		MatchTime:       0,
		TickRate:        10,  // 10 updates per second
		BaseDangerSpeed: 1.0, // 1 character per second initially
	}

	// Label for matchmaking
	label := ""

	return state, state.TickRate, label
}

// MatchJoinAttempt is called when a player tries to join
func (m *Typing99Match) MatchJoinAttempt(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presence runtime.Presence, metadata map[string]string) (interface{}, bool, string) {
	matchState := state.(*MatchState)

	logger.Info("Player attempting to join", "user_id", presence.GetUserId(), "username", presence.GetUsername())

	// Create player state
	playerState := &PlayerState{
		UserID:              presence.GetUserId(),
		Username:            presence.GetUsername(),
		CaretPosition:       0,
		DangerCaretPosition: 0,
		DangerSpeed:         matchState.BaseDangerSpeed,
		Health:              100,
		IsAlive:             true,
		Score:               0,
	}

	// Add player to match
	matchState.Players[presence.GetUserId()] = playerState

	// Allow join
	return matchState, true, ""
}

// MatchJoin is called when a player successfully join
func (m *Typing99Match) MatchJoin(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
	matchState := state.(*MatchState)

	logger.Info("Player joined match", "player_count", len(matchState.Players))

	// Send current match state to all players
	stateJSON, _ := json.Marshal(matchState)
	dispatcher.BroadcastMessage(1, stateJSON, nil, nil, true)

	return matchState
}

// MatchLeave is called when a player leaves
func (m *Typing99Match) MatchLeave(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
	matchState := state.(*MatchState)

	for _, presence := range presences {
		logger.Info("Player left match", "user_id", presence.GetUserId())
		delete(matchState.Players, presence.GetUserId())
	}

	return matchState
}

// MatchLoop is called on every tick
func (m *Typing99Match) MatchLoop(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, messages []runtime.MatchData) interface{} {
	matchState := state.(*MatchState)

	matchState.MatchTime += 1.0 / float64(matchState.TickRate)

	for _, message := range messages {
		switch message.GetOpCode() {
		case 1: // Player typed a character
			m.handleTyping(matchState, message, logger)
		}
	}

	// Update danger carets for all players
	m.updateDangerCarets(matchState, logger)

	// Apply damage to players caught by danger zone
	m.applyDamage(matchState, logger)

	// Check for eliminated players
	m.checkEliminations(matchState, logger)

	// Broadcast updated state to all players
	stateJSON, _ := json.Marshal(matchState)
	dispatcher.BroadcastMessage(2, stateJSON, nil, nil, true)

	// Check if match should end
	alivePlayers := 0
	for _, player := range matchState.Players {
		if player.IsAlive {
			alivePlayers++
		}
	}

	// End match if 0 or 1 players alive
	if alivePlayers < 1 {
		logger.Info("Match ending", "alive_players", alivePlayers)
		return nil // Returning nil ends the match
	}

	return matchState

}

// MatchTerminate is called when the match ends
func (m *Typing99Match) MatchTerminate(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, graceSeconds int) interface{} {
	logger.Info("Match terminated")
	return state
}

// MatchSignal handles external signals to the match
func (m *Typing99Match) MatchSignal(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, data string) (interface{}, string) {
	return state, ""
}

// Helper functions

func (m *Typing99Match) handleTyping(state *MatchState, message runtime.MatchData, logger runtime.Logger) {
	userID := message.GetUserId()
	player, exists := state.Players[userID]
	if !exists || !player.IsAlive {
		return
	}

	// Parse the typed character
	var data struct {
		Character string `json:"character"`
		Position  int    `json:"position"`
	}
	json.Unmarshal(message.GetData(), &data)

	// Validate the character matches the paragraph
	if data.Position < len(state.Paragraph) && string(state.Paragraph[data.Position]) == data.Character {
		player.CaretPosition++
		player.Score += 10
		logger.Debug("Player typed correctly", "user_id", userID, "position", player.CaretPosition)
	} else {
		logger.Debug("Player typed incorrectly", "user_id", userID)
	}

}

func (m *Typing99Match) updateDangerCarets(state *MatchState, logger runtime.Logger) {
	deltaTime := 1.0 / float64(state.TickRate)

	// Increase danger speed over time (every 30 seconds, increase by 10%)
	speedMultiplier := 1.0 + (state.MatchTime / 30.0 * 0.1)

	for _, player := range state.Players {
		if !player.IsAlive {
			continue
		}

		// Update danger caret position
		player.DangerSpeed = state.BaseDangerSpeed * speedMultiplier
		player.DangerCaretPosition += player.DangerSpeed * deltaTime

	}
}

func (m *Typing99Match) applyDamage(state *MatchState, logger runtime.Logger) {
	for _, player := range state.Players {
		if !player.IsAlive {
			continue
		}

		// Check if danger caret has overtaken player
		gap := float64(player.CaretPosition) - player.DangerCaretPosition
		if gap < 0 {
			// Player is behind danger zone - take damage
			damagePerSecond := 5
			damageThisTick := int(float64(damagePerSecond) / float64(state.TickRate))
			player.Health -= damageThisTick

			if player.Health < 0 {
				player.Health = 0
			}

			logger.Debug("Player taking damage", "user_id", player.UserID, "health", player.Health)
		}
	}
}

func (m *Typing99Match) checkEliminations(state *MatchState, logger runtime.Logger) {
	for _, player := range state.Players {
		if player.IsAlive && player.Health <= 0 {
			player.IsAlive = false
			logger.Info("Player eliminated", "user_id", player.UserID)
		}
	}
}

func generateParagraph() string {
	// For now, return a simple test paragraph
	// TODO: Implement proper paragraph generation
	return "The quick brown fox jumps over the lazy dog. This is a test paragraph for our typing battle royale game. Keep typing to stay ahead of the danger zone and survive as long as possible."
}
