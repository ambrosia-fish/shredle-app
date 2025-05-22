import { PUBLIC_API_BASE_URL } from '$env/static/public';

const API_BASE = PUBLIC_API_BASE_URL || 'http://localhost:5000/api';

import type { Game, Solo, GuessRequest, GuessResponse } from './types';

export async function getDailyGame(): Promise<Game> {
  const response = await fetch(`${API_BASE}/game/daily`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch daily game');
  }
  
  return response.json();
}

export async function getSolo(id: number): Promise<Solo> {
  const response = await fetch(`${API_BASE}/solo/${id}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch solo');
  }
  
  return response.json();
}

export async function submitGuess(request: GuessRequest): Promise<GuessResponse> {
  const response = await fetch(`${API_BASE}/guess`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request)
  });
  
  if (!response.ok) {
    throw new Error('Failed to submit guess');
  }
  
  return response.json();
}