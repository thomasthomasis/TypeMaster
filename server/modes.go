package main

// gameMode describes one lobby size. Casual and ranked queues will both pick from these. Tune the number freely
type gameMode struct {
	ID string `json:"id"`
	Name string `json:"name"`
	MinPlayers int `json:"min_players"`
	MaxPlayers int `json:"max_players"`
}

var gameModes = map[string]gameMode{
	"duel": {ID: "duel", Name: "Duel", MinPlayers: 2, MaxPlayers: 2},
	"squad": {ID: "squad", Name: "Squad", MinPlayers: 3, MaxPlayers: 8},
	"royale": {ID: "royale", Name: "Royale", MinPlayers: 10, MaxPlayers: 99},
}