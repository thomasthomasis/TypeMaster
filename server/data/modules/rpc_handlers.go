package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/heroiclabs/nakama-common/runtime"
)

type DiscordExchangePayload struct {
	Code     string `json:"code"`
	Verifier string `json:"verifier"`
}

func RpcCreatePrivateGame(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	// Generate a 4-digit join code
	joinCode := "XY12"

	// Create a match instance specifically with a "private" label
	params := map[string]interface{}{
		"private": true,
		"code":    joinCode,
	}

	matchId, err := nk.MatchCreate(ctx, "typing_royale", params)
	if err != nil {
		return "", err
	}

	return matchId, nil // Return ID so the user can invite friends
}

func rpcExchangeDiscordCode(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {

	logger.Info("RPC_START: exchange_discord_code received payload: %s", payload)

	var input DiscordExchangePayload
	if err := json.Unmarshal([]byte(payload), &input); err != nil {
		return "", runtime.NewError("invalid payload", 3) // Invalid Argument
	}

	// 1. Get secrets from environment
	clientId := os.Getenv("DISCORD_CLIENT_ID")
	clientSecret := os.Getenv("DISCORD_CLIENT_SECRET")
	redirectUri := "http://localhost:5173/auth/callback"

	if clientId == "" || clientSecret == "" {
		logger.Error("RPC_ERROR: Missing Discord secrets in environment!")
		return "", runtime.NewError("missing_secrets", 13)
	}

	// 2. Exchange Code + Verifier for Discord Token
	logger.Info("DISCORD_AUTH: Exchanging code for token...")
	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("code", input.Code)
	data.Set("redirect_uri", redirectUri)
	data.Set("code_verifier", input.Verifier)
	data.Set("client_id", clientId)
	data.Set("client_secret", clientSecret)

	// We use standard http client because nk.HttpReq is for simple JSON usually
	// Discord requires application/x-www-form-urlencoded
	resp, err := http.Post("https://discord.com/api/oauth2/token", "application/x-www-form-urlencoded", strings.NewReader(data.Encode()))
	if err != nil {
		logger.Error("DISCORD_ERROR: Post request failed: %v", err)
		return "", runtime.NewError("failed to contact discord", 13) // Internal
	}
	defer resp.Body.Close()

	var tokenData map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&tokenData); err != nil {
		logger.Error("DISCORD_ERROR: Failed to decode token response: %v", err)
		return "", runtime.NewError("failed to decode discord token", 13)
	}

	accessToken, ok := tokenData["access_token"].(string)
	if !ok {
		logger.Error("Discord token exchange failed: %v", tokenData)
		return "", runtime.NewError("discord_unauthorized", 16)
	}

	// 3. Get Discord User ID
	logger.Info("DISCORD_USER: Fetching @me profile...")
	req, _ := http.NewRequest("GET", "https://discord.com/api/users/@me", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	userResp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", runtime.NewError("failed to get discord user", 13)
	}
	defer userResp.Body.Close()

	var discordUser map[string]interface{}
	json.NewDecoder(userResp.Body).Decode(&discordUser)

	discordId, _ := discordUser["id"].(string)
	username, _ := discordUser["username"].(string)

	// 4. Authenticate in Nakama (using Custom ID as slot)
	logger.Info("NAKAMA_AUTH: Authenticating custom ID: discord:%s", discordId)
	currentUserId, hasContextUser := ctx.Value(runtime.RUNTIME_CTX_USER_ID).(string)
	customId := "discord:" + discordId

	if hasContextUser && currentUserId != "" {
		logger.Info("NAKAMA_LINK: Attempting to link Discord ID %s to current User %s", discordId, currentUserId)

		// LinkCustom attaches the 'discord:123' ID to the guest's Nakama account
		err := nk.LinkCustom(ctx, currentUserId, customId)
		if err != nil {
			// Error 10 (AlreadyExists) means this Discord is already linked to ANOTHER user.
			// We log it, but proceed with AuthenticateCustom so they can still log in to that other account.
			logger.Warn("NAKAMA_LINK_WARN: Discord ID already linked to another account: %v", err)
		} else {
			logger.Info("NAKAMA_LINK_SUCCESS: Guest account %s now linked to Discord %s", currentUserId, discordId)
		}
	}

	userId, username, created, err := nk.AuthenticateCustom(ctx, customId, username, true)
	if err != nil {
		logger.Error("Nakama AuthenticateCustom error: %v", err)
		return "", runtime.NewError("nakama auth failed", 13)
	}

	// 5. Build the Session Token manuall (Standard Nakama Go way)
	// The arguments are: context, userID, username, vars (nil), expire (0 for default)
	token, exp, err := nk.AuthenticateTokenGenerate(userId, username, 0, nil)
	if err != nil {
		// FALLBACK: If your version uses SessionCreate instead:
		// token, exp, err = nk.SessionCreate(ctx, userId, username, nil, 0, true, nil)
		logger.Error("Token generation error: %v", err)
		return "", runtime.NewError("token_generation_failed", 13)
	}

	logger.Info("RPC_SUCCESS: User %s authenticated (Created: %v)", username, created)

	res, _ := json.Marshal(map[string]interface{}{
		"token":   token,
		"exp":     exp,
		"created": created,
	})

	return string(res), nil
}
