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
      <div class="logo">
        <h1>Shredle</h1>
        <div class="logo-accent">🎸</div>
      </div>
      <p class="tagline">Guess the guitar solo in 4 tries</p>
      <p class="premium-note">⚠ Spotify Premium required</p>
      <button class="login-btn" on:click={loginToSpotify}>
        <span>Connect Spotify</span>
      </button>
    </div>
    
  {:else if gameStatus === 'loading' || isProcessingCallback}
    <!-- Loading Screen -->
    <div class="loading-screen">
      <div class="logo">
        <h1>Shredle</h1>
        <div class="logo-accent">🎸</div>
      </div>
      <p class="loading-text">
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
      <div class="logo">
        <h1>Shredle</h1>
        <div class="logo-accent">🎸</div>
      </div>
      <h2>Something went wrong</h2>
      <p class="error-message">{errorMessage}</p>
      <div class="error-actions">
        <button on:click={retry} class="retry-btn">Try Again</button>
        <button on:click={() => { 
          spotifyLoggedIn = false; 
          localStorage.removeItem('spotify_access_token');
          isInitialized = false;
        }} class="secondary-btn">
          Login Again
        </button>
      </div>
    </div>
    
  {:else if gameStatus === 'playing'}
    <!-- Game Screen -->
    <div class="game-screen">
      <!-- Header -->
      <div class="game-header">
        <button class="header-btn" disabled>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
        </button>
        <div class="logo">
          <h1>Shredle</h1>
          <div class="logo-accent">🎸</div>
        </div>
        <button class="header-btn" disabled>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
          </svg>
        </button>
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
        <div class="device-status connected">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
          Connected to Spotify
        </div>
      {:else}
        <div class="device-status connecting">
          <div class="connecting-spinner"></div>
          Connecting to Spotify...
        </div>
      {/if}
      
      <!-- Guess Components -->
      <div class="guess-components">
        {#each Array(4) as _, i}
          <div class="guess-component">
            <div class="guess-row">
              <!-- Play Button -->
              <button 
                class="play-btn"
                on:click={() => playClip(i + 1)}
                disabled={isPlaying || !deviceId}
                class:playing={isPlaying}
                class:enabled={!isPlaying && deviceId}
              >
                {#if isPlaying}
                  <div class="playing-bars">
                    <div></div>
                    <div></div>
                    <div></div>
                  </div>
                {:else}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                {/if}
              </button>
              
              <!-- Input Field -->
              <input 
                bind:value={currentGuessInputs[i]}
                placeholder={guessStates[i] === 'pending' ? 'Locked' : 'Enter your guess...'}
                on:keydown={(e) => handleKeydown(e, i)}
                disabled={guessStates[i] !== 'active' || isSubmittingGuess}
                class:locked={guessStates[i] === 'locked'}
                class:pending={guessStates[i] === 'pending'}
              />
            </div>
            
            <!-- Action Buttons -->
            <div class="action-buttons">
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
                <button class="x-btn" disabled>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17c0 .5.4 1 1 1h6c.6 0 1-.5 1-1v-2.3c1.8-1.3 3-3.4 3-5.7 0-3.9-3.1-7-7-7z"/>
          </svg>
          {getHintText()}
        </div>
      {/if}
      
      <button class="logout-button" on:click={logout}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
        </svg>
        Logout
      </button>
    </div>
    
  {:else if gameStatus === 'won'}
    <!-- Win Screen -->
    <div class="win-screen">
      <div class="result-icon">🎉</div>
      <h1>Congratulations!</h1>
      <p class="result-text">You guessed it in {guesses.filter(g => g && g !== 'Skipped').length} tries!</p>
      <div class="song-info">
        <h2>{currentSolo?.title}</h2>
        <p>by {currentSolo?.artist}</p>
      </div>
      <button class="share-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
        </svg>
        Share Result
      </button>
    </div>
    
  {:else if gameStatus === 'lost'}
    <!-- Loss Screen -->
    <div class="loss-screen">
      <div class="result-icon">😔</div>
      <h1>Better luck tomorrow!</h1>
      <p class="result-text">The answer was:</p>
      <div class="song-info">
        <h2>{currentSolo?.title}</h2>
        <p>by {currentSolo?.artist}</p>
      </div>
      <button class="share-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
        </svg>
        Share Result
      </button>
    </div>
  {/if}
</main>

<style>
  :global(body) {
    background: #0a0a0a;
    color: #ffffff;
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  main {
    max-width: 600px;
    margin: 0 auto;
    padding: 2rem 1rem;
    min-height: 100vh;
    background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
  }
  
  .logo {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  
  .logo h1 {
    font-size: 2.5rem;
    font-weight: 700;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin: 0;
  }
  
  .logo-accent {
    font-size: 2rem;
    filter: grayscale(1) brightness(1.2);
  }
  
  .login-screen, .loading-screen, .error-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 80vh;
    text-align: center;
  }
  
  .tagline {
    font-size: 1.2rem;
    color: #a0a0a0;
    margin-bottom: 0.5rem;
  }
  
  .premium-note {
    color: #666;
    font-size: 0.9rem;
    margin-bottom: 2rem;
  }
  
  .login-btn {
    background: linear-gradient(135deg, #1db954 0%, #1ed760 100%);
    color: white;
    border: none;
    padding: 1rem 2rem;
    border-radius: 50px;
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(29, 185, 84, 0.3);
  }
  
  .login-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(29, 185, 84, 0.4);
  }
  
  .loading-text {
    color: #a0a0a0;
    font-size: 1.1rem;
    margin-bottom: 2rem;
  }
  
  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #333;
    border-top: 3px solid #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .error-message {
    color: #ff6b6b;
    margin: 1rem 0 2rem;
    font-weight: 500;
  }
  
  .error-actions {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }
  
  .retry-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 25px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }
  
  .secondary-btn {
    background: transparent;
    color: #a0a0a0;
    border: 2px solid #333;
    padding: 0.75rem 1.5rem;
    border-radius: 25px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }
  
  .secondary-btn:hover {
    border-color: #667eea;
    color: #667eea;
  }

  .game-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .game-header .logo h1 {
    font-size: 2rem;
  }

  .header-btn {
    background: #1a1a1a;
    color: #666;
    border: none;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: not-allowed;
  }

  .ticker {
    background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
    color: #a0a0a0;
    padding: 1rem 1.5rem;
    border-radius: 20px;
    margin-bottom: 2rem;
    font-weight: 600;
    text-align: center;
    border: 1px solid #333;
    animation: fadeIn 0.5s ease-in-out;
  }

  @keyframes fadeIn {
    0% { opacity: 0; transform: translateY(-10px); }
    100% { opacity: 1; transform: translateY(0); }
  }

  .device-status {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border-radius: 20px;
    margin-bottom: 2rem;
    font-size: 0.9rem;
    font-weight: 600;
  }
  
  .device-status.connected {
    background: linear-gradient(135deg, #1db954 0%, #1ed760 100%);
    color: white;
  }
  
  .device-status.connecting {
    background: #1a1a1a;
    color: #a0a0a0;
    border: 1px solid #333;
  }
  
  .connecting-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid #333;
    border-top: 2px solid #a0a0a0;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  .guess-components {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    margin-bottom: 2rem;
  }
  
  .guess-component {
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 16px;
    padding: 1.5rem;
    transition: all 0.3s ease;
  }
  
  .guess-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  
  .play-btn {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    border: none;
    background: #333;
    color: #666;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s ease;
    transform: scale(0.9);
    flex-shrink: 0;
  }
  
  .play-btn.enabled {
    background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
    color: white;
    transform: scale(1);
    box-shadow: 0 4px 15px rgba(0, 123, 255, 0.3);
  }
  
  .play-btn.playing {
    background: linear-gradient(135deg, #ff9500 0%, #ff7700 100%);
    animation: pulse 1.5s infinite;
    transform: scale(1);
  }
  
  .playing-bars {
    display: flex;
    gap: 2px;
    align-items: end;
  }
  
  .playing-bars div {
    width: 3px;
    background: currentColor;
    border-radius: 2px;
    animation: wave 1.2s ease-in-out infinite;
  }
  
  .playing-bars div:nth-child(1) { height: 8px; animation-delay: 0s; }
  .playing-bars div:nth-child(2) { height: 12px; animation-delay: 0.2s; }
  .playing-bars div:nth-child(3) { height: 6px; animation-delay: 0.4s; }
  
  @keyframes wave {
    0%, 100% { transform: scaleY(0.5); }
    50% { transform: scaleY(1); }
  }
  
  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.7; }
    100% { opacity: 1; }
  }
  
  .guess-row input {
    flex: 1;
    background: #0a0a0a;
    border: 2px solid #333;
    border-radius: 12px;
    padding: 1rem 1.25rem;
    color: #ffffff;
    font-size: 1rem;
    transition: all 0.3s ease;
  }
  
  .guess-row input:focus {
    outline: none;
    border-color: #667eea;
    background: #111;
  }
  
  .guess-row input:disabled {
    background: #1a1a1a;
    color: #666;
    cursor: not-allowed;
  }
  
  .guess-row input.locked {
    background: #1a1a1a;
    border-color: #333;
    color: #a0a0a0;
    font-weight: 600;
  }
  
  .action-buttons {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
  }
  
  .submit-btn, .skip-btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    transform: scale(0.95);
    min-width: 80px;
  }
  
  .submit-btn {
    background: #333;
    color: #666;
  }
  
  .submit-btn.enabled {
    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
    color: white;
    transform: scale(1);
    box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
  }
  
  .skip-btn {
    background: #333;
    color: #666;
  }
  
  .skip-btn.enabled {
    background: linear-gradient(135deg, #1a365d 0%, #2d5a87 100%);
    color: white;
    transform: scale(1);
    box-shadow: 0 4px 15px rgba(26, 54, 93, 0.3);
  }
  
  .x-btn {
    background: #ff6b6b;
    color: white;
    border: none;
    padding: 0.75rem;
    border-radius: 12px;
    cursor: not-allowed;
    min-width: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .placeholder-btns {
    display: flex;
    gap: 0.75rem;
  }
  
  .placeholder-btn {
    background: #1a1a1a;
    color: #666;
    padding: 0.75rem 1.5rem;
    border-radius: 12px;
    font-weight: 600;
    min-width: 80px;
    text-align: center;
  }
  
  .hint {
    background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
    border: 1px solid #333;
    border-radius: 16px;
    padding: 1.5rem;
    margin-bottom: 2rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: #a0a0a0;
    font-weight: 600;
  }
  
  .error-banner {
    background: #2a1a1a;
    border: 1px solid #ff6b6b;
    border-radius: 12px;
    padding: 1rem 1.5rem;
    margin-bottom: 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #ff6b6b;
  }
  
  .close-error {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #ff6b6b;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .logout-button {
    background: transparent;
    color: #a0a0a0;
    border: 2px solid #333;
    padding: 0.75rem 1.5rem;
    border-radius: 12px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin: 0 auto;
  }
  
  .logout-button:hover {
    border-color: #ff6b6b;
    color: #ff6b6b;
  }
  
  .win-screen, .loss-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 80vh;
    text-align: center;
  }
  
  .result-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }
  
  .win-screen h1, .loss-screen h1 {
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 1rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .result-text {
    color: #a0a0a0;
    font-size: 1.2rem;
    margin-bottom: 2rem;
  }
  
  .song-info {
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 16px;
    padding: 2rem;
    margin-bottom: 2rem;
    max-width: 400px;
    width: 100%;
  }
  
  .song-info h2 {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
    color: #ffffff;
  }
  
  .song-info p {
    color: #a0a0a0;
    font-size: 1.1rem;
    margin: 0;
  }
  
  .share-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 1rem 2rem;
    border-radius: 25px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
  }
  
  .share-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
  }
</style>
