// src/lib/types/api.ts

export interface GameStateResponse {
  date: string;
  currentSolo: SoloResponse;
  isComplete: boolean;
  attemptsRemaining: number;
}

export interface SoloResponse {
  id: number;
  spotifyId: string;
  soloStartTimeMs: number;
  soloEndTimeMs: number;
  clipDurationMs: number;
  title?: string;
  artist?: string;
  guitarist?: string;
  aiHint?: string;
  isCorrect: boolean;
  guessCount: number;
  revealGuitarist: boolean;
  revealHint: boolean;
}

export interface GuessRequest {
  songGuess: string;
}