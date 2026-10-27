package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"math/big"
	"strings"

	"github.com/heroiclabs/nakama-common/runtime"
)

// No 0/O or 1/I/L, so codes are easy to read out loud.
const joinCodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
const joinCodeLength = 6

var (
	errBadMode      = runtime.NewError("unknown game mode", 3)
	errNoMatch      = runtime.NewError("no open match with that code", 5)
	errCreateFailed = runtime.NewError("could not create the match, please try again", 13)
)

func generateJoinCode() string {
	b := make([]byte, joinCodeLength)
	for i := range b {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(joinCodeAlphabet))))
		b[i] = joinCodeAlphabet[n.Int64()]
	}
	return string(b)
}

func findMatchByCode(ctx context.Context, nk runtime.NakamaModule, code string) (string, error) {
	matches, err := nk.MatchList(ctx, 1, true, "", nil, nil, "+label.code:"+code)
	if err != nil || len(matches) == 0 {
		return "", err
	}
	return matches[0].MatchId, nil
}

// rpcCreatePrivateMatch creates a lobby. The caller then joins it over the socket
// and becomes host because they're first in.
func rpcCreatePrivateMatch(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	if userIDFromCtx(ctx) == "" {
		return "", errUnauthenticated
	}
	var req struct {
		Mode string `json:"mode"`
	}
	if err := json.Unmarshal([]byte(payload), &req); err != nil {
		return "", errBadInput
	}
	if _, ok := gameModes[req.Mode]; !ok {
		return "", errBadMode
	}

	// Codes are random, but check for the rare clash with a live match.
	code := ""
	for range 5 {
		c := generateJoinCode()
		if existing, err := findMatchByCode(ctx, nk, c); err == nil && existing == "" {
			code = c
			break
		}
	}
	if code == "" {
		return "", errCreateFailed
	}

	matchID, err := nk.MatchCreate(ctx, matchModule, map[string]interface{}{
		"mode":    req.Mode,
		"private": true,
		"code":    code,
	})
	if err != nil {
		logger.Error("could not create match: %v", err)
		return "", errCreateFailed
	}
	b, _ := json.Marshal(map[string]string{"match_id": matchID, "code": code})
	return string(b), nil
}

func rpcFindPrivateMatch(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	if userIDFromCtx(ctx) == "" {
		return "", errUnauthenticated
	}
	var req struct {
		Code string `json:"code"`
	}
	if err := json.Unmarshal([]byte(payload), &req); err != nil {
		return "", errBadInput
	}
	code := strings.ToUpper(strings.TrimSpace(req.Code))
	if len(code) != joinCodeLength || strings.Trim(code, joinCodeAlphabet) != "" {
		return "", errNoMatch
	}
	matchID, err := findMatchByCode(ctx, nk, code)
	if err != nil || matchID == "" {
		return "", errNoMatch
	}
	b, _ := json.Marshal(map[string]string{"match_id": matchID})
	return string(b), nil
}