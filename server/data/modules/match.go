package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"math"
	"math/rand"
	"strings"
	"time"

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

	OpCodeNotification = 6 // Server -> Client: "You are being attacked!"
	OpCodeElimination  = 8 // Server -> Client: "Player X was knocked out"
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
	TickCount          int64                   `json:"tick_count"`
	NextLevelTick      int64                   `json:"-"`
	LevelInterval      int64                   `json:"-"`
	CurrentIncrease    float64                 `json:"-"`
	CountdownTicks     int                     `json:"countdown_ticks"`
	StormLevel         int                     `json:"storm_level"`
	StormSpeed         float64                 `json:"storm_speed"`
	StormCaretPosition float64                 `json:"storm_caret_position"`
	CurrentDamage      int                     `json:"current_damage"`
	Mode               string                  `json:"mode"`
}

// PlayerState holds individual player data
type PlayerState struct {
	// Basic Fields
	UserID   string           `json:"user_id"`
	Username string           `json:"username"`
	Presence runtime.Presence `json:"-"` // "-" means don't include in JSON broadcasts

	Health       int    `json:"health"` // 0-100
	IsAlive      bool   `json:"is_alive"`
	Score        int    `json:"score"` // Points earned
	GarbageSent  int    `json:"garbage_sent"`
	KOs          int    `json:"kos"`
	ActiveStream string `json:"active_stream"`
	SpamCounter  int    `json:"spam_counter"`
	IsWinner     bool   `json:"is_winner"`

	// CPS Tracking
	Keystrokes []int64 `json:"-"` // Slice of Unix timestamps (milliseconds)
	CPSBuckets [5]int
	LastUpdate int64
	CurrentCPS float64 `json:"current_cps"`

	// Survival (Main)
	Paragraph     string `json:"-"`
	CaretPosition int    `json:"caret_position"` // How many chars typed
	Offset        int    `json:"offset"`

	// Attack Sidebar
	AttackBuffer string `json:"attack_buffer"`
	AttackCaret  int    `json:"attack_caret"`
	AttackPower  int    `json:"attack_power"`

	// Shield Sidebar
	ShieldBuffer string `json:"shield_buffer"`
	ShieldCaret  int    `json:"shield_caret"`
	ShieldPower  int    `json:"shield_power"`
	ShieldStacks int    `json:"shield_stacks"`

	TargetID   string `json:"target_id"`
	TargetMode string `json:"target_mode"` // "Random", "Leader", "Attacker"

	LastAttackerID string `json:"-"`
}

// Typing99Match implements the Match Interface
type Typing99Match struct{}

// MatchInit is called when the match is created
func (m *Typing99Match) MatchInit(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, params map[string]interface{}) (interface{}, int, string) {
	logger.Info("Initializing Typing 99 Match")

	mode, ok := params["mode"].(string)
	if !ok {
		mode = "duel"
	}

	// Initialize match state
	state := &MatchState{
		Status:        StatusWaiting,
		Players:       make(map[string]*PlayerState),
		TickRate:      10, // 10 updates per second
		TickCount:     0,
		StormSpeed:    1.0, // 1 character per second initially
		Mode:          mode,
		StormLevel:    1,
		NextLevelTick: 0,
	}

	// Label for matchmaking
	label := map[string]interface{}{
		"mode": params["mode"], // "duel", "brawl", or "battle"
		"size": params["size"],
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
			player.AttackBuffer = generateRandomChunk(10)
			player.ShieldBuffer = generateRandomChunk(10)

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
	matchState, ok := state.(*MatchState)

	if !ok {
		logger.Error("State not of type *MatchState")
		return nil
	}

	matchState.TickCount++

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

		if matchState.TickCount%int64(matchState.TickRate) == 0 {

			for _, p := range matchState.Players {

				if p.IsAlive {
					// Calculate CPS based on what is CURRENTLY in the buckets
					total := 0
					for _, count := range p.CPSBuckets {
						total += count
					}
					p.CurrentCPS = float64(total) / 5.0

					// Shift buckets for the NEXT second
					for i := 4; i > 0; i-- {
						p.CPSBuckets[i] = p.CPSBuckets[i-1]
					}
					p.CPSBuckets[0] = 0 // Reset ONLY after the calculation
				}

			}

			m.updateStormSpeed(matchState, logger)
			matchState.StormCaretPosition += (matchState.StormSpeed / float64(matchState.TickRate))

		}

		// Physics & Logic (Danger Zone)
		matchState.MatchTime += 1.0 / float64(matchState.TickRate)

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

	matchState := state.(*MatchState)

	matchDuration := int64(matchState.MatchTime)

	for _, p := range matchState.Players {

		profile, err := GetProfile(ctx, nk, p.UserID)
		if err != nil {
			logger.Error("Could not fetch profile for user %s: %v", p.UserID, err)
			continue
		}

		profile.TotalGames++
		profile.TotalPlayTimeSeconds += matchDuration
		profile.Coins += p.Score / 10

		if p.CurrentCPS > profile.LifetimeMaxCPS {
			profile.LifetimeMaxCPS = p.CurrentCPS
		}

		totalEntries := float64(profile.TotalGames)
		profile.LifetimeAvgCPS = ((profile.LifetimeAvgCPS * (totalEntries - 1)) + p.CurrentCPS) / totalEntries

		//profile.TotalGarbageSent += int64(p.GarbageSent)
		//profile.TotalKOs += p.KOs

		/*
			if p.IsWinner {
				profile.TotalWins++
				profile.CurrentWinStreak++

				if profile.CurrentWinStreak > profile.MaxWinStreak {
					profile.MaxWinStreak = profile.CurrentWinStreak
				}
			} else {
				profile.CurrentWinStreak = 0
			}
		*/

		if err := SaveProfile(ctx, nk, p.UserID, profile); err != nil {
			logger.Error("Failed to save updated profile for user %s: %v", p.UserID, err)
		}
	}

	logger.Info("Match terminated")
	return state
}

// MatchSignal handles external signals to the match
func (m *Typing99Match) MatchSignal(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, data string) (interface{}, string) {
	return state, ""
}

func (m *Typing99Match) recordKeystroke(player *PlayerState) {
	now := time.Now().UnixMilli()
	player.Keystrokes = append(player.Keystrokes, now)
}

func (m *Typing99Match) calculateLiveCPS(player *PlayerState) {
	now := time.Now().UnixMilli()
	window := int64(5000) // 5 second rolling window

	// Find the first index that is within the 5 second window
	validStartIndex := -1
	for i, ts := range player.Keystrokes {
		if now-ts <= window {
			validStartIndex = i
			break
		}
	}

	// Prune the array
	if validStartIndex == -1 {
		// Everything in the array is too old
		player.Keystrokes = player.Keystrokes[:0]
		player.CurrentCPS = 0
	} else {
		// Keep only the valid timestamps and discard the old ones
		player.Keystrokes = player.Keystrokes[validStartIndex:]

		// CPS = Count / Duration (5 seconds)
		player.CurrentCPS = float64(len(player.Keystrokes)) / 5.0
	}
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
		Stream    string `json:"stream"`
		Character string `json:"character"`
	}
	json.Unmarshal(message.GetData(), &data)

	switch data.Stream {
	case "main":
		m.processMainStream(state, player, data.Character, dispatcher, logger)
	case "attack":
		m.processAttackStream(state, player, data.Character, dispatcher, logger)
	case "shield":
		m.processShieldStream(state, player, data.Character, dispatcher, logger)
	}

}

func (m *Typing99Match) processMainStream(state *MatchState, player *PlayerState, char string, dispatcher runtime.MatchDispatcher, logger runtime.Logger) {

	localIndex := player.CaretPosition - player.Offset

	// Safety check for bounds
	if localIndex < 0 || localIndex >= len(player.Paragraph) {
		return
	}

	expectedChar := string(player.Paragraph[localIndex])

	if char == expectedChar {

		// Success condition
		player.CaretPosition++
		player.Score += 10
		player.CPSBuckets[0]++ // Increment the "current second" bucket

		if player.SpamCounter > 0 {
			player.SpamCounter--
		}

		// --- HANDLE SLIDING WINDOW ---
		if localIndex > 50 {
			trimAmount := 30
			player.Paragraph = player.Paragraph[trimAmount:]
			player.Offset += trimAmount
			m.sendPrivateUpdate(dispatcher, player, logger)
		}

		// --- HANDLE INFINITE TEXT ---
		if len(player.Paragraph)-localIndex < 50 {
			player.Paragraph += " " + generateRandomChunk(10)
			m.sendPrivateUpdate(dispatcher, player, logger)
		}

	} else {
		player.SpamCounter++

		if player.SpamCounter > 4 {
			m.injectGarbageAhead(player, 10, 5)

		} else {
			player.CaretPosition++

			m.injectGarbageAhead(player, 30, 3)
		}

		m.sendPrivateUpdate(dispatcher, player, logger)
	}
}

func (m *Typing99Match) processAttackStream(state *MatchState, player *PlayerState, char string, dispatcher runtime.MatchDispatcher, logger runtime.Logger) {

	// Validate character
	if player.AttackCaret < len(player.AttackBuffer) && string(player.AttackBuffer[player.AttackCaret]) == char {
		player.AttackCaret++
		player.AttackPower++

		// Every 15 characters, fire a garbage packet
		if player.AttackPower >= 15 {
			target := state.Players[player.TargetID]
			if target != nil && target.IsAlive {
				m.deliverGarbage(player, target, 15, logger, dispatcher)
				m.sendPrivateUpdate(dispatcher, target, logger)
			}
			player.AttackPower = 0
		}

		// Infinite Generation: If buffer is running low, add more "War Text"
		if len(player.AttackBuffer)-player.AttackCaret < 20 {
			player.AttackBuffer += " " + generateRandomChunk(10) // Harder words for attacks
			m.sendPrivateUpdate(dispatcher, player, logger)
		}
	}
}

func (m *Typing99Match) processShieldStream(state *MatchState, player *PlayerState, char string, dispatcher runtime.MatchDispatcher, logger runtime.Logger) {
	if player.ShieldCaret < len(player.ShieldBuffer) && string(player.ShieldBuffer[player.ShieldCaret]) == char {
		player.ShieldCaret++
		player.ShieldPower++

		// 1. Every 30 characters, gain a Shield Stack (Max 3)
		if player.ShieldPower >= 30 {
			if player.ShieldStacks < 3 {
				player.ShieldStacks++
			}
			player.ShieldPower = 0
		}

		// 2. Infinite Generation
		if len(player.ShieldBuffer)-player.ShieldCaret < 20 {
			player.ShieldBuffer += " " + generateRandomChunk(10) // Code-like text
			m.sendPrivateUpdate(dispatcher, player, logger)
		}
	}
}

func (m *Typing99Match) injectGarbageAhead(player *PlayerState, distance int, amount int) {
	localIndex := player.CaretPosition - player.Offset
	insertionPoint := localIndex + distance

	if insertionPoint >= len(player.Paragraph) {
		insertionPoint = len(player.Paragraph) - 1
	}

	garbageText := generateGarbageChunk(amount)

	player.Paragraph = player.Paragraph[:insertionPoint] + garbageText + player.Paragraph[insertionPoint:]
}

func (m *Typing99Match) deliverGarbage(attacker *PlayerState, target *PlayerState, amount int, logger runtime.Logger, dispatcher runtime.MatchDispatcher) {

	if target.ShieldStacks > 0 {
		target.ShieldStacks--
		logger.Info("Attack blocked by %s's shield!", target.Username)
		return
	}

	// Track the attacker for the Kill Feed later
	target.LastAttackerID = attacker.UserID

	localIndex := target.CaretPosition - target.Offset
	injectionPoint := localIndex + 20

	if injectionPoint > len(target.Paragraph) {
		injectionPoint = len(target.Paragraph)
	}

	garbageText := generateGarbageChunk(amount)

	target.Paragraph = target.Paragraph[:injectionPoint] + garbageText + target.Paragraph[injectionPoint:]

	logger.Info("Delivered %d garbage chars to %s at local index %d", amount, target.Username, injectionPoint)

	notification := map[string]interface{}{
		"attacker_id": attacker.UserID,
		"amount":      amount,
	}
	notifData, _ := json.Marshal(notification)

	dispatcher.BroadcastMessage(OpCodeNotification, notifData, []runtime.Presence{target.Presence}, nil, true)
}

func (m *Typing99Match) handleStreamSwitch(state *MatchState, message runtime.MatchData) {
	player := state.Players[message.GetUserId()]

	var data struct {
		Stream string `json:"stream"`
	}
	json.Unmarshal(message.GetData(), &data)

	player.ActiveStream = data.Stream

	if player.ActiveStream == "attack" {
		player.AttackBuffer = generateRandomChunk(5)
	}
}

func (m *Typing99Match) updateTargets(state *MatchState, logger runtime.Logger) {

	for _, player := range state.Players {
		if !player.IsAlive {
			continue
		}

		switch player.TargetMode {
		case "Random":
			currentTarget, exists := state.Players[player.TargetID]
			if player.TargetID == "" || !exists || !currentTarget.IsAlive {
				player.TargetID = m.findRandomTarget(state, player.UserID)
			}

		case "Leader":
			var leaderID string
			maxPos := -1

			for id, p := range state.Players {

				if id != player.UserID && p.IsAlive {
					if p.CaretPosition > maxPos {
						maxPos = p.CaretPosition
						leaderID = id
					}
				}
			}

			player.TargetID = leaderID

		case "Attacker":
			var attackerID string
			maxAttackerPos := -1

			for id, p := range state.Players {
				if id != player.UserID && p.IsAlive && p.TargetID == player.UserID {
					if p.CaretPosition > maxAttackerPos {
						maxAttackerPos = p.CaretPosition
						attackerID = id
					}
				}
			}

			if attackerID == "" {

				fallbackTarget, exists := state.Players[player.TargetID]
				if player.TargetID == "" || !exists || !fallbackTarget.IsAlive {
					player.TargetID = m.findRandomTarget(state, player.UserID)
				}
			} else {
				player.TargetID = attackerID
			}
		}
	}
}

func (m *Typing99Match) findRandomTarget(state *MatchState, excludeID string) string {
	targets := make([]string, 0)
	for id, p := range state.Players {
		if id != excludeID && p.IsAlive {
			targets = append(targets, id)
		}
	}
	if len(targets) > 0 {
		return targets[rand.Intn(len(targets))]
	}
	return ""
}

func (m *Typing99Match) sendPrivateUpdate(dispatcher runtime.MatchDispatcher, player *PlayerState, logger runtime.Logger) {
	// We create a specific payload for the private update
	payload := map[string]interface{}{
		"main_paragraph":   player.Paragraph,
		"main_offset":      player.Offset,
		"attack_paragraph": player.AttackBuffer,
		"attack_caret":     player.AttackCaret,
		"shield_paragraph": player.ShieldBuffer,
		"shield_caret":     player.ShieldCaret,
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

func (m *Typing99Match) updateStormSpeed(state *MatchState, logger runtime.Logger) {
	if state.Status != StatusPlaying {
		return
	}

	if state.TickCount >= state.NextLevelTick {
		state.StormLevel++
		state.NextLevelTick = state.TickCount + (30 * int64(state.TickRate)) // 30 second intervals
	}

	// Calculate Lobby SKill (Avg CPS)
	var totalCPS float64
	aliveCount := 0

	for _, p := range state.Players {
		if p.IsAlive {
			totalCPS += p.CurrentCPS
			aliveCount++
		}
	}

	avgCPS := 1.0
	if aliveCount > 0 {
		avgCPS = totalCPS / float64(aliveCount)
	}

	baseStep := 0.5 * math.Pow(1.2, float64(state.StormLevel-1))

	skillMultiplier := 1.0 + (avgCPS * 0.05)

	state.StormSpeed += (baseStep * skillMultiplier)

	logger.Info("SOTRM LEVEL UP!", "level", state.StormLevel, "new_speed", state.StormSpeed)

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

			cause := "the Storm"
			if p.LastAttackerID != "" {
				cause = p.LastAttackerID
			}

			feedMsg := map[string]string{
				"eliminated_username": p.Username,
				"killer_username":     cause,
			}
			feedData, _ := json.Marshal(feedMsg)
			dispatcher.BroadcastMessage(OpCodeElimination, feedData, nil, nil, true)
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

func generateGarbageChunk(length int) string {

	const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?"
	result := make([]byte, length)

	for i := 0; i < length; i++ {
		result[i] = symbols[rand.Intn(len(symbols))]
	}

	return string(result)
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
