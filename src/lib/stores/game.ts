// src/lib/stores/game.ts
import { writable, derived } from 'svelte/store';
import type { GameStateResponse, SoloResponse } from '../types/api';

// Initial game state
const initialGameState: GameStateResponse = {
  date: '',
  currentSolo: {
    id: 0,
    spotifyId: '',
    soloStartTimeMs: 0,
    soloEndTimeMs: 0,
    clipDurationMs: 3000,
    isCorrect: false,
    guessCount: 0,
    revealGuitarist: false,
    revealHint: false
  },
  isComplete: false,
  attemptsRemaining: 4
};

// Create the game store
export const gameState = writable<GameStateResponse>(initialGameState);

// Derived stores for convenience
export const currentSolo = derived(
  gameState,
  $gameState => $gameState.currentSolo
);

export const attemptsRemaining = derived(
  gameState,
  $gameState => $gameState.attemptsRemaining
);

export const isGameComplete = derived(
  gameState,
  $gameState => $gameState.isComplete
);

// Actions to update game state
export function updateGameState(newState: GameStateResponse) {
  gameState.set(newState);
}

export function incrementGuessCount() {
  gameState.update(state => {
    const solo = { ...state.currentSolo, guessCount: state.currentSolo.guessCount + 1 };
    return { ...state, currentSolo: solo, attemptsRemaining: state.attemptsRemaining - 1 };
  });
}

export function resetGameState() {
  gameState.set(initialGameState);
}