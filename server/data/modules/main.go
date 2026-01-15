package main

import (
	"context"
	"database/sql"

	"github.com/heroiclabs/nakama-common/runtime"
)

func InitModule(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, initializer runtime.Initializer) error {
	logger.Info("Typing 99 server module loaded!")

	// Register the matchmaker hook
	if err := initializer.RegisterMatchmakerMatched(rpcMatchmakerMatched); err != nil {
		return err
	}

	// Register the match handler
	if err := initializer.RegisterMatch(moduleName, func(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule) (runtime.Match, error) {
		return &Typing99Match{}, nil
	}); err != nil {
		logger.Error("Failed to register match", "error", err)
		return err
	}

	logger.Info("Typing 99 match registered")

	return nil
}

func rpcMatchmakerMatched(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, entries []runtime.MatchmakerEntry) (string, error) {
	// Extract the intended player count from the first entry
	// This assumes all players in the match searched for the same count

	params := map[string]interface{}{
		"matched_entries": entries,
	}

	matchId, err := nk.MatchCreate(ctx, moduleName, params)
	if err != nil {
		logger.Error("Failed to create match from matchmaker: %v", err)
		return "", err
	}

	return matchId, nil
}
