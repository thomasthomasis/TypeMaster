package main

import (
	"context"
	"database/sql"

	"github.com/heroiclabs/nakama-common/api"
	"github.com/heroiclabs/nakama-common/runtime"
)

func afterAuthDevice(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, out *api.Session, in *api.AuthenticateDeviceRequest) error {
	touchLastLogin(ctx, logger, nk, userIDFromCtx(ctx))
	return nil
}

func afterAuthCustom(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, out *api.Session, in *api.AuthenticateCustomRequest) error {
	touchLastLogin(ctx, logger, nk, userIDFromCtx(ctx))
	return nil
}

func afterSessionRefresh(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, out *api.Session, in *api.SessionRefreshRequest) error {
	touchLastLogin(ctx, logger, nk, userIDFromCtx(ctx))
	return nil
}

func afterAuthEmail(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, out *api.Session, in *api.AuthenticateEmailRequest) error {
	userID := userIDFromCtx(ctx)
	touchLastLogin(ctx, logger, nk, userID)
	if out.Created {
		startEmailVerification(ctx, logger, nk, userID, in.Account.Email)
	}
	return nil
}

// A guest (or anyone) linking a new email has to verify it.
func afterLinkEmail(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, in *api.AccountEmail) error {
	userID := userIDFromCtx(ctx)
	if err := setEmailVerified(ctx, nk, userID, false); err != nil {
		logger.Error("could not reset email_verified for %s: %v", userID, err)
	}
	startEmailVerification(ctx, logger, nk, userID, in.Email)
	return nil
}

// startEmailVerification issues a code and emails it. Failures are only logged:
// the account still works and the player can press "resend".
func startEmailVerification(ctx context.Context, logger runtime.Logger, nk runtime.NakamaModule, userID, email string) {
	code, err := issueCode(ctx, nk, userID, purposeVerify)
	if err != nil {
		logger.Error("could not issue verification code for %s: %v", userID, err)
		return
	}
	if err := sendVerificationEmail(email, code); err != nil {
		logger.Error("could not send verification email to %s: %v", userID, err)
	}
}