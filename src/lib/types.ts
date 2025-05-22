export interface Game {
  id: string;           
  date: string;         
  soloId: number;       
}

export interface Solo {
  id: number;
  title: string;
  artist: string;
  spotifyId: string;
  startTimeClip1: number;
  endTimeClip1: number;
  startTimeClip2: number;
  endTimeClip2: number;
  startTimeClip3: number;
  endTimeClip3: number;
  startTimeClip4: number;
  endTimeClip4: number;
  guitarist: string;
  hint: string;
}

export interface GuessRequest {
  gameId: string;
  soloId: number;
  guess: string;
  attempt: number;
}

export interface GuessResponse {
  correct: boolean;
  attempt: number;
}