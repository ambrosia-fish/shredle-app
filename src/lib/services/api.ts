// src/lib/services/api.ts
import type { GameStateResponse, GuessRequest } from '../types/api';

const API_BASE_URL = 'https://shredle-api.herokuapp.com';

export async function getDailySolo(guessCount = 0): Promise<GameStateResponse> {
  const response = await fetch(`${API_BASE_URL}/api/game/daily?guessCount=${guessCount}`);
  
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  
  return await response.json();
}

export async function submitGuess(
  guess: string, 
  previousGuessCount = 0
): Promise<GameStateResponse> {
  const guessRequest: GuessRequest = {
    songGuess: guess
  };
  
  const response = await fetch(
    `${API_BASE_URL}/api/game/guess?previousGuessCount=${previousGuessCount}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(guessRequest)
    }
  );
  
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  
  return await response.json();
}