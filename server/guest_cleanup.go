package main

import (
	"context"
	"database/sql"
	"strconv"
	"time"

	"github.com/heroiclabs/nakama-common/runtime"
)

const (
	cleanupInterval   = 24 * time.Hour
	cleanupBatchSize  = 500
	cleanupMaxBatches = 20 // at most 10,000 deletions per run
)

// A guest is an account whose only sign-in is a plain device ID: no email,
// no custom ID (Discord), no social IDs, and no 3.41 provider identities
// (those live in user_device with a non-empty provider). Last activity is
// last_login_at from our account/state object, or create_time if it's missing.
const inactiveGuestsQuery = `
SELECT u.id
FROM users u
LEFT JOIN storage s
  ON s.user_id = u.id AND s.collection = 'account' AND s.key = 'state'
WHERE u.id <> '00000000-0000-0000-0000-000000000000'
  AND EXISTS (SELECT 1 FROM user_device d WHERE d.user_id = u.id AND d.provider = '')
  AND NOT EXISTS (SELECT 1 FROM user_device d WHERE d.user_id = u.id AND d.provider <> '')
  AND COALESCE(u.email, '') = ''
  AND COALESCE(u.custom_id, '') = ''
  AND COALESCE(u.google_id, '') = ''
  AND COALESCE(u.apple_id, '') = ''
  AND COALESCE(u.facebook_id, '') = ''
  AND COALESCE(u.facebook_instant_game_id, '') = ''
  AND COALESCE(u.gamecenter_id, '') = ''
  AND COALESCE(u.steam_id, '') = ''
  AND COALESCE(to_timestamp((s.value->>'last_login_at')::bigint), u.create_time)
      < now() - make_interval(days => $1)
ORDER BY u.create_time
LIMIT $2`

// startGuestCleanup runs the cleanup a minute after startup, then once a day.
func startGuestCleanup(logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule) {
	days, err := strconv.Atoi(cfg.GuestInactiveDays)
	if err != nil || days < 0 {
		days = 30
	}
	dryRun := cfg.GuestCleanupDryRun != "false" // anything but "false" is a dry run

	go func() {
		time.Sleep(time.Minute) // let the server finish starting up
		for {
			runGuestCleanup(context.Background(), logger, db, nk, days, dryRun)
			time.Sleep(cleanupInterval)
		}
	}()
}

func findInactiveGuests(ctx context.Context, db *sql.DB, days, limit int) ([]string, error) {
	rows, err := db.QueryContext(ctx, inactiveGuestsQuery, days, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func runGuestCleanup(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, days int, dryRun bool) {
	deleted, failed := 0, 0

	for batch := 0; batch < cleanupMaxBatches; batch++ {
		ids, err := findInactiveGuests(ctx, db, days, cleanupBatchSize)
		if err != nil {
			logger.Error("guest cleanup query failed: %v", err)
			return
		}

		if dryRun {
			logger.Info("guest cleanup DRY RUN: %d guest(s) inactive for %d+ days would be deleted (max %d shown per run). First few: %v",
				len(ids), days, cleanupBatchSize, ids[:min(len(ids), 10)])
			return
		}

		deletedThisBatch := 0
		for _, id := range ids {
			// AccountDeleteId also removes storage, leaderboard records, friends and groups.
			if err := nk.AccountDeleteId(ctx, id, false); err != nil {
				failed++
				logger.Warn("guest cleanup could not delete %s: %v", id, err)
				continue
			}
			deleted++
			deletedThisBatch++
		}

		// Stop when there's nothing left, or when every delete failed
		// (the same rows would just come back again).
		if len(ids) < cleanupBatchSize || deletedThisBatch == 0 {
			break
		}
	}

	logger.Info("guest cleanup finished: deleted %d, failed %d (inactive for %d+ days)", deleted, failed, days)
}