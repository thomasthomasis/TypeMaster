package main

import (
	"context"
	"database/sql"
	"time"

	"github.com/heroiclabs/nakama-common/api"
	"github.com/heroiclabs/nakama-common/runtime"
)

func InitModule(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, initializer runtime.Initializer) error {

	if err := initializer.RegisterEventSessionStart(func(ctx context.Context, logger runtime.Logger, evt *api.Event) {
		logger.Info("User %s has joined the server.", evt.Properties["user_id"])
	}); err != nil {
		return err
	}

	if err := initializer.RegisterAfterAuthenticateCustom(AfterAuthCustom); err != nil {
		return err
	}

	if err := initializer.RegisterAfterAuthenticateEmail(AfterAuthEmail); err != nil {
		return err
	}

	if err := initializer.RegisterAfterLinkEmail(AfterLinkEmailHook); err != nil {
		return err
	}

	if err := initializer.RegisterBeforeRt("MatchmakerAdd", BeforeMatchmakerAddHook); err != nil {
		return err
	}

	// Register the matchmaker hook
	if err := initializer.RegisterMatchmakerMatched(rpcMatchmakerMatched); err != nil {
		return err
	}

	// Register the match handler
	if err := initializer.RegisterMatch(moduleName, func(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule) (runtime.Match, error) {
		return &Typing99Match{}, nil
	}); err != nil {
		return err
	}

	if err := initializer.RegisterRpc("verify_email_code", VerifyEmailCodeRPC); err != nil {
		return nil
	}

	if err := initializer.RegisterRpc("exchange_discord_code", rpcExchangeDiscordCode); err != nil {
		logger.Error("Unable to reigster rpc: %v", err)
		return err
	}

	// Leaderboards (Ranked Mode)
	// Setup seasonal or global rankings.
	if err := InitLeaderboards(ctx, nk, logger); err != nil {
		return err
	}

	go func() {
		// Run every 24 hours
		// Cron format: "min hour day month dayOfWeek"
		cronExpression := "0 0 * * *"

		for {
			// Calculate the next time this should run
			nextRunTime, err := nk.CronNext(cronExpression, time.Now().Unix())
			if err != nil {
				logger.Error("Cron expression error: %v", err)
				return
			}

			// Wait until that time
			waitTime := time.Until(time.Unix(nextRunTime, 0))
			logger.Info("Guest cleanup scheduled for: %v", time.Unix(nextRunTime, 0))

			select {
			case <-ctx.Done():
				return // Exit if server shuts down
			case <-time.After(waitTime):
				// RUN THE CLEANUP
				runGuestCleanup(context.Background(), logger, db)
			}
		}
	}()

	logger.Info("Typing 99 match registered")
	return nil
}

func runGuestCleanup(ctx context.Context, logger runtime.Logger, db *sql.DB) {
	logger.Info("Starting daily guest account cleanup...")
	query := `
        DELETE FROM users 
        WHERE email = '' 
          AND google_id = '' 
          AND apple_id = '' 
          AND update_time < now() - interval '30 days'`

	result, err := db.ExecContext(ctx, query)
	if err != nil {
		logger.Error("Failed to clean up guest accounts: %v", err)
		return
	}
	rows, _ := result.RowsAffected()
	logger.Info("Cleanup finished. Deleted %d dead guest accounts.", rows)
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
