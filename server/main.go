package main

import (
	"context"
	"database/sql"

	"github.com/heroiclabs/nakama-common/runtime"
)

type config struct {
	SMTPHost, SMTPPort, SMTPFrom, SMTPUser, SMTPPass         string
	DiscordClientID, DiscordClientSecret, DiscordRedirectURI string
	GuestInactiveDays, GuestCleanupDryRun string
	DevMode string
}

var cfg config

func InitModule(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, initializer runtime.Initializer) error {
	
	env, _ := ctx.Value(runtime.RUNTIME_CTX_ENV).(map[string]string)
	cfg = config{
		SMTPHost:            env["SMTP_HOST"],
		SMTPPort:            env["SMTP_PORT"],
		SMTPFrom:            env["SMTP_FROM"],
		SMTPUser:            env["SMTP_USER"],
		SMTPPass:            env["SMTP_PASS"],
		DiscordClientID:     env["DISCORD_CLIENT_ID"],
		DiscordClientSecret: env["DISCORD_CLIENT_SECRET"],
		DiscordRedirectURI:  env["DISCORD_REDIRECT_URI"],
		GuestInactiveDays:   env["GUEST_INACTIVE_DAYS"],
		GuestCleanupDryRun:  env["GUEST_CLEANUP_DRY_RUN"],
		DevMode: 			 env["DEV_MODE"],
	}

	// Auth hooks
	if err := initializer.RegisterBeforeAuthenticateDevice(beforeAuthDevice); err != nil {
		return err
	}
	if err := initializer.RegisterBeforeAuthenticateEmail(beforeAuthEmail); err != nil {
		return err
	}
	if err := initializer.RegisterBeforeUpdateAccount(beforeUpdateAccount); err != nil {
		return err
	}
	if err := initializer.RegisterAfterAuthenticateDevice(afterAuthDevice); err != nil {
		return err
	}
	if err := initializer.RegisterAfterAuthenticateEmail(afterAuthEmail); err != nil {
		return err
	}
	if err := initializer.RegisterBeforeAuthenticateCustom(beforeAuthDiscord); err != nil {
		return err
	}
	if err := initializer.RegisterAfterAuthenticateCustom(afterAuthCustom); err != nil {
		return err
	}
	if err := initializer.RegisterAfterSessionRefresh(afterSessionRefresh); err != nil {
		return err
	}
	if err := initializer.RegisterAfterLinkEmail(afterLinkEmail); err != nil {
		return err
	}
	if err := initializer.RegisterBeforeLinkCustom(beforeLinkDiscord); err != nil {
		return err
	}

	// Auth RPCs
	if err := initializer.RegisterRpc("verify_email", rpcVerifyEmail); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("resend_verification", rpcResendVerification); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("request_password_reset", rpcRequestPasswordReset); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("reset_password", rpcResetPassword); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("set_username", rpcSetUsername); err != nil {
		return err
	}
	// Matches
	if err := initializer.RegisterMatch(matchModule, newTypingMatch); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("create_private_match", rpcCreatePrivateMatch); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("find_private_match", rpcFindPrivateMatch); err != nil {
		return err
	}

	ensureUsernameIndex(ctx, logger, db)

	startGuestCleanup(logger, db, nk)
	logger.Info("TypeMaster module loaded")
	return nil
}