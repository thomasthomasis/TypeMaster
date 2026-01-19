import { create } from 'zustand';

interface GameState {
  health: number;
  wpm: number;
  stormPosition: number;
  stormDps: number,
  stormSpeed: number,
  isDead: boolean;
  matchTime: number,
  updateWpm: (newWpm: number) => void;
  takeDamage: (amount: number) => void;
  advanceStorm: (amount: number) => void;
  advanceMatch: () => void;
}

export const useGameStore = create<GameState>((set) => ({
    health: 100,
    wpm: 0,
    stormPosition: 0,
    stormDps: 0.5,
    stormSpeed: 0.05,
    isDead: false,
    matchTime: 0,
    
    updateWpm: (newWpm:number) => set({ wpm: newWpm }),

    takeDamage: (amount) => set((state) => {
        const newHealth = Math.max(0, state.health - amount);
        return { 
        health: newHealth, 
        isDead: newHealth === 0,
        lastDamageAmount: amount 
        };
    }),

    advanceStorm: (amount:number) => set((state) => ({
        stormPosition: state.stormPosition + amount
    })),

    advanceMatch: () => set((state) => {
        const newTime = state.matchTime + 1;
        // Scale difficulty every 10 seconds
        const difficultyMultiplier = Math.floor(newTime / 10);
        return {
        matchTime: newTime,
        stormDps: 2 + (difficultyMultiplier * 0.5),
        stormSpeed: 0.05 + (difficultyMultiplier * 0.01)
        };
    }),
}));