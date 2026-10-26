package main

import (
	"context"
	"strings"

	"github.com/heroiclabs/nakama-common/api"
	"github.com/heroiclabs/nakama-common/runtime"
)

var errRankedLocked = runtime.NewError("link a Discord account or a verified email to play ranked", 7)

// canPlayRanked: Discord accounts and verified email accounts can play ranked.
// Guests and unverified email accounts are casual-only (unranked + private games).
func canPlayRanked(account *api.Account) bool {
	if strings.HasPrefix(account.CustomId, "discord:") {
		return true
	}
	return account.Email != "" && isEmailVerified(account)
}

// requireRanked guards anything ranked (matchmaking, leaderboard writes).
// The ranked matchmaker hook will call this once we build it.
func requireRanked(ctx context.Context, nk runtime.NakamaModule) error {
	userID := userIDFromCtx(ctx)
	if userID == "" {
		return errUnauthenticated
	}
	account, err := nk.AccountGetId(ctx, userID)
	if err != nil {
		return errInternal
	}
	if !canPlayRanked(account) {
		return errRankedLocked
	}
	return nil
}