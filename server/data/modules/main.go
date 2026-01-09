package main

import (
	"context"
	"database/sql"

	"github.com/heroiclabs/nakama-common/runtime"
)

func InitModule(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, initializer runtime.Initializer) error {
	logger.Info("Typing 99 server module loaded!")

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
