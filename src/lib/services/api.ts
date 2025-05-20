// src/lib/services/api.ts
import type { GameStateResponse, GuessRequest } from '../types/api';

// Update API base URL to point to local development server
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5130';

export async function getDailySolo(guessCount = 0): Promise<GameStateResponse> {
  console.log(`Fetching daily solo from: ${API_BASE_URL}/api/game/daily`);
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/game/daily?guessCount=${guessCount}`);
    
    if (!response.ok) {
      let errorMessage = `API error: ${response.status} - ${response.statusText}`;
      
      try {
        // Try to get a more detailed error message from the response
        const errorData = await response.json();
        if (errorData && errorData.message) {
          errorMessage = errorData.message;
        }
      } catch (e) {
        // Failed to parse JSON, just use the status message
        console.error('Could not parse error response:', e);
      }
      
      console.error('API error response:', response.status, errorMessage);
      throw new Error(errorMessage);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching daily solo:', error);
    
    // Check if it's a network error (likely when backend is not running)
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('Could not connect to the game server. Please try again later.');
    }
    
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
      let errorMessage = `API error: ${response.status} - ${response.statusText}`;
      
      try {
        // Try to get a more detailed error message from the response
        const errorData = await response.json();
        if (errorData && errorData.message) {
          errorMessage = errorData.message;
        }
      } catch (e) {
        // Failed to parse JSON, just use the status message
        console.error('Could not parse error response:', e);
      }
      
      console.error('API error response:', response.status, errorMessage);
      throw new Error(errorMessage);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error submitting guess:', error);
    
    // Check if it's a network error (likely when backend is not running)
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('Could not connect to the game server. Please try again later.');
    }
    
    throw error;
  }
}