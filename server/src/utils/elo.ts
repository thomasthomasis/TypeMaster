export function calculateEloChange(
    winnerElo: number,
    loserElo: number,
    kFactor: number = 32
) : { winnerNew: number; loserNew: number } {
    
    const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo)/ 400));
    const expectedLoser = 1 - expectedWinner;

    const winnerChange = Math.round(kFactor * (1 - expectedWinner));
    const loserChange = Math.round(kFactor * (0 - expectedLoser));

    return {
        winnerNew: winnerElo + winnerChange,
        loserNew: loserElo + loserChange
    };
}

export function getKFactor(gamesPlayed: number): number {
    if(gamesPlayed < 30) return 40; // New players
    if(gamesPlayed < 100) return 32; // Regular players

    return 24; // Experienced players
}