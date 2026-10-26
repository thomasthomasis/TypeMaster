package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"regexp"
	"strings"
	"time"

	"github.com/heroiclabs/nakama-common/api"
	"github.com/heroiclabs/nakama-common/runtime"
)

const usernameChangeCooldown = 7 * 24 * time.Hour

var (
	usernamePattern   = regexp.MustCompile(`^[A-Za-z0-9_]{3,16}$`)
	reservedUsernames = map[string]bool{
		"admin": true, "administrator": true, "system": true, "server": true,
		"mod": true, "moderator": true, "support": true, "staff": true,
		"typemaster": true, "guest": true, "null": true, "undefined": true,
	}

	errBadUsername      = runtime.NewError("usernames are 3-16 letters, numbers or underscores", 3)
	errUsernameTaken    = runtime.NewError("that username is taken", 6)
	errUsernameCooldown = runtime.NewError("you can only change your username once every 7 days", 8)
	errNameViaRPC       = runtime.NewError("use set_username to change your name", 7)
)

// ensureUsernameIndex makes the case-insensitive uniqueness check fast.
func ensureUsernameIndex(ctx context.Context, logger runtime.Logger, db *sql.DB) {
	if _, err := db.ExecContext(ctx,
		"CREATE INDEX IF NOT EXISTS users_username_lower_idx ON users (lower(username))"); err != nil {
		logger.Warn("could not create username index: %v", err)
	}
}

func readMetadata(account *api.Account) map[string]any {
	meta := map[string]any{}
	_ = json.Unmarshal([]byte(account.User.Metadata), &meta)
	return meta
}

func rpcSetUsername(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	userID := userIDFromCtx(ctx)
	if userID == "" {
		return "", errUnauthenticated
	}
	var req struct {
		Username string `json:"username"`
	}
	if err := json.Unmarshal([]byte(payload), &req); err != nil {
		return "", errBadInput
	}
	name := strings.TrimSpace(req.Username)
	if !usernamePattern.MatchString(name) {
		return "", errBadUsername
	}
	if reservedUsernames[strings.ToLower(name)] {
		return "", errUsernameTaken
	}

	account, err := nk.AccountGetId(ctx, userID)
	if err != nil {
		return "", errInternal
	}
	meta := readMetadata(account)

	// The first pick is free; after that, one change per cooldown period.
	if set, _ := meta["username_set"].(bool); set {
		if last, ok := meta["username_changed_at"].(float64); ok &&
			time.Since(time.Unix(int64(last), 0)) < usernameChangeCooldown {
			return "", errUsernameCooldown
		}
	}

	// Nakama's own unique constraint is case-sensitive, so also block "Bob" when "bob" exists.
	var taken bool
	if err := db.QueryRowContext(ctx,
		"SELECT EXISTS (SELECT 1 FROM users WHERE lower(username) = lower($1) AND id <> $2)",
		name, userID).Scan(&taken); err != nil {
		logger.Error("username lookup failed: %v", err)
		return "", errInternal
	}
	if taken {
		return "", errUsernameTaken
	}

	meta["username_set"] = true
	meta["username_changed_at"] = time.Now().Unix()
	// The display name follows the username so there's only one name in the game.
	if err := nk.AccountUpdateId(ctx, userID, name, meta, name, "", "", "", ""); err != nil {
		if strings.Contains(err.Error(), "already in use") {
			return "", errUsernameTaken
		}
		logger.Error("could not set username for %s: %v", userID, err)
		return "", errInternal
	}
	return okResponse, nil
}

// Clients could otherwise rename themselves with updateAccount and skip our rules.
func beforeUpdateAccount(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, in *api.UpdateAccountRequest) (*api.UpdateAccountRequest, error) {
	if in.Username != nil || in.DisplayName != nil {
		return nil, errNameViaRPC
	}
	return in, nil
}

// Ignore any username sent at sign-up: Nakama generates a random one and the
// player picks a real one with set_username. (Discord's hook already does this.)
func beforeAuthDevice(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, in *api.AuthenticateDeviceRequest) (*api.AuthenticateDeviceRequest, error) {
	in.Username = ""
	return in, nil
}

func beforeAuthEmail(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, in *api.AuthenticateEmailRequest) (*api.AuthenticateEmailRequest, error) {
	in.Username = ""
	return in, nil
}