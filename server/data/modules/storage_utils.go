package main

import (
	"context"
	"encoding/json"
	"time"

	"github.com/heroiclabs/nakama-common/runtime"
)

// 1. Define the "Source of Truth" for a Player's Profile
type PlayerProfile struct {
	UserID         string `json:"user_id"`
	CreatedAt      int64  `json:"created_at"`
	LastLoginAt    int64  `json:"last_login_at"`
	AccountAgeDays int    `json:"account_age_days"`
	EmailVerified  bool   `json:"-"`

	// --- Time & Persistence ---
	TotalPlayTimeSeconds int64 `json:"total_play_time_sec"`

	// --- Basic Account Info ---
	Coins           int     `json:"coins"`
	PremiumCurrency int     `json:"gems"`
	TotalGames      int     `json:"total_games"`
	TotalWins       int     `json:"total_wins"`
	Top3Finishes    int     `json:"top_3_finishes"`
	MaxCPS          float64 `json:"max_cps"`
	RankPoints      int     `json:"rank_points"`
	AccountLevel    int     `json:"account_level"`
	TotalExperience int     `json:"total_xp"`
	EquippedSkin    string  `json:"equipped_skin"`

	// --- Aggregate Typing Stats ---
	LifetimeMaxCPS     float64 `json:"lifetime_max_cps"`
	LifetimeAvgCPS     float64 `json:"lifetime_avg_cps"`
	LifetimeAccuracy   float64 `json:"lifetime_accuracy"`
	LifetimeCharsTyped int64   `json:"lifetime_chars_typed"`
	LifetimeWordsTyped int64   `json:"lifetime_words_typed"`

	// --- Battle Roayle Specific ---
	TotalGarbageSent    int64 `json:"total_garbage_sent"`
	TotalGarbageBlocked int64 `json:"total_garbage_blocked"`
	TotalKOs            int   `json:"total_kos"`
	TotalStreamSwitches int   `json:"total_stream_switches"`

	// --- Streak Data ---
	CurrentWinStreak int `json:"current_win_streak"`
	MaxWinStreak     int `json:"max_win_streak"`
}

// 2. Helper: Fetch a Profile
func GetProfile(ctx context.Context, nk runtime.NakamaModule, userID string) (*PlayerProfile, error) {

	records, err := nk.StorageRead(ctx, []*runtime.StorageRead{
		{
			Collection: "player_data",
			Key:        "profile",
			UserID:     userID,
		},
	})
	if err != nil {
		return nil, err
	}

	if len(records) > 0 {
		var profile PlayerProfile
		if err := json.Unmarshal([]byte(records[0].Value), &profile); err != nil {
			return nil, err
		}

		profile.UpdateAge()
		profile.LastLoginAt = time.Now().Unix()
		return &profile, nil
	}

	account, err := nk.AccountGetId(ctx, userID)
	if err != nil {
		return nil, err
	}

	profile := &PlayerProfile{
		UserID:           userID,
		CreatedAt:        account.User.CreateTime.Seconds,
		Coins:            100,
		RankPoints:       500,
		EquippedSkin:     "default_white",
		LifetimeAvgCPS:   0.0,
		CurrentWinStreak: 0,
	}

	return profile, nil
}

// 3. Helper: Save a Profile
func SaveProfile(ctx context.Context, nk runtime.NakamaModule, userID string, profile *PlayerProfile) error {
	value, err := json.Marshal(profile)
	if err != nil {
		return err
	}

	_, err = nk.StorageWrite(ctx, []*runtime.StorageWrite{
		{
			Collection:      "player_data",
			Key:             "profile",
			UserID:          userID,
			Value:           string(value),
			PermissionRead:  1, // Owner can read
			PermissionWrite: 0, // Server authority ONLY (Anti-cheat)
		},
	})
	return err
}

func (p *PlayerProfile) UpdateAge() {
	now := time.Now().Unix()
	diff := now - p.CreatedAt
	p.AccountAgeDays = int(diff / 86400)
}
