package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"strings"

	"github.com/heroiclabs/nakama-common/runtime"
)

var (
	errUnauthenticated = runtime.NewError("you must be signed in", 16)
	errBadInput        = runtime.NewError("invalid request", 3)
	errInternal        = runtime.NewError("something went wrong", 13)
	errNoEmail         = runtime.NewError("this account has no email address", 9)
	errAlreadyVerified = runtime.NewError("email is already verified", 9)
	errWeakPassword    = runtime.NewError("password must be at least 8 characters", 3)
)

const okResponse = `{"ok":true}`

// --- Signed-in RPCs ---

func rpcVerifyEmail(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	userID := userIDFromCtx(ctx)
	if userID == "" {
		return "", errUnauthenticated
	}
	var req struct {
		Code string `json:"code"`
	}
	if err := json.Unmarshal([]byte(payload), &req); err != nil || req.Code == "" {
		return "", errBadInput
	}
	if err := consumeCode(ctx, nk, userID, purposeVerify, strings.TrimSpace(req.Code)); err != nil {
		return "", err
	}
	if err := setEmailVerified(ctx, nk, userID, true); err != nil {
		logger.Error("could not set email_verified for %s: %v", userID, err)
		return "", errInternal
	}
	return okResponse, nil
}

func rpcResendVerification(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	userID := userIDFromCtx(ctx)
	if userID == "" {
		return "", errUnauthenticated
	}
	account, err := nk.AccountGetId(ctx, userID)
	if err != nil {
		return "", errInternal
	}
	if account.Email == "" {
		return "", errNoEmail
	}
	if isEmailVerified(account) {
		return "", errAlreadyVerified
	}
	code, err := issueCode(ctx, nk, userID, purposeVerify)
	if err != nil {
		return "", err // includes the cooldown error, which the client shows
	}
	if err := sendVerificationEmail(account.Email, code); err != nil {
		logger.Error("could not send verification email to %s: %v", userID, err)
		return "", errInternal
	}
	return okResponse, nil
}

// --- Public RPCs (called signed-out with the runtime HTTP key) ---

func findUserIDByEmail(ctx context.Context, db *sql.DB, email string) (string, error) {
	var id string
	err := db.QueryRowContext(ctx, "SELECT id FROM users WHERE email = $1", email).Scan(&id)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return id, err
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// rpcRequestPasswordReset always returns ok, so it can't be used to find out
// which emails have accounts.
func rpcRequestPasswordReset(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	var req struct {
		Email string `json:"email"`
	}
	if err := json.Unmarshal([]byte(payload), &req); err != nil || req.Email == "" {
		return "", errBadInput
	}
	email := normalizeEmail(req.Email)

	userID, err := findUserIDByEmail(ctx, db, email)
	if err != nil {
		logger.Error("password reset lookup failed: %v", err)
		return okResponse, nil
	}
	if userID == "" {
		return okResponse, nil
	}
	code, err := issueCode(ctx, nk, userID, purposeReset)
	if err != nil {
		return okResponse, nil // cooldown or storage error: stay silent
	}
	if err := sendPasswordResetEmail(email, code); err != nil {
		logger.Error("could not send reset email to %s: %v", userID, err)
	}
	return okResponse, nil
}

func rpcResetPassword(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	var req struct {
		Email    string `json:"email"`
		Code     string `json:"code"`
		Password string `json:"password"`
	}
	if err := json.Unmarshal([]byte(payload), &req); err != nil || req.Email == "" || req.Code == "" {
		return "", errBadInput
	}
	if len(req.Password) < 8 {
		return "", errWeakPassword
	}
	email := normalizeEmail(req.Email)

	userID, err := findUserIDByEmail(ctx, db, email)
	if err != nil || userID == "" {
		return "", errCodeInvalid
	}
	if err := consumeCode(ctx, nk, userID, purposeReset, strings.TrimSpace(req.Code)); err != nil {
		return "", err
	}
	// Re-linking the same email replaces the password hash.
	if err := nk.LinkEmail(ctx, userID, email, req.Password); err != nil {
		logger.Error("could not update password for %s: %v", userID, err)
		return "", errInternal
	}
	// Receiving the code proves they own the inbox.
	if err := setEmailVerified(ctx, nk, userID, true); err != nil {
		logger.Warn("could not set email_verified for %s: %v", userID, err)
	}
	// Sign out every existing session for this account.
	if err := nk.SessionLogout(userID, "", ""); err != nil {
		logger.Warn("could not revoke sessions for %s: %v", userID, err)
	}
	return okResponse, nil
}