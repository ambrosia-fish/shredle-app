<script lang="ts">
  import { onMount } from 'svelte';
  import { afterNavigate } from '$app/navigation';
  import { page } from '$app/stores';
  import { isSpotifyLoggedIn, loginToSpotify, handleSpotifyCallback, initializeSpotifyPlayer } from '$lib/spotify';
  import { getSpotifyErrorMessage, activatePlayerForMobile } from '$lib/spotify-utils';
  import { getDailyGame, getSolo, submitGuess } from '$lib/api';
  import type { Game, Solo } from '$lib/types';
  
  // Game state variables
  let spotifyLoggedIn = false;
  let gameStatus: 'loading' | 'playing' | 'won' | 'lost' | 'error' = 'loading';
  let currentGame: Game | null = null;
  let currentSolo: Solo | null = null;
  let currentAttempt = 1;
  let guesses: string[] = [];
  let currentGuess = '';
  let player: any = null;
  let errorMessage = '';
  
  // Handle Spotify callback and login check
  async function checkAuthAndLoadGame() {
    try {
      // Handle Spotify callback if code is present
      if ($page.url.searchParams.has('code')) {
        await handleSpotifyCallback();
      }
      
      // Check login status
      spotifyLoggedIn = isSpotifyLoggedIn();
      
      // Load game if logged in
      if (spotifyLoggedIn) {
        await loadGame();
      }
    } catch (error) {
      console.error('Auth/Load error:', error);
      errorMessage = getSpotifyErrorMessage(error instanceof Error ? error.message : String(error));
      gameStatus = 'error';
    }
  }
  
  // This runs after every navigation (including initial load and redirects)
  afterNavigate(async () => {
    await checkAuthAndLoadGame();
  });
  
  // Also run on initial mount for direct visits
  onMount(async () => {
    await checkAuthAndLoadGame();
  });
  
  async function loadGame() {
    try {
      gameStatus = 'loading';
      errorMessage = '';
      
      // Load game data
      currentGame = await getDailyGame();
      currentSolo = await getSolo(currentGame.soloId);
      
      // Initialize Spotify player
      console.log('Initializing Spotify player...');
      player = await initializeSpotifyPlayer();
      
      gameStatus = 'playing';
    } catch (error) {
      console.error('Failed to load game:', error);
      errorMessage = getSpotifyErrorMessage(error instanceof Error ? error.message : String(error));
      gameStatus = 'error';
    }
  }
  
  async function handleGuess() {
    if (!currentGame || !currentSolo || !currentGuess.trim()) return;
    
    try {
      const response = await submitGuess({
        gameId: currentGame.id,
        soloId: currentSolo.id,
        guess: currentGuess.trim(),
        attempt: currentAttempt
      });
      
      guesses = [...guesses, currentGuess.trim()];
      currentGuess = '';
      
      if (response.correct) {
        gameStatus = 'won';
      } else if (currentAttempt >= 4) {
        gameStatus = 'lost';
      } else {
        currentAttempt++;
      }
    } catch (error) {
      console.error('Failed to submit guess:', error);
      errorMessage = 'Failed to submit guess. Please try again.';
    }
  }
  
  async function playClip(clipNumber: number) {
    if (!player) {
      console.error('No player available');
      return;
    }
    
    try {
      // Activate player for mobile browsers on user interaction
      await activatePlayerForMobile(player);
      
      // TODO: Implement clip playback
      console.log(`Playing clip ${clipNumber}`);
    } catch (error) {
      console.error('Failed to play clip:', error);
      errorMessage = 'Failed to play audio clip. Please try again.';
    }
  }
  
  function getHintText(): string {
    if (currentAttempt === 1) return '';
    if (currentAttempt === 2) return `Guitarist: ${currentSolo?.guitarist}`;
    if (currentAttempt === 3) return `Artist: ${currentSolo?.artist}`;
    if (currentAttempt === 4) return `Hint: ${currentSolo?.hint}`;
    return '';
  }

  function clearError() {
    errorMessage = '';
  }
</script>

<main>
  {#if !spotifyLoggedIn}
    <!-- Login Screen -->
    <div class="login-screen">
      <h1>Welcome to Shredle!</h1>
      <p>Guess the guitar solo in 4 tries</p>
      <p class="premium-note">⭐ Spotify Premium required</p>
      <button on:click={loginToSpotify}>Login with Spotify</button>
    </div>
    
  {:else if gameStatus === 'loading'}
    <!-- Loading Screen -->
    <div class="loading-screen">
      <p>Loading today's challenge...</p>
      <div class="loading-spinner"></div>
    </div>
    
  {:else if gameStatus === 'error'}
    <!-- Error Screen -->
    <div class="error-screen">
      <h2>Oops! Something went wrong</h2>
      <p class="error-message">{errorMessage}</p>
      <div class="error-actions">
        <button on:click={loadGame} class="retry-btn">Try Again</button>
        <button on:click={() => { spotifyLoggedIn = false; localStorage.removeItem('spotify_access_token'); }} class="logout-btn">
          Login Again
        </button>
      </div>
    </div>
    
  {:else if gameStatus === 'playing'}
    <!-- Game Screen -->
    <div class="game-screen">
      <h1>Daily Shredle</h1>
      
      {#if errorMessage}
        <div class="error-banner">
          <span>{errorMessage}</span>
          <button on:click={clearError} class="close-error">×</button>
        </div>
      {/if}
      
      <!-- Play Buttons -->
      <div class="play-buttons">
        {#each Array(4) as _, i}
          <button 
            on:click={() => playClip(i + 1)}
            disabled={i + 1 > currentAttempt}
            class:active={i + 1 <= currentAttempt}
          >
            Play Clip {i + 1}
          </button>
        {/each}
      </div>
      
      <!-- Guess Form -->
      <div class="guess-form">
        <input 
          bind:value={currentGuess}
          placeholder="Enter your guess..."
          on:keydown={(e) => e.key === 'Enter' && handleGuess()}
        />
        <button on:click={handleGuess} disabled={!currentGuess.trim()}>
          Submit Guess ({currentAttempt}/4)
        </button>
      </div>
      
      <!-- Hint Display -->
      {#if getHintText()}
        <div class="hint">
          {getHintText()}
        </div>
      {/if}
      
      <!-- Previous Guesses -->
      {#if guesses.length > 0}
        <div class="guesses">
          <h3>Previous Guesses:</h3>
          {#each guesses as guess}
            <p>❌ {guess}</p>
          {/each}
        </div>
      {/if}
    </div>
    
  {:else if gameStatus === 'won'}
    <!-- Win Screen -->
    <div class="win-screen">
      <h1>🎉 Congratulations!</h1>
      <p>You guessed it in {guesses.length} tries!</p>
      <p><strong>{currentSolo?.title}</strong> by <strong>{currentSolo?.artist}</strong></p>
      <button>Share Your Result</button>
    </div>
    
  {:else if gameStatus === 'lost'}
    <!-- Loss Screen -->
    <div class="loss-screen">
      <h1>😔 Better luck tomorrow!</h1>
      <p>The answer was:</p>
      <p><strong>{currentSolo?.title}</strong> by <strong>{currentSolo?.artist}</strong></p>
      <button>Share Your Result</button>
    </div>
  {/if}
</main>

<style>
  main {
    max-width: 600px;
    margin: 0 auto;
    padding: 2rem;
    text-align: center;
    font-family: Arial, sans-serif;
  }
  
  .login-screen, .loading-screen, .win-screen, .loss-screen, .error-screen {
    padding: 3rem 1rem;
  }
  
  .premium-note {
    color: #666;
    font-size: 0.9rem;
    margin: 0.5rem 0;
  }
  
  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #1db954;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 1rem auto;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .error-screen {
    background: #f8f8f8;
    border-radius: 12px;
    border: 2px solid #ff6b6b;
  }
  
  .error-message {
    color: #d63031;
    margin: 1rem 0;
    font-weight: 500;
  }
  
  .error-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
  }
  
  .retry-btn, .logout-btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1rem;
  }
  
  .retry-btn {
    background: #1db954;
    color: white;
  }
  
  .logout-btn {
    background: #666;
    color: white;
  }
  
  .error-banner {
    background: #ffe6e6;
    border: 1px solid #ff6b6b;
    border-radius: 8px;
    padding: 1rem;
    margin: 1rem 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .close-error {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #d63031;
  }
  
  .login-screen button {
    background: #1db954;
    color: white;
    border: none;
    padding: 1rem 2rem;
    border-radius: 50px;
    font-size: 1rem;
    cursor: pointer;
    margin-top: 1rem;
  }
  
  .login-screen button:hover {
    background: #1ed760;
  }
  
  .play-buttons {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin: 2rem 0;
    flex-wrap: wrap;
  }
  
  .play-buttons button {
    padding: 1rem;
    border: 2px solid #ddd;
    background: #f5f5f5;
    color: #666;
    border-radius: 8px;
    cursor: not-allowed;
    font-size: 0.9rem;
    min-width: 100px;
  }
  
  .play-buttons button.active {
    background: #1db954;
    color: white;
    border-color: #1db954;
    cursor: pointer;
  }
  
  .play-buttons button.active:hover {
    background: #1ed760;
  }
  
  .guess-form {
    margin: 2rem 0;
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
  }
  
  .guess-form input {
    padding: 0.75rem;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-size: 1rem;
    min-width: 200px;
  }
  
  .guess-form button {
    padding: 0.75rem 1.5rem;
    background: #1db954;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1rem;
  }
  
  .guess-form button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
  
  .guess-form button:not(:disabled):hover {
    background: #1ed760;
  }
  
  .hint {
    margin: 1rem 0;
    padding: 1rem;
    background: #f0f8ff;
    border-radius: 8px;
    font-weight: bold;
    color: #333;
  }
  
  .guesses {
    margin-top: 2rem;
    text-align: left;
    max-width: 300px;
    margin-left: auto;
    margin-right: auto;
  }
  
  .guesses h3 {
    text-align: center;
    margin-bottom: 1rem;
  }
  
  .win-screen, .loss-screen {
    background: #f9f9f9;
    border-radius: 12px;
    margin: 2rem 0;
  }
  
  .win-screen {
    border: 3px solid #1db954;
  }
  
  .loss-screen {
    border: 3px solid #ff6b6b;
  }
</style>
