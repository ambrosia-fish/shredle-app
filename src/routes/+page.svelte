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
  let isPlaying = false;
  let isInitialized = false;
  let isProcessingCallback = false;
  
  // UI state variables
  let tickerMessage = '';
  let guessStates: ('active' | 'locked' | 'pending')[] = ['active', 'pending', 'pending', 'pending'];
  let currentGuessInputs: string[] = ['', '', '', ''];
  let isSubmittingGuess = false;
  
  // Ticker functionality
  let tickerInterval: number;
  
  function startTicker() {
    let showDate = true;
    function updateTicker() {
      if (showDate) {
        const today = new Date();
        tickerMessage = today.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      } else {
        const attemptsLeft = 4 - currentAttempt + 1;
        tickerMessage = `${attemptsLeft} attempts left`;
      }
      showDate = !showDate;
    }
    
    updateTicker();
    tickerInterval = setInterval(updateTicker, 3000);
  }
  
  function stopTicker() {
    if (tickerInterval) {
      clearInterval(tickerInterval);
    }
  }
  
  // Handle Spotify callback and login check
  async function checkAuthAndLoadGame() {
    try {
      // Prevent multiple simultaneous initializations
      if (isInitialized || isProcessingCallback) {
        return;
      }

      // Check if we're processing a Spotify callback
      if ($page.url.searchParams.has('code')) {
        isProcessingCallback = true;
        gameStatus = 'loading';
        errorMessage = ''; // Clear any previous errors
        
        console.log('Processing Spotify callback...');
        await handleSpotifyCallback();
        
        // Small delay to ensure token is stored
        await new Promise(resolve => setTimeout(resolve, 100));
        isProcessingCallback = false;
      }
      
      // Check login status
      spotifyLoggedIn = isSpotifyLoggedIn();
      
      // Load game if logged in
      if (spotifyLoggedIn) {
        await loadGame();
      }
      
      isInitialized = true;
    } catch (error) {
      console.error('Auth/Load error:', error);
      errorMessage = getSpotifyErrorMessage(error instanceof Error ? error.message : String(error));
      gameStatus = 'error';
      isProcessingCallback = false;
      isInitialized = true;
    }
  }
  
  // This runs after every navigation (including initial load and redirects)
  afterNavigate(async () => {
    // Reset initialization state on navigation
    isInitialized = false;
    await checkAuthAndLoadGame();
  });
  
  // Also run on initial mount for direct visits
  onMount(async () => {
    await checkAuthAndLoadGame();
  });
  
  async function loadGame() {
    try {
      gameStatus = 'loading';
      errorMessage = ''; // Clear errors when starting fresh
      
      console.log('Loading game data...');
      
      // Load game data
      currentGame = await getDailyGame();
      currentSolo = await getSolo(currentGame.soloId);
      
      // Initialize Spotify player
      console.log('Initializing Spotify player...');
      player = await initializeSpotifyPlayer();
      
      // Set up player event listeners to get device ID
      player.addListener('ready', ({ device_id }) => {
        console.log('Spotify player ready with device ID:', device_id);
        deviceId = device_id;
        // Transfer playback to our device
        transferPlaybackToDevice(device_id).catch(err => {
          console.warn('Failed to transfer playback:', err);
          // Don't show error to user as this is not critical
        });
      });
      
      gameStatus = 'playing';
      startTicker();
      console.log('Game loaded successfully');
    } catch (error) {
      console.error('Failed to load game:', error);
      errorMessage = getSpotifyErrorMessage(error instanceof Error ? error.message : String(error));
      gameStatus = 'error';
    }
  }
  
  async function handleGuess(attemptIndex: number) {
    if (!currentGame || !currentSolo || !currentGuessInputs[attemptIndex].trim() || isSubmittingGuess) return;
    
    try {
      isSubmittingGuess = true;
      
      console.log('Submitting guess:', currentGuessInputs[attemptIndex].trim());
      
      const response = await submitGuess({
        gameId: currentGame.id,
        soloId: currentSolo.id,
        guess: currentGuessInputs[attemptIndex].trim(),
        attempt: attemptIndex + 1
      });
      
      guesses[attemptIndex] = currentGuessInputs[attemptIndex].trim();
      guessStates[attemptIndex] = 'locked';
      
      if (response.correct) {
        gameStatus = 'won';
        stopTicker();
      } else if (attemptIndex >= 3) {
        gameStatus = 'lost';
        stopTicker();
      } else {
        // Unlock next guess component
        guessStates[attemptIndex + 1] = 'active';
        currentAttempt = attemptIndex + 2;
      }
    } catch (error) {
      console.error('Failed to submit guess:', error);
      errorMessage = 'Failed to submit guess. Please try again.';
    } finally {
      isSubmittingGuess = false;
    }
  }
  
  async function handleSkip(attemptIndex: number) {
    if (isSubmittingGuess) return;
    
    guessStates[attemptIndex] = 'locked';
    currentGuessInputs[attemptIndex] = 'Skipped';
    
    if (attemptIndex >= 3) {
      gameStatus = 'lost';
      stopTicker();
    } else {
      guessStates[attemptIndex + 1] = 'active';
      currentAttempt = attemptIndex + 2;
    }
  }
  
  async function playClip(clipNumber: number) {
    if (!player || !deviceId || !currentGame || isPlaying) {
      console.error('Cannot play clip: missing player, device ID, or game data');
      return;
    }
    
    try {
      isPlaying = true;
      errorMessage = ''; // Clear any previous errors
      
      console.log(`Fetching latest solo data for clip ${clipNumber}...`);
      
      // Fetch fresh solo data from server each time
      const freshSoloData = await getSolo(currentGame.soloId);
      
      // Update our current solo data with the fresh data
      currentSolo = freshSoloData;
      
      // Activate player for mobile browsers on user interaction
      await activatePlayerForMobile(player);
      
      // Get the appropriate clip timing based on clip number
      let startTime: number, endTime: number;
      
      switch (clipNumber) {
        case 1:
          startTime = freshSoloData.startTimeClip1;
          endTime = freshSoloData.endTimeClip1;
          break;
        case 2:
          startTime = freshSoloData.startTimeClip2;
          endTime = freshSoloData.endTimeClip2;
          break;
        case 3:
          startTime = freshSoloData.startTimeClip3;
          endTime = freshSoloData.endTimeClip3;
          break;
        case 4:
          startTime = freshSoloData.startTimeClip4;
          endTime = freshSoloData.endTimeClip4;
          break;
        default:
          throw new Error('Invalid clip number');
      }
      
      console.log(`Playing clip ${clipNumber}: ${startTime}s to ${endTime}s (track: ${freshSoloData.spotifyId})`);
      
      await playTrackSegment({
        deviceId,
        spotifyTrackId: freshSoloData.spotifyId,
        startTime,
        endTime
      });
      
      // Reset playing state after the clip duration
      const clipDuration = (endTime - startTime) * 1000;
      setTimeout(() => {
        isPlaying = false;
      }, clipDuration + 500); // Add small buffer
      
    } catch (error) {
      console.error('Failed to play clip:', error);
      if (error instanceof Error && error.message.includes('fetch')) {
        errorMessage = `Failed to load clip ${clipNumber} data. Please check your connection and try again.`;
      } else {
        errorMessage = `Failed to play clip ${clipNumber}. Make sure Spotify is active and try again.`;
      }
      isPlaying = false;
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

  function retry() {
    errorMessage = '';
    isInitialized = false;
    checkAuthAndLoadGame();
  }

  // Logout function
  function logout() {
    spotifyLoggedIn = false;
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_refresh_token');
    localStorage.removeItem('spotify_token_expires');
    isInitialized = false;
    gameStatus = 'loading';
    currentGame = null;
    currentSolo = null;
    currentAttempt = 1;
    guesses = [];
    currentGuessInputs = ['', '', '', ''];
    guessStates = ['active', 'pending', 'pending', 'pending'];
    player = null;
    deviceId = '';
    errorMessage = '';
    stopTicker();
  }

  // Handle Enter key for guess submission
  function handleKeydown(event: KeyboardEvent, attemptIndex: number) {
    if (event.key === 'Enter' && !isSubmittingGuess) {
      handleGuess(attemptIndex);
    }
  }
</script>

<main>
  {#if !spotifyLoggedIn && !isProcessingCallback}
    <!-- Login Screen -->
    <div class="login-screen">
      <h1>Welcome to Shredle!</h1>
      <p>Guess the guitar solo in 4 tries</p>
      <p class="premium-note">⚠ Spotify Premium required</p>
      <button on:click={loginToSpotify}>Login with Spotify</button>
    </div>
    
  {:else if gameStatus === 'loading' || isProcessingCallback}
    <!-- Loading Screen -->
    <div class="loading-screen">
      <p>
        {#if isProcessingCallback}
          Completing Spotify login...
        {:else}
          Loading today's challenge...
        {/if}
      </p>
      <div class="loading-spinner"></div>
    </div>
    
  {:else if gameStatus === 'error'}
    <!-- Error Screen -->
    <div class="error-screen">
      <h2>Oops! Something went wrong</h2>
      <p class="error-message">{errorMessage}</p>
      <div class="error-actions">
        <button on:click={retry} class="retry-btn">Try Again</button>
        <button on:click={() => { 
          spotifyLoggedIn = false; 
          localStorage.removeItem('spotify_access_token');
          isInitialized = false;
        }} class="logout-btn">
          Login Again
        </button>
      </div>
    </div>
    
  {:else if gameStatus === 'playing'}
    <!-- Game Screen -->
    <div class="game-screen">
      <!-- Header -->
      <div class="game-header">
        <button class="header-btn" disabled>ℹ️</button>
        <h1>Shredle</h1>
        <button class="header-btn" disabled>📊</button>
      </div>
      
      <!-- Ticker -->
      <div class="ticker">
        {tickerMessage}
      </div>
      
      {#if errorMessage}
        <div class="error-banner">
          <span>{errorMessage}</span>
          <button on:click={clearError} class="close-error">×</button>
        </div>
      {/if}
      
      <!-- Device Status -->
      {#if deviceId}
        <div class="device-status">
          🎵 Connected to Spotify Player
        </div>
      {:else}
        <div class="device-status connecting">
          🔄 Connecting to Spotify...
        </div>
      {/if}
      
      <!-- Guess Components -->
      <div class="guess-components">
        {#each Array(4) as _, i}
          <div class="guess-component">
            <!-- Play Button -->
            <button 
              class="play-btn"
              on:click={() => playClip(i + 1)}
              disabled={isPlaying || !deviceId}
              class:playing={isPlaying}
              class:enabled={!isPlaying && deviceId}
            >
              {#if isPlaying}
                🎵 Playing...
              {:else}
                ▶️ Play
              {/if}
            </button>
            
            <!-- Input and Buttons -->
            <div class="guess-input-section">
              <input 
                bind:value={currentGuessInputs[i]}
                placeholder={guessStates[i] === 'pending' ? 'Locked' : 'Enter your guess...'}
                on:keydown={(e) => handleKeydown(e, i)}
                disabled={guessStates[i] !== 'active' || isSubmittingGuess}
                class:locked={guessStates[i] === 'locked'}
                class:pending={guessStates[i] === 'pending'}
              />
              
              {#if guessStates[i] === 'active'}
                <button 
                  class="submit-btn"
                  on:click={() => handleGuess(i)}
                  disabled={!currentGuessInputs[i].trim() || isSubmittingGuess}
                  class:enabled={currentGuessInputs[i].trim() && !isSubmittingGuess}
                >
                  Submit
                </button>
                <button 
                  class="skip-btn"
                  on:click={() => handleSkip(i)}
                  disabled={isSubmittingGuess}
                  class:enabled={!isSubmittingGuess}
                >
                  Skip
                </button>
              {:else if guessStates[i] === 'locked'}
                <button class="x-btn" disabled>✗</button>
              {:else}
                <div class="placeholder-btns">
                  <div class="placeholder-btn">Submit</div>
                  <div class="placeholder-btn">Skip</div>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
      
      <!-- Hint Display -->
      {#if getHintText()}
        <div class="hint">
          {getHintText()}
        </div>
      {/if}
      
      <button class="logout-button" on:click={logout}>Logout</button>
    </div>
    
  {:else if gameStatus === 'won'}
    <!-- Win Screen -->
    <div class="win-screen">
      <h1>🎉 Congratulations!</h1>
      <p>You guessed it in {guesses.filter(g => g && g !== 'Skipped').length} tries!</p>
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

  .game-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .game-header h1 {
    margin: 0;
    font-size: 2rem;
  }

  .header-btn {
    background: #ccc;
    border: none;
    padding: 0.5rem;
    border-radius: 50%;
    cursor: not-allowed;
    font-size: 1.2rem;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ticker {
    background: #f0f0f0;
    padding: 0.75rem 1rem;
    border-radius: 20px;
    margin: 1rem 0;
    font-weight: bold;
    color: #333;
    animation: fadeIn 0.5s ease-in-out;
  }

  @keyframes fadeIn {
    0% { opacity: 0; }
    100% { opacity: 1; }
  }

  .logout-button {
    background: #ff6666;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background 0.2s;
    margin-top: 2rem;
  }

  .logout-button:hover {
    background: #ff5555;
  }
  
  .device-status {
    background: #e8f5e8;
    color: #2d5a2d;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    display: inline-block;
    margin: 1rem 0;
    font-size: 0.9rem;
  }
  
  .device-status.connecting {
    background: #fff3cd;
    color: #856404;
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
  
  .guess-components {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin: 2rem 0;
  }
  
  .guess-component {
    background: #f5f5f5;
    border: 2px solid #ddd;
    border-radius: 12px;
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    transition: all 0.3s ease;
  }
  
  .play-btn {
    background: #007bff;
    color: white;
    border: none;
    padding: 0.6rem 0.8rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.8rem;
    min-width: 70px;
    transition: all 0.3s ease;
    transform: scale(0.9);
  }
  
  .play-btn.enabled {
    transform: scale(1);
    box-shadow: 0 2px 4px rgba(0, 123, 255, 0.3);
  }
  
  .play-btn:disabled {
    background: #999;
    cursor: not-allowed;
    transform: scale(0.9);
    box-shadow: none;
  }
  
  .play-btn.playing {
    background: #ff9500;
    cursor: not-allowed;
    animation: pulse 1.5s infinite;
    transform: scale(1);
  }
  
  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.7; }
    100% { opacity: 1; }
  }
  
  .guess-input-section {
    display: flex;
    gap: 0.5rem;
    flex: 1;
    align-items: center;
  }
  
  .guess-input-section input {
    flex: 1;
    padding: 0.75rem;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-size: 1rem;
  }
  
  .guess-input-section input:disabled {
    background: #f5f5f5;
    color: #999;
    cursor: not-allowed;
  }
  
  .guess-input-section input.locked {
    background: #f5f5f5;
    border-color: #ddd;
    color: #333;
    font-weight: bold;
  }
  
  .guess-input-section input.pending {
    background: #f5f5f5;
    color: #999;
  }
  
  .submit-btn {
    background: #28a745;
    color: white;
    border: none;
    padding: 0.6rem 0.8rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.8rem;
    min-width: 60px;
    transition: all 0.3s ease;
    transform: scale(0.9);
  }
  
  .submit-btn.enabled {
    transform: scale(1);
    box-shadow: 0 2px 4px rgba(40, 167, 69, 0.3);
  }
  
  .submit-btn:disabled {
    background: #999;
    cursor: not-allowed;
    transform: scale(0.9);
    box-shadow: none;
  }
  
  .skip-btn {
    background: #1a365d;
    color: white;
    border: none;
    padding: 0.6rem 0.8rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.8rem;
    min-width: 60px;
    transition: all 0.3s ease;
    transform: scale(0.9);
  }
  
  .skip-btn.enabled {
    transform: scale(1);
    box-shadow: 0 2px 4px rgba(26, 54, 93, 0.3);
  }
  
  .skip-btn:disabled {
    background: #999;
    cursor: not-allowed;
    transform: scale(0.9);
    box-shadow: none;
  }
  
  .x-btn {
    background: #ff6b6b;
    color: white;
    border: none;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    cursor: not-allowed;
    font-size: 1rem;
    min-width: 70px;
  }
  
  .placeholder-btns {
    display: flex;
    gap: 0.5rem;
  }
  
  .placeholder-btn {
    background: #f5f5f5;
    color: #999;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-size: 0.9rem;
    min-width: 70px;
    text-align: center;
  }
  
  .hint {
    margin: 1rem 0;
    padding: 1rem;
    background: #f0f8ff;
    border-radius: 8px;
    font-weight: bold;
    color: #333;
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
