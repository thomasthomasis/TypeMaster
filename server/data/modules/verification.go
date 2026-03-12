package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"math/big"
	"net/smtp"

	"github.com/heroiclabs/nakama-common/runtime"
)

// generateVerificationToken creates a cryptographically secure random token
func genearteVerificationCode() (string, error) {

	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("%06d", n.Int64()), nil
}

// VerificationData matches what we store in Nakama storage
type VerificationData struct {
	Code     string `json:"code"`
	Email    string `json:"email"`
	Verified bool   `json:"verified"`
}

// VerifyEmailRPC is called by the client after the user clicks the verification link
// Expected payload: {"token":"abc123","user_id":"xyz"}
func VerifyEmailCodeRPC(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	userID := ctx.Value(runtime.RUNTIME_CTX_USER_ID).(string)

	var input struct {
		Code string `json:"code"`
	}
	if err := json.Unmarshal([]byte(payload), &input); err != nil {
		return "", runtime.NewError("Invalid payload", 3)
	}

	records, err := nk.StorageRead(ctx, []*runtime.StorageRead{
		{
			Collection: "email_verification",
			Key:        "code_data",
			UserID:     userID,
		},
	})

	if err != nil || len(records) == 0 {
		return "", runtime.NewError("Verification request not found", 5)
	}

	var data VerificationData
	json.Unmarshal([]byte(records[0].Value), &data)

	if data.Verified {
		return `{"success": true, "message":"Already verified"}`, nil
	}

	// Compare Code
	if data.Code != input.Code {
		return "", runtime.NewError("Invalid verification code", 7)
	}

	// Update Status
	data.Verified = true
	val, _ := json.Marshal(data)
	nk.StorageWrite(ctx, []*runtime.StorageWrite{
		{
			Collection: "email_verification",
			Key:        "code_data",
			UserID:     userID,
			Value:      string(val),
		},
	})

	// Update internal Nakama user flag
	_, err = db.ExecContext(ctx, "UPDATE users SET email_verified = true WHERE id = $1", userID)

	profile, _ := GetProfile(ctx, nk, userID)
	profile.EmailVerified = true
	SaveProfile(ctx, nk, userID, profile)

	return `{"success": true}`, nil
}

func sendToMailHog(to string, code string) error {
	// MailHog SMTP details
	host := "mailhog" // Service name in docker-compose
	port := "1025"

	msg := []byte("To: " + to + "\r\n" +
		"Subject: Your Typing 99 Code!\r\n" +
		"\r\n" +
		"Welcome! Your 6-digit verification code is: " + code + "\r\n")

	return smtp.SendMail(host+":"+port, nil, "noreply@typing99.com", []string{to}, msg)
}
