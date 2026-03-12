package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/heroiclabs/nakama-common/api"
	"github.com/heroiclabs/nakama-common/rtapi"
	"github.com/heroiclabs/nakama-common/runtime"
)

func BeforeMatchmakerAddHook(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, in *rtapi.Envelope) (*rtapi.Envelope, error) {
	// 1. Get the real UserID
	userID := ctx.Value(runtime.RUNTIME_CTX_USER_ID).(string)

	// 2. Access the MatchmakerAdd message inside the Envelope
	msg := in.GetMatchmakerAdd()
	if msg == nil {
		return in, nil
	}

	// 3. Fetch the player's true Rank from our Storage Utility
	profile, err := GetProfile(ctx, nk, userID)
	if err != nil {
		logger.Error("Matchmaker error fetching profile: %v", err)
		return nil, runtime.NewError("Could not verify rank", 13)
	}

	// 4. Force the "rank" property.
	// This makes sure they are matched with players of similar skill.
	if msg.NumericProperties == nil {
		msg.NumericProperties = make(map[string]float64)
	}
	msg.NumericProperties["rank"] = float64(profile.RankPoints)

	logger.Info("User %s entering queue with Rank: %v", userID, profile.RankPoints)

	return in, nil
}

// 1. The actual logic (Internal)
func handleAfterAuth(ctx context.Context, logger runtime.Logger, nk runtime.NakamaModule, out *api.Session, isEmail bool, email string) error {
	if !out.Created {
		return nil
	}

	userID := ctx.Value(runtime.RUNTIME_CTX_USER_ID).(string)

	initialProfile := &PlayerProfile{
		UserID:    userID,
		CreatedAt: time.Now().Unix(),
		Coins:     100,
	}

	if isEmail {
		initialProfile.RankPoints = 500

		if err := sendEmailVerification(ctx, nk, logger, userID, email); err != nil {
			logger.Error("Failed to send verification email for user %s: %v", userID, err)
		}

	} else {
		initialProfile.RankPoints = 0
	}

	return SaveProfile(ctx, nk, userID, initialProfile)
}

// 2. The Email Wrapper (Matches RegisterAfterAuthenticateEmail signature)
func AfterAuthEmail(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, out *api.Session, in *api.AuthenticateEmailRequest) error {
	return handleAfterAuth(ctx, logger, nk, out, true, in.Account.Email)
}

// 3. The Custom Wrapper (Matches RegisterAfterAuthenticateCustom signature)
func AfterAuthCustom(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, out *api.Session, in *api.AuthenticateCustomRequest) error {
	return handleAfterAuth(ctx, logger, nk, out, false, "")
}

func AfterLinkEmailHook(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, in *api.AccountEmail) error {
	userID := ctx.Value(runtime.RUNTIME_CTX_USER_ID).(string)

	profile, err := GetProfile(ctx, nk, userID)
	if err != nil {
		return err
	}

	profile.Coins += 500

	sendEmailVerification(ctx, nk, logger, userID, in.Email)

	return SaveProfile(ctx, nk, userID, profile)
}

// sendEmailVerification generates a token, stores it, and sends the email
func sendEmailVerification(ctx context.Context, nk runtime.NakamaModule, logger runtime.Logger, userID string, email string) error {

	// Generate a unique token
	code, err := genearteVerificationCode()
	if err != nil {
		return fmt.Errorf("failed to generate token: %w", err)
	}

	data := VerificationData{
		Code:     code,
		Email:    email,
		Verified: false,
	}
	value, _ := json.Marshal(data)

	_, err = nk.StorageWrite(ctx, []*runtime.StorageWrite{
		{
			Collection:      "email_verification",
			Key:             "code_data",
			UserID:          userID,
			Value:           string(value),
			PermissionRead:  0,
			PermissionWrite: 0,
		},
	})

	// Log it so we can see it in MailHog
	logger.Info("Sending code [%s] to email [%s]", code, email)

	// In a real scenario, you'd user your SMTP logic here to send the code
	if err := sendToMailHog(email, code); err != nil {
		logger.Error("MailHog send failed: %v", err)
	}

	return nil

}
