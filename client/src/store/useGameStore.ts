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
  heal: (amount: number) => void;
  advanceStorm: () => void;
  advanceMatch: () => void;
}

const INITIAL_DELAY = 5; // seconds before storm starts
const INITIAL_STORM_SPEED = 100; // words per second
const FIXED_DPS = 5;
const SPEED_INCREASE_INTERVAL = 10;
const SPEED_INCREASE = 25;

export const useGameStore = create<GameState>((set) => ({
    health: 100,
    wpm: 0,
    stormPosition: 0,
    stormDps: FIXED_DPS,
    stormSpeed: INITIAL_STORM_SPEED,
    isDead: false,
    matchTime: 0,
    
    updateWpm: (newWpm:number) => set({ wpm: newWpm }),

    takeDamage: (amount) => set((state) => {
        const newHealth = Math.max(0, state.health - amount);
        return { 
            health: newHealth, 
            isDead: newHealth <= 0,
        };
    }),

    heal: (amount: number) => set((state) => ({
        health: Math.min(100, state.health + amount)
    })),

    advanceStorm: () => set((state) => {
        if (state.matchTime < INITIAL_DELAY) {
            return state; // Return same state, no re-render
        }

        const charsPerTick = state.stormSpeed / 60 / 10;
        const newPosition = state.stormPosition + charsPerTick;

        // Only update if position actually changed meaningfully
        if (Math.abs(newPosition - state.stormPosition) < 0.001) {
            return state;
        }
        return { stormPosition: newPosition };
    }),

    advanceMatch: () => set((state) => {
        const newMatchTime = state.matchTime + 1;

        console.log('Match Time:', newMatchTime);
        console.log('Time after delay:', newMatchTime - INITIAL_DELAY);
        console.log('Should increase speed?', newMatchTime > INITIAL_DELAY && (newMatchTime - INITIAL_DELAY) % SPEED_INCREASE_INTERVAL === 0);
        
        // Check if we should increase storm speed (every 10 seconds after delay)
        if (newMatchTime > INITIAL_DELAY && (newMatchTime - INITIAL_DELAY) % SPEED_INCREASE_INTERVAL === 0) {
            const newStormSpeed = state.stormSpeed + SPEED_INCREASE;

            console.log('INCREASING SPEED from', state.stormSpeed, 'to', newStormSpeed);
            
            return {
                matchTime: newMatchTime,
                stormSpeed: newStormSpeed
            };
        }

        return {
            matchTime: newMatchTime,
        };
    }),
}));