// src/lib/services/api.ts
import type { GameStateResponse, GuessRequest } from '../types/api';

// Update API base URL to point to local development server
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5130';

export async function getDailySolo(guessCount = 0): Promise<GameStateResponse> {
  console.log(`Fetching daily solo from: ${API_BASE_URL}/api/game/daily`);
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/game/daily?guessCount=${guessCount}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error response:', response.status, errorText);
      throw new Error(`API error: ${response.status} - ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching daily solo:', error);
    throw error;
  }
}

export async function submitGuess(
  guess: string, 
  previousGuessCount = 0
): Promise<GameStateResponse> {
  const guessRequest: GuessRequest = {
    songGuess: guess
  };
  
  console.log(`Submitting guess to: ${API_BASE_URL}/api/game/guess`);
  
  try {
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
      const errorText = await response.text();
      console.error('API error response:', response.status, errorText);
      throw new Error(`API error: ${response.status} - ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error submitting guess:', error);
    throw error;
  }
}