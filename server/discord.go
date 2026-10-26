package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/heroiclabs/nakama-common/api"
	"github.com/heroiclabs/nakama-common/runtime"
)

var (
	errDiscordNotConfigured = runtime.NewError("Discord sign-in is not configured", 12)
	errDiscordFailed        = runtime.NewError("Discord sign-in failed, please try again", 16)
	httpClient              = &http.Client{Timeout: 10 * time.Second}
)

type discordUser struct {
	ID         string `json:"id"`
	Username   string `json:"username"`
	GlobalName string `json:"global_name"`
}

// exchangeDiscordCode turns an OAuth code from the client into a verified Discord user.
func exchangeDiscordCode(ctx context.Context, code string) (*discordUser, error) {
	if cfg.DiscordClientID == "" || cfg.DiscordClientSecret == "" {
		return nil, errDiscordNotConfigured
	}

	form := url.Values{
		"grant_type":   {"authorization_code"},
		"code":         {code},
		"redirect_uri": {cfg.DiscordRedirectURI},
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://discord.com/api/oauth2/token", strings.NewReader(form.Encode()))
	req.SetBasicAuth(cfg.DiscordClientID, cfg.DiscordClientSecret)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, errDiscordFailed
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, errDiscordFailed
	}
	var tok struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tok); err != nil || tok.AccessToken == "" {
		return nil, errDiscordFailed
	}

	req, _ = http.NewRequestWithContext(ctx, http.MethodGet, "https://discord.com/api/users/@me", nil)
	req.Header.Set("Authorization", "Bearer "+tok.AccessToken)
	resp, err = httpClient.Do(req)
	if err != nil {
		return nil, errDiscordFailed
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, errDiscordFailed
	}
	var u discordUser
	if err := json.NewDecoder(resp.Body).Decode(&u); err != nil || u.ID == "" {
		return nil, errDiscordFailed
	}
	return &u, nil
}

// beforeAuthDiscord: the client sends the Discord OAuth code as the custom ID.
// Every custom auth goes through this, so nobody can sign in with a raw "discord:<id>".
func beforeAuthDiscord(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, in *api.AuthenticateCustomRequest) (*api.AuthenticateCustomRequest, error) {
	if in.Account == nil || in.Account.Id == "" {
		return nil, errDiscordFailed
	}
	du, err := exchangeDiscordCode(ctx, in.Account.Id)
	if err != nil {
		logger.Warn("discord code exchange failed: %v", err)
		return nil, err
	}

	customID := "discord:" + du.ID
	userID, _, created, err := nk.AuthenticateCustom(ctx, customID, "", true)
	if err != nil {
		logger.Error("discord account lookup failed: %v", err)
		return nil, errDiscordFailed
	}
	if created {
		name := du.GlobalName
		if name == "" {
			name = du.Username
		}
		if err := nk.AccountUpdateId(ctx, userID, "", nil, name, "", "", "", ""); err != nil {
			logger.Warn("could not set display name for %s: %v", userID, err)
		}
	}

	// The account now exists, so Nakama just signs in to it and issues the session.
	in.Account.Id = customID
	in.Username = ""
	return in, nil
}

// beforeLinkDiscord lets a signed-in player (e.g. a guest) attach their Discord account.
func beforeLinkDiscord(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, in *api.AccountCustom) (*api.AccountCustom, error) {
	if in.Id == "" {
		return nil, errDiscordFailed
	}
	du, err := exchangeDiscordCode(ctx, in.Id)
	if err != nil {
		logger.Warn("discord code exchange failed: %v", err)
		return nil, err
	}
	in.Id = "discord:" + du.ID
	return in, nil
}