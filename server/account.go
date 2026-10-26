package main

import (
	"context"
	"encoding/json"
	"time"

	"github.com/heroiclabs/nakama-common/api"
	"github.com/heroiclabs/nakama-common/runtime"
)

const (
	accountCollection = "account"
	accountStateKey   = "state"
	lastLoginThrottle = time.Hour
)

// accountState is private per-user data. The owner can read it; only the server writes it.
type accountState struct {
	LastLoginAt int64 `json:"last_login_at"`
}

func userIDFromCtx(ctx context.Context) string {
	id, _ := ctx.Value(runtime.RUNTIME_CTX_USER_ID).(string)
	return id
}

// touchLastLogin records the login time, at most once per lastLoginThrottle.
// Failures are logged and never block sign-in.
func touchLastLogin(ctx context.Context, logger runtime.Logger, nk runtime.NakamaModule, userID string) {
	objs, err := nk.StorageRead(ctx, []*runtime.StorageRead{
		{Collection: accountCollection, Key: accountStateKey, UserID: userID},
	})
	if err != nil {
		logger.Warn("touchLastLogin read failed for %s: %v", userID, err)
		return
	}

	var st accountState
	version := "*" // "*" = only write if the object doesn't exist yet
	if len(objs) > 0 {
		if err := json.Unmarshal([]byte(objs[0].Value), &st); err != nil {
			logger.Warn("touchLastLogin bad state for %s: %v", userID, err)
		}
		version = objs[0].Version
	}

	now := time.Now().Unix()
	if now-st.LastLoginAt < int64(lastLoginThrottle.Seconds()) {
		return
	}
	st.LastLoginAt = now

	b, _ := json.Marshal(st)
	if _, err := nk.StorageWrite(ctx, []*runtime.StorageWrite{{
		Collection: accountCollection,
		Key: accountStateKey,
		UserID: userID,
		Value: string(b),
		Version: version,
		PermissionRead: 1,
		PermissionWrite: 0,
	}}); err != nil {
		// A version conflict means another login wrote it at the same moment, which is fine.
		logger.Debug("touchLastLogin write skipped for %s: %v", userID, err)
	}
}

func isEmailVerified(account *api.Account) bool {
	var meta map[string]any
	_ = json.Unmarshal([]byte(account.User.Metadata), &meta)
	verified, _ := meta["email_verified"].(bool)
	return verified
}

// setEmailVerified stores the flag in account metadata, which clients can read
func setEmailVerified(ctx context.Context, nk runtime.NakamaModule, userID string, verified bool) error {
	account, err := nk.AccountGetId(ctx, userID)
	if err != nil {
		return err
	}

	meta := map[string]any {}
	_ = json.Unmarshal([]byte(account.User.Metadata), &meta)
	meta["email_verified"] = verified
	return nk.AccountUpdateId(ctx, userID, "", meta, "", "", "", "", "")
}