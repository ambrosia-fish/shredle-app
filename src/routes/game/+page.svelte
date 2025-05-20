<script lang="ts">
  import { onMount } from 'svelte';
  import { checkAuth, accessToken } from '$lib/services/spotifyAuth';
  import { getDailySolo, submitGuess } from '$lib/services/api';
  import { updateGameState, gameState, currentSolo, attemptsRemaining } from '$lib/stores/game';
  import SoloPlayer from '$lib/components/SoloPlayer.svelte';
  import GuessForm from '$lib/components/GuessForm.svelte';
  
  let isLoading = true;
  let error = '';
  let isSubmitting = false;
  let debugInfo = '';
  
  onMount(async () => {
    console.log('Game page mounted, checking authentication...');
    
    // Verify authentication
    if (!checkAuth()) {
      console.log('Not authenticated, redirecting to home');
      window.location.href = '/';
      return;
    }
    
    console.log('Authentication verified, token exists:', $accessToken ? 'Yes' : 'No');
    
    // Fetch daily solo
    try {
      console.log('Fetching daily solo...');
      const data = await getDailySolo();
      console.log('Daily solo data received:', data);
      
      updateGameState(data);
      isLoading = false;
      
      // If game is already complete, redirect to result page
      if (data.isComplete) {
        // Store game state in localStorage before redirecting
        localStorage.setItem('game_state', JSON.stringify(data));
        
        if (data.currentSolo.isCorrect) {
          window.location.href = '/correct';
        } else {
          window.location.href = '/incorrect';
        }
      }
    } catch (err) {
      console.error('Error loading daily solo:', err);
      
      // Get more detailed error information
      error = err.message || 'Failed to load daily solo';
      
      // Add debug info about the environment
      debugInfo = `
        API URL: ${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5130'}
        Auth: ${$accessToken ? 'Token exists' : 'No token'}
        Error: ${err.stack || err.toString()}
      `;
      
      isLoading = false;
    }
  });
  
  async function handleGuess(event) {
    isSubmitting = true;
    error = ''; // Clear any previous errors
    const { guess } = event.detail;
    
    try {
      console.log(`Submitting guess: "${guess}" (guess count: ${$currentSolo.guessCount})`);
      const response = await submitGuess(guess, $currentSolo.guessCount);
      console.log('Guess response:', response);
      
      updateGameState(response);
      
      // Check if game is complete
      if (response.isComplete) {
        // Store game state in localStorage before redirecting
        localStorage.setItem('game_state', JSON.stringify(response));
        
        if (response.currentSolo.isCorrect) {
          // Use direct navigation instead of goto
          window.location.href = '/correct';
        } else {
          window.location.href = '/incorrect';
        }
      }
    } catch (err) {
      console.error('Error submitting guess:', err);
      error = err.message || 'Failed to submit guess';
    } finally {
      isSubmitting = false;
    }
  }
  
  function retryGame() {
    isLoading = true;
    error = '';
    window.location.reload();
  }
</script>

<div class="game-container">
  <h1>Guitar Solo Guesser</h1>
  
  {#if isLoading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading today's guitar solo...</p>
    </div>
  {:else if error}
    <div class="error">
      <h2>Error Loading Game</h2>
      <p>{error}</p>
      
      {#if debugInfo}
        <details class="debug-details">
          <summary>Technical Details</summary>
          <pre>{debugInfo}</pre>
        </details>
      {/if}
      
      <div class="error-actions">
        <button class="retry-button" on:click={retryGame}>Try Again</button>
        <a href="/" class="home-link">Return to Home</a>
      </div>
    </div>
  {:else}
    <div class="game-content">
      <SoloPlayer 
        spotifyId={$currentSolo.spotifyId}
        startTimeMs={$currentSolo.soloStartTimeMs}
        clipDurationMs={$currentSolo.clipDurationMs}
      />
      
      <GuessForm 
        solo={$currentSolo}
        isCorrect={$currentSolo.isCorrect}
        attemptsRemaining={$attemptsRemaining}
        isSubmitting={isSubmitting}
        on:submitGuess={handleGuess}
      />
    </div>
  {/if}
</div>

<style>
  .game-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem 1rem;
    max-width: 800px;
    margin: 0 auto;
  }
  
  h1 {
    margin-bottom: 2rem;
    text-align: center;
  }
  
  h2 {
    margin-top: 0;
    margin-bottom: 1rem;
  }
  
  .loading, .error {
    margin: 2rem 0;
    padding: 1.5rem;
    border-radius: 8px;
    text-align: center;
    width: 100%;
    max-width: 500px;
  }
  
  .loading {
    background-color: rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    margin: 20px;
    border: 4px solid rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    border-top: 4px solid #1DB954; /* Spotify green */
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .error {
    background-color: rgba(231, 76, 60, 0.1);
    color: #e74c3c;
    border: 1px solid rgba(231, 76, 60, 0.3);
  }
  
  .error-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 1.5rem;
  }
  
  .retry-button {
    background-color: #e74c3c;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    transition: background-color 0.2s;
  }
  
  .retry-button:hover {
    background-color: #c0392b;
  }
  
  .home-link {
    color: #3498db;
    text-decoration: none;
    padding: 5px;
  }
  
  .home-link:hover {
    text-decoration: underline;
  }
  
  .debug-details {
    margin: 1rem 0;
    text-align: left;
  }
  
  .debug-details summary {
    cursor: pointer;
    color: #666;
    font-size: 0.9rem;
  }
  
  .debug-details pre {
    background-color: rgba(0, 0, 0, 0.2);
    padding: 1rem;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 0.8rem;
    text-align: left;
    white-space: pre-wrap;
    margin-top: 0.5rem;
  }
  
  .game-content {
    width: 100%;
    max-width: 600px;
  }
</style>