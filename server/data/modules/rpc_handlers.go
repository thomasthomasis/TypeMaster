package main

import (
	"context"
	"database/sql"

	"github.com/heroiclabs/nakama-common/runtime"
)

func RpcCreatePrivateGame(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	// Generate a 4-digit join code
	joinCode := "XY12"

	// Create a match instance specifically with a "private" label
	params := map[string]interface{}{
		"private": true,
		"code":    joinCode,
	}

	matchId, err := nk.MatchCreate(ctx, "typing_royale", params)
	if err != nil {
		return "", err
	}

	return matchId, nil // Return ID so the user can invite friends
}
