package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"time"

	"github.com/heroiclabs/nakama-common/runtime"
)

const (
	codeCollection = "auth_codes"
	purposeVerify = "email_verify"
	purposeReset = "password_reset"
	codeTTL = 15 * time.Minute
	codeMaxAttempts = 5
	codeResendCooldown = 60 * time.Second
)

var (
	errCodeInvalid = runtime.NewError("invalid or expired code", 3)
	errCodeCooldown = runtime.NewError("please wait a minute before requesting another code", 8)
)

type oneTimeCode struct {
	Hash string `json:"hash"`
	ExpiresAt int64 `json:"expires_at"`
	SentAt int64 `json:"sent_at"`
	Attempts int `json:"attempts"`
}

func hashCode(userID, code string) string {
	sum := sha256.Sum256([]byte(userID + ":" + code))
	return hex.EncodeToString(sum[:])
}

func generateCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func readCode(ctx context.Context, nk runtime.NakamaModule, userID, purpose string) (*oneTimeCode, string, error) {
	objs, err := nk.StorageRead(ctx, []*runtime.StorageRead{
		{Collection: codeCollection, Key: purpose, UserID: userID},
	})
	if err != nil || len(objs) == 0 {
		return nil, "", err
	}
	var c oneTimeCode
	if err := json.Unmarshal([]byte(objs[0].Value), &c); err != nil {
		return nil, "", err
	}
	return &c, objs[0].Version, nil
}

// writeCode stores a code that only the server can read or write.
// version "" writes unconditionally; otherwise the write fails if the object changed.
func writeCode(ctx context.Context, nk runtime.NakamaModule, userID, purpose string, c *oneTimeCode, version string) error {
	b, err := json.Marshal(c)
	if err != nil {
		return err
	}

	_, err = nk.StorageWrite(ctx, []*runtime.StorageWrite{{
		Collection: codeCollection,
		Key: purpose,
		UserID: userID,
		Value: string(b),
		Version: version,
		PermissionRead: 0,
		PermissionWrite: 0,
	}})
	return err
}

// issueCode creates a fesh code (replacing any old one) and returns it in plain text.
func issueCode(ctx context.Context, nk runtime.NakamaModule, userID, purpose string) (string, error) {
	existing, _, err := readCode(ctx, nk, userID, purpose)
	if err != nil {
		return "", err
	}

	now := time.Now()
	if existing != nil && now.Sub(time.Unix(existing.SentAt, 0)) < codeResendCooldown {
		return "", errCodeCooldown
	}
	code, err := generateCode()
	if err != nil {
		return "", err
	}

	c := & oneTimeCode{
		Hash: hashCode(userID, code),
		ExpiresAt: now.Add(codeTTL).Unix(),
		SentAt: now.Unix(),
	}

	return code, writeCode(ctx, nk, userID, purpose, c, "")
}

// consumeCode checks a code and deletes in on success. Wrong guesses count towards codeMaxAttempts, after which the code stops working.
func consumeCode(ctx context.Context, nk runtime.NakamaModule, userID, purpose, code string) error {
	c, version, err := readCode(ctx, nk, userID, purpose)
	if err != nil {
		return err
	}

	if c == nil || time.Now().Unix() > c.ExpiresAt || c.Attempts >= codeMaxAttempts {
		return errCodeInvalid
	}

	if subtle.ConstantTimeCompare([]byte(c.Hash), []byte(hashCode(userID, code))) != 1 {
		c.Attempts++
		_ = writeCode(ctx, nk, userID, purpose, c, version)
		return errCodeInvalid
	}

	// The version check means two simultaneous correct guesses can't both succeed.
	if err := nk.StorageDelete(ctx, []*runtime.StorageDelete{
		{Collection: codeCollection, Key: purpose, UserID: userID, Version: version},
	}); err != nil {
		return errCodeInvalid
	}

	return nil
}