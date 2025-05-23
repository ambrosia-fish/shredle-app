<script lang="ts">
  import { onMount } from 'svelte';
  import { afterNavigate } from '$app/navigation';
  import { page } from '$app/stores';
  import { isSpotifyLoggedIn, loginToSpotify, handleSpotifyCallback, initializeSpotifyPlayer } from '$lib/spotify';
  import { getSpotifyErrorMessage, activatePlayerForMobile } from '$lib/spotify-utils';
  import { playTrackSegment, transferPlaybackToDevice } from '$lib/spotify-playback';
  import { getDailyGame, getSolo, submitGuess } from '$lib/api';
  import type { Game, Solo } from '$lib/types';
  
  // Game state variables
  let spotifyLoggedIn = false;
  let gameStatus: 'loading' | 'playing' | 'won' | 'lost' | 'error' = 'loading';
  let currentGame: Game | null = null;
  let currentSolo: Solo | null = null;
  let currentAttempt = 1;
  let guesses: string[] = [];
  let player: any = null;
  let deviceId = '';
  let errorMessage = '';
  let playingClipNumber = 0; // Track which specific clip is playing (0 = none)
  let isInitialized = false;
  let isProcessingCallback = false;
  
  // UI state variables
  let tickerMessage = '';
  let tickerIsHint = false;
  let tickerIsNewHint = false;
  let guessStates: ('active' | 'locked' | 'pending')[] = ['active', 'pending', 'pending', 'pending'];
  let currentGuessInputs: string[] = ['', '', '', ''];
  let isSubmittingGuess = false;
  
  // Track which hints have been shown and the most recent hint
  let sh