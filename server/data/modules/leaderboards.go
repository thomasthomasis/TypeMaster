package main

import (
	"context"

	"github.com/heroiclabs/nakama-common/runtime"
)

func InitLeaderboards(ctx context.Context, nk runtime.NakamaModule, logger runtime.Logger) error {
	id := "weekly_ranked_season"
	authoritative := true
	sortOrder := "desc"  // Higher CPS is better
	operator := "best"   // Keep the player's best score of the week
	reset := "0 0 * * 1" // Cron format: Reset every Monday at midnight

	return nk.LeaderboardCreate(ctx, id, authoritative, sortOrder, operator, reset, nil)
}
