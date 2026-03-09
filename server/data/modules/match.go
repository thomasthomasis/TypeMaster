package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"math/rand"
	"strings"

	"github.com/heroiclabs/nakama-common/runtime"
)

const (
	moduleName = "typing99"
)

const (
	OpCodeTyping    = 1 // Client -> Server: "I typed a key"
	OpCodeUpdate    = 2 // Server -> Client: "Here is the new game state"
	OpCodeCountdown = 3 // Server -> Client: "Game starting in X..."
	OpCodeWinner    = 4 // Server -> Client: "Winner Found..."
	OpCodePrivate   = 5 // Server -> Client: "Private player update..."
)

type GameStatus int

const (
	StatusWaiting GameStatus = iota
	StatusStarting
	StatusPlaying
)

// MatchState holds the state of the match
type MatchState struct {
	Status             GameStatus              `json:"status"`
	Players            map[string]*PlayerState `json:"players"`
	MatchTime          float64                 `json:"match_time"`
	TickRate           int                     `json:"tick_rate"`
	CountdownTicks     int                     `json:"countdown_ticks"`
	StormSpeed         float64                 `json:"storm_speed"`
	StormCaretPosition float64                 `json:"storm_caret_position"`
	CurrentDamage      int                     `json:"current_damage"`
}

// PlayerState holds individual player data
type PlayerState struct {
	UserID        string           `json:"user_id"`
	Username      string           `json:"username"`
	CaretPosition int              `json:"caret_position"` // How many chars typed
	Health        int              `json:"health"`         // 0-100
	IsAlive       bool             `json:"is_alive"`
	Score         int              `json:"score"` // Points earned
	Paragraph     string           `json:"-"`
	Offset        int              `json:"offset"`
	Presence      runtime.Presence `json:"-"` // "-" means don't include in JSON broadcasts
}

// Typing99Match implements the Match Interface
type Typing99Match struct{}

// MatchInit is called when the match is created
func (m *Typing99Match) MatchInit(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, params map[string]interface{}) (interface{}, int, string) {
	logger.Info("Initializing Typing 99 Match")

	// Initialize match state
	state := &MatchState{
		Status:     StatusWaiting,
		Players:    make(map[string]*PlayerState),
		TickRate:   10,  // 10 updates per second
		StormSpeed: 1.0, // 1 character per second initially
	}

	// Label for matchmaking
	label := map[string]interface{}{
		"mode": "battle_royale",
		"fast": "true",
	}
	labelJSON, _ := json.Marshal(label)

	return state, state.TickRate, string(labelJSON)
}

// MatchJoinAttempt is called when a player tries to join
func (m *Typing99Match) MatchJoinAttempt(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presence runtime.Presence, metadata map[string]string) (interface{}, bool, string) {
	matchState := state.(*MatchState)

	logger.Info("Player attempting to join", "user_id", presence.GetUserId(), "username", presence.GetUsername())

	// Create player state
	playerState := &PlayerState{
		Presence:      presence,
		UserID:        presence.GetUserId(),
		Username:      presence.GetUsername(),
		CaretPosition: 0,
		Health:        100,
		IsAlive:       true,
		Score:         0,
		Paragraph:     generateRandomChunk(20),
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

	for _, presence := range presences {
		player, exists := matchState.Players[presence.GetUserId()]

		if exists {
			player.Paragraph = generateRandomChunk(20)

			m.sendPrivateUpdate(dispatcher, player, logger)

			logger.Info("Sent initial private text to player", "uid", presence.GetUserId())
		}
	}

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

	switch matchState.Status {

	case StatusWaiting:
		// Transition to starting if we have enough players
		// For testing with 2 tabs, use >= 2
		if len(matchState.Players) >= 2 {
			matchState.Status = StatusStarting
			matchState.CountdownTicks = 3 * matchState.TickRate
		}

	case StatusStarting:
		matchState.CountdownTicks--

		// Broadcast countdown every second to sync clients
		if matchState.CountdownTicks%matchState.TickRate == 0 {
			secondsLeft := matchState.CountdownTicks / matchState.TickRate
			m.broadcastCountdown(dispatcher, secondsLeft)
		}

		if matchState.CountdownTicks <= 0 {
			matchState.Status = StatusPlaying
		}

	case StatusPlaying:
		// Process Inputs (Typing)
		for _, message := range messages {
			if message.GetOpCode() == OpCodeTyping {
				m.handleTyping(matchState, message, logger, dispatcher)
			}
		}

		// Physics & Logic (Danger Zone)
		matchState.MatchTime += 1.0 / float64(matchState.TickRate)
		m.updateDangerCarets(matchState, logger)
		m.applyDamage(matchState, logger)

		// Win Condition Check
		shouldEnd := m.checkEliminations(matchState, logger, dispatcher)
		if shouldEnd {
			return nil // Shut down the match instance
		}
	}

	m.broadcastUpdate(dispatcher, matchState)

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

func (m *Typing99Match) handleTyping(state *MatchState, message runtime.MatchData, logger runtime.Logger, dispatcher runtime.MatchDispatcher) {
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
	if err := json.Unmarshal(message.GetData(), &data); err != nil {
		logger.Error("Failed to unmarshal typing data: %v", err)
		return
	}

	localIndex := data.Position - player.Offset

	// Validate against the player's unique paragraph
	if localIndex >= 0 && localIndex < len(player.Paragraph) && string(player.Paragraph[localIndex]) == data.Character {
		player.CaretPosition++

		// 2. SLIDING WINDOW: Trim text behind the player
		// If the player is more than 50 chars into their current buffer
		if localIndex > 100 {
			trimAmount := 30 // Remove 30 chars from the front
			player.Paragraph = player.Paragraph[trimAmount:]
			player.Offset += trimAmount

			// Sync the new window to the client immediately
			m.sendPrivateUpdate(dispatcher, player, logger)
		}

		// 3. INFINITE GROWTH: Add more text if reaching the end
		if len(player.Paragraph)-localIndex < 50 {
			player.Paragraph += " " + generateRandomChunk(10)
			m.sendPrivateUpdate(dispatcher, player, logger)
		}
	}

}

func (m *Typing99Match) sendPrivateUpdate(dispatcher runtime.MatchDispatcher, player *PlayerState, logger runtime.Logger) {
	// We create a specific payload for the private update
	payload := map[string]interface{}{
		"paragraph": player.Paragraph,
		"offset":    player.Offset,
	}

	data, err := json.Marshal(payload)
	if err != nil {
		logger.Error("Failed to marshal private update: %v", err)
		return
	}

	// We wrap the single player's Presence in a slice.
	// This tells Nakama: "Only send this to this specific person."
	presences := []runtime.Presence{player.Presence}

	// We use OpCode 5 (or any unused number) for "Private Content Update"
	dispatcher.BroadcastMessage(5, data, presences, nil, true)
}

func (m *Typing99Match) updateDangerCarets(state *MatchState, logger runtime.Logger) {
	if state.Status != StatusPlaying || state.MatchTime < 5.0 {
		return
	}

	deltaTime := 1.0 / float64(state.TickRate)
	elapsedActiveTime := state.MatchTime - 5.0

	// Global Speed & Damage Scaling
	state.StormSpeed = 1.0 + (elapsedActiveTime / 20.0 * 0.15)
	state.CurrentDamage = 5 + int(state.MatchTime/60.0*5)

	// Move the ONE global storm
	state.StormCaretPosition += state.StormSpeed * deltaTime
}

func (m *Typing99Match) applyDamage(state *MatchState, logger runtime.Logger) {

	damageThisTick := float64(state.CurrentDamage) / float64(state.TickRate)

	for _, player := range state.Players {
		if !player.IsAlive {
			continue
		}

		if state.StormCaretPosition > float64(player.CaretPosition) {

			currentHealth := float64(player.Health)
			updatedHealth := currentHealth - damageThisTick

			player.Health = int(updatedHealth)

			logger.Debug("Player in storm", "user_id", player.UserID, "health", player.Health, "storm_pos", state.StormCaretPosition, "player_pos", player.CaretPosition)

			if player.Health < 0 {
				player.Health = 0
			}
		}
	}
}

func (m *Typing99Match) checkEliminations(state *MatchState, logger runtime.Logger, dispatcher runtime.MatchDispatcher) bool {

	aliveCount := 0
	var winnerID string

	for id, p := range state.Players {
		if p.IsAlive && p.Health <= 0 {
			p.IsAlive = false
			logger.Info("Player eliminated ", "user_id", id)
		}

		if p.IsAlive {
			aliveCount++
			winnerID = id
		}
	}

	if aliveCount <= 1 && state.Status == StatusPlaying {
		// Handle the win!
		logger.Info("Match over. Winner: ", winnerID)

		resultData, _ := json.Marshal(map[string]string{"winner": winnerID})
		dispatcher.BroadcastMessage(OpCodeWinner, resultData, nil, nil, true)

		return true // Signal to terminate
	}

	return false // Match continues
}

func generateRandomChunk(wordCount int) string {
	// A simple pool of words to pick from randomly
	words := []string{
		"quantum", "velocity", "keyboard", "protocol", "cyberpunk", "override",
		"syntax", "compiler", "network", "latency", "bandwidth", "firewall",
		"database", "variable", "function", "encryption", "bitrate", "algorithm",
	}

	var chunk strings.Builder
	for i := range wordCount {
		// Pick a random word from the slice
		word := words[rand.Intn(len(words))]
		if i == 0 {
			chunk.WriteString(word)
		} else {
			chunk.WriteString(" " + word)
		}
	}
	return chunk.String()
}

// Helper to send a simple countdown number to all players
func (m *Typing99Match) broadcastCountdown(dispatcher runtime.MatchDispatcher, seconds int) {
	payload := map[string]int{"seconds": seconds}
	data, _ := json.Marshal(payload)

	// OpCode 3 is what we defined for Countdowns
	// nil for presences means "send to everyone"
	dispatcher.BroadcastMessage(OpCodeCountdown, data, nil, nil, true)
}

// Helper to send the entire game state to all players
func (m *Typing99Match) broadcastUpdate(dispatcher runtime.MatchDispatcher, state *MatchState) {
	data, err := json.Marshal(state)
	if err != nil {
		return
	}

	// OpCode 2 is our "Source of Truth" update
	dispatcher.BroadcastMessage(OpCodeUpdate, data, nil, nil, true)
}
