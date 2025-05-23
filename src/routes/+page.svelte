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
  let isSpotifyInitializing = false; // Track Spotify initialization state
  
  // UI state variables
  let tickerMessage = '';
  let tickerIsHint = false;
  let tickerIsNewHint = false;
  let guessStates: ('active' | 'locked' | 'pending')[] = ['active', 'pending', 'pending', 'pending'];
  let currentGuessInputs: string[] = ['', '', '', ''];
  let isSubmittingGuess = false;
  
  // Track which hints have been shown and the most recent hint
  let shownHints = new Set<string>();
  let mostRecentHint = '';
  
  // Ticker functionality
  let tickerInterval: number;
  let tickerIndex = 0;
  
  function getTickerMessages() {
    const messages = [];
    
    // Always include date
    const today = new Date();
    messages.push({
      text: today.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      isHint: false,
      isNew: false,
      isRecent: false
    });
    
    // Always include attempts left
    const attemptsLeft = 5 - currentAttempt;
    messages.push({
      text: `${attemptsLeft} attempts left`,
      isHint: false,
      isNew: false,
      isRecent: false
    });
    
    // Add hints based on current attempt
    if (currentAttempt >= 2 && currentSolo?.guitarist) {
      const hintKey = 'guitarist';
      const hintText = `Guitarist: ${currentSolo.guitarist}`;
      const isNewHint = !shownHints.has(hintKey);
      if (isNewHint) {
        shownHints.add(hintKey);
        mostRecentHint = hintText;
      }
      messages.push({
        text: hintText,
        isHint: true,
        isNew: isNewHint,
        isRecent: mostRecentHint === hintText
      });
    }
    
    if (currentAttempt >= 3 && currentSolo?.artist) {
      const hintKey = 'artist';
      const hintText = `Artist: ${currentSolo.artist}`;
      const isNewHint = !shownHints.has(hintKey);
      if (isNewHint) {
        shownHints.add(hintKey);
        mostRecentHint = hintText;
      }
      messages.push({
        text: hintText,
        isHint: true,
        isNew: isNewHint,
        isRecent: mostRecentHint === hintText
      });
    }
    
    if (currentAttempt >= 4 && currentSolo?.hint) {
      const hintKey = 'hint';
      const hintText = `Hint: ${currentSolo.hint}`;
      const isNewHint = !shownHints.has(hintKey);
      if (isNewHint) {
        shownHints.add(hintKey);
        mostRecentHint = hintText;
      }
      messages.push({
        text: hintText,
        isHint: true,
        isNew: isNewHint,
        isRecent: mostRecentHint === hintText
      });
    }
    
    return messages;
  }
  
  function startTicker() {
    function updateTicker() {
      const messages = getTickerMessages();
      if (messages.length === 0) return;
      
      const currentMessage = messages[tickerIndex % messages.length];
      tickerMessage = currentMessage.text;
      tickerIsHint = currentMessage.isHint;
      tickerIsNewHint = currentMessage.isNew || currentMessage.isRecent;
      
      tickerIndex++;
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
      
      // Mark Spotify as initializing
      isSpotifyInitializing = true;
      
      // Initialize Spotify player
      console.log('Initializing Spotify player...');
      player = await initializeSpotifyPlayer();
      
      // Set up player event listeners to get device ID
      player.addListener('ready', ({ device_id }) => {
        console.log('Spotify player ready with device ID:', device_id);
        deviceId = device_id;
        isSpotifyInitializing = false; // Spotify is ready
        // Transfer playback to our device
        transferPlaybackToDevice(device_id).catch(err => {
          console.warn('Failed to transfer playback:', err);
          // Don't show error to user as this is not critical
        });
      });
      
      player.addListener('initialization_error', ({ message }) => {
        console.error('Spotify initialization error:', message);
        isSpotifyInitializing = false;
        errorMessage = 'Failed to initialize Spotify player';
      });
      
      gameStatus = 'playing';
      startTicker();
      console.log('Game loaded successfully');
    } catch (error) {
      console.error('Failed to load game:', error);
      errorMessage = getSpotifyErrorMessage(error instanceof Error ? error.message : String(error));
      gameStatus = 'error';
      isSpotifyInitializing = false;
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

  function stopClip() {
    if (player && playingClipNumber > 0) {
      player.pause();
      playingClipNumber = 0;
    }
  }
  
  async function playClip(clipNumber: number) {
    // If this clip is already playing, stop it
    if (playingClipNumber === clipNumber) {
      stopClip();
      return;
    }
    
    // Stop any other playing clip first
    if (playingClipNumber > 0) {
      stopClip();
    }
    
    if (!player || !deviceId || !currentGame) {
      console.error('Cannot play clip: missing player, device ID, or game data');
      return;
    }
    
    try {
      playingClipNumber = clipNumber;
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
        playingClipNumber = 0;
      }, clipDuration + 500); // Add small buffer
      
    } catch (error) {
      console.error('Failed to play clip:', error);
      if (error instanceof Error && error.message.includes('fetch')) {
        errorMessage = `Failed to load clip ${clipNumber} data. Please check your connection and try again.`;
      } else {
        errorMessage = `Failed to play clip ${clipNumber}. Make sure Spotify is active and try again.`;
      }
      playingClipNumber = 0;
    }
  }
  
  function isPlayButtonEnabled(index: number): boolean {
    // Show loading state for first button while Spotify initializes
    if (index === 0 && isSpotifyInitializing) {
      return false; // Disabled but will show loading animation
    }
    
    // Enable for active and all previous (locked) components when player is ready
    return (guessStates[index] === 'active' || guessStates[index] === 'locked') && 
           player && deviceId && !isSpotifyInitializing;
  }

  function isPlayButtonLoading(index: number): boolean {
    // Only show loading for the first button while Spotify is initializing
    return index === 0 && isSpotifyInitializing && guessStates[index] === 'active';
  }
  
  function isPlayButtonPlaying(index: number): boolean {
    // Only the specific button that was clicked should show playing state
    return playingClipNumber === (index + 1);
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
    playingClipNumber = 0;
    shownHints = new Set();
    mostRecentHint = '';
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
        </div>
        <button class="header-btn" disabled>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
          </svg>
        </button>
      </div>
      
      <!-- Ticker -->
      <div 
        class="ticker" 
        class:hint={tickerIsHint}
        class:new-hint={tickerIsNewHint}
      >
        {tickerMessage}
      </div>
      
      {#if errorMessage}
        <div class="error-banner">
          <span>{errorMessage}</span>
          <button on:click={clearError} class="close-error">×</button>
        </div>
      {/if}
      
      <!-- Guess Components -->
      <div class="guess-components">
        {#each Array(4) as _, i}
          <div 
            class="guess-component"
            class:active={guessStates[i] === 'active'}
            class:locked={guessStates[i] === 'locked'}
            class:pending={guessStates[i] === 'pending'}
          >
            <div class="guess-row">
              <!-- Play Button -->
              <button 
                class="play-btn"
                on:click={() => playClip(i + 1)}
                disabled={!isPlayButtonEnabled(i) && !isPlayButtonLoading(i)}
                class:playing={isPlayButtonPlaying(i)}
                class:enabled={isPlayButtonEnabled(i)}
                class:loading={isPlayButtonLoading(i)}
              >
                {#if isPlayButtonLoading(i)}
                  <div class="play-spinner"></div>
                {:else if isPlayButtonPlaying(i)}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2"/>
                  </svg>
                {:else}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
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
    background: #0a0a0a;
  }
  
  .logo {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1rem;
  }
  
  .logo h1 {
    font-size: 2.5rem;
    font-weight: 700;
    color: #6366f1;
    margin: 0;
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
    background: #1db954;
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
    border-top: 3px solid #6366f1;
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
    background: #6366f1;
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
    border-color: #6366f1;
    color: #6366f1;
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
    background: #1a1a1a;
    color: #a0a0a0;
    padding: 1rem 1.5rem;
    border-radius: 20px;
    margin-bottom: 2rem;
    font-weight: 600;
    text-align: center;
    border: 1px solid #333;
    animation: fadeIn 0.5s ease-in-out;
    transition: all 0.3s ease;
  }
  
  .ticker.hint {
    color: #a0a0a0;
    border-color: #333;
  }
  
  .ticker.new-hint {
    background: #0d1a0d;
    color: #1db954;
    border-color: #1db954;
    box-shadow: 0 0 20px rgba(29, 185, 84, 0.3);
    animation: fadeIn 0.5s ease-in-out, spotifyGlow 2s ease-in-out;
  }

  @keyframes fadeIn {
    0% { opacity: 0; transform: translateY(-10px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  
  @keyframes spotifyGlow {
    0% { box-shadow: 0 0 5px rgba(29, 185, 84, 0.3); }
    50% { box-shadow: 0 0 25px rgba(29, 185, 84, 0.6); }
    100% { box-shadow: 0 0 10px rgba(29, 185, 84, 0.3); }
  }
  
  .guess-components {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 2rem;
  }
  
  .guess-component {
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 12px;
    padding: 1rem;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    transform: scale(0.75);
    opacity: 0.4;
  }
  
  .guess-component.active {
    transform: scale(1);
    opacity: 1;
    border-color: #6366f1;
    box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.2);
  }
  
  .guess-component.locked {
    transform: scale(1);
    opacity: 1;
  }
  
  .guess-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }
  
  .play-btn {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: none;
    background: #333;
    color: #666;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s ease;
    flex-shrink: 0;
  }
  
  .play-btn.enabled {
    background: #007bff;
    color: white;
    box-shadow: 0 2px 8px rgba(0, 123, 255, 0.3);
  }
  
  .play-btn.playing {
    background: #ff9500;
    animation: pulse 1.5s infinite;
  }
  
  .play-btn.loading {
    background: #555;
    cursor: not-allowed;
  }

  .play-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid #666;
    border-top: 2px solid #aaa;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .play-btn:not(:disabled):hover {
    transform: scale(1.1);
  }

  .play-btn.playing:hover {
    background: #e68500;
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
    border-radius: 8px;
    padding: 0.75rem 1rem;
    color: #ffffff;
    font-size: 1rem;
    transition: all 0.3s ease;
  }
  
  .guess-row input:focus {
    outline: none;
    border-color: #6366f1;
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
    gap: 0.5rem;
    justify-content: center;
  }
  
  .submit-btn, .skip-btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.3s ease;
    min-width: 70px;
  }
  
  .submit-btn {
    background: #555;
    color: #999;
  }
  
  .submit-btn.enabled {
    background: #28a745;
    color: white;
    box-shadow: 0 2px 6px rgba(40, 167, 69, 0.3);
  }
  
  .skip-btn {
    background: #555;
    color: #999;
  }
  
  .skip-btn.enabled {
    background: #1a365d;
    color: white;
    box-shadow: 0 2px 6px rgba(26, 54, 93, 0.3);
  }
  
  .x-btn {
    background: #ff6b6b;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    cursor: not-allowed;
    min-width: 70px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
  }
  
  .placeholder-btns {
    display: flex;
    gap: 0.5rem;
  }
  
  .placeholder-btn {
    background: #2a2a2a;
    color: #666;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.9rem;
    min-width: 70px;
    text-align: center;
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
    color: #6366f1;
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
    background: #6366f1;
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
    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
  }
  
  .share-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
  }
</style>