<script lang="ts">
  import { onMount } from 'svelte';
  import { getDailyGame, getSolo } from '$lib/api';
  import { activatePlayerForMobile, playTrackSegment } from '$lib/spotify-playback';
  
  // State variables
  let currentGame: any = null;
  let currentSolo: any = null;
  let player: any = null;
  let deviceId: string = '';
  let isPlayerReady: boolean = false;
  let playingClipNumber: number = 0;
  let errorMessage: string = '';
  let clipTimeouts: any[] = [];
  let userGuess: string = '';
  let attemptNumber: number = 1;
  let gameWon: boolean = false;
  let gameLost: boolean = false;

  // Clear all clip timeouts helper function
  function clearAllClipTimeouts() {
    clipTimeouts.forEach(timeout => clearTimeout(timeout));
    clipTimeouts = [];
  }

  async function playClip(clipNumber: number) {
    // Set visual feedback immediately when button is clicked
    clearAllClipTimeouts();
    playingClipNumber = clipNumber;
    errorMessage = ''; // Clear any previous errors
    
    if (!player || !deviceId || !currentGame || !isPlayerReady) {
      console.error('Cannot play clip: missing player, device ID, game data, or player not ready');
      // Keep visual state for a moment to show user the button was clicked
      setTimeout(() => {
        if (playingClipNumber === clipNumber) {
          playingClipNumber = 0;
        }
      }, 1000);
      return;
    }
    
    try {
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
      const timeout = setTimeout(() => {
        // Only reset if this is still the active clip
        if (playingClipNumber === clipNumber) {
          playingClipNumber = 0;
        }
      }, clipDuration + 500); // Add small buffer
      
      clipTimeouts.push(timeout);
      
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

  // Initialize game on mount
  onMount(async () => {
    try {
      currentGame = await getDailyGame();
      if (currentGame) {
        currentSolo = await getSolo(currentGame.soloId);
      }
    } catch (error) {
      console.error('Failed to load game:', error);
      errorMessage = 'Failed to load today\'s game. Please refresh and try again.';
    }
  });
</script>

<div class="game-container">
  <header>
    <h1>Shredle</h1>
    <p>Guess the song from the guitar solo!</p>
  </header>

  {#if errorMessage}
    <div class="error-message">
      {errorMessage}
    </div>
  {/if}

  {#if currentGame && currentSolo}
    <div class="game-content">
      <div class="clip-buttons">
        {#each [1, 2, 3, 4] as clipNum}
          <button 
            class="clip-button" 
            class:playing={playingClipNumber === clipNum}
            class:disabled={clipNum > attemptNumber && !gameWon}
            on:click={() => playClip(clipNum)}
          >
            Clip {clipNum}
            {#if playingClipNumber === clipNum}
              <span class="playing-indicator">♪</span>
            {/if}
          </button>
        {/each}
      </div>

      {#if !gameWon && !gameLost}
        <div class="guess-section">
          <input 
            type="text" 
            bind:value={userGuess} 
            placeholder="Enter your guess..."
            class="guess-input"
          />
          <button class="submit-guess">Submit Guess</button>
        </div>
      {/if}

      {#if currentSolo.hint}
        <div class="hint">
          <strong>Hint:</strong> {currentSolo.hint}
        </div>
      {/if}
    </div>
  {:else}
    <div class="loading">
      Loading today's game...
    </div>
  {/if}
</div>

<style>
  .game-container {
    max-width: 600px;
    margin: 0 auto;
    padding: 2rem;
    text-align: center;
  }

  header h1 {
    font-size: 3rem;
    margin-bottom: 0.5rem;
    color: #1db954;
  }

  .error-message {
    background: #ff6b6b;
    color: white;
    padding: 1rem;
    border-radius: 8px;
    margin: 1rem 0;
  }

  .clip-buttons {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin: 2rem 0;
  }

  .clip-button {
    padding: 1rem 2rem;
    font-size: 1.2rem;
    border: 2px solid #1db954;
    background: white;
    color: #1db954;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
  }

  .clip-button:hover {
    background: #1db954;
    color: white;
  }

  .clip-button.playing {
    background: #1db954;
    color: white;
    animation: pulse 1s infinite;
  }

  .clip-button.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .playing-indicator {
    position: absolute;
    right: 0.5rem;
    animation: bounce 0.5s infinite alternate;
  }

  .guess-section {
    margin: 2rem 0;
    display: flex;
    gap: 1rem;
    justify-content: center;
  }

  .guess-input {
    padding: 0.75rem;
    font-size: 1rem;
    border: 2px solid #ddd;
    border-radius: 8px;
    flex: 1;
    max-width: 300px;
  }

  .submit-guess {
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    background: #1db954;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
  }

  .hint {
    margin: 1rem 0;
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 8px;
    border-left: 4px solid #1db954;
  }

  .loading {
    padding: 2rem;
    font-size: 1.2rem;
    color: #666;
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }

  @keyframes bounce {
    from { transform: translateY(0); }
    to { transform: translateY(-3px); }
  }
</style>