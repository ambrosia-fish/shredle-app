<script lang="ts">
  import { onMount } from 'svelte';
  import { checkAuth, logout } from '$lib/services/spotifyAuth';
  import { getDailySolo, submitGuess } from '$lib/services/api';
  import { updateGameState, gameState, currentSolo, attemptsRemaining } from '$lib/stores/game';
  import SoloPlayer from '$lib/components/SoloPlayer.svelte';
  import GuessForm from '$lib/components/GuessForm.svelte';
  
  let isLoading = true;
  let error = '';
  let isSubmitting = false;
  
  onMount(async () => {
    // Verify authentication
    if (!checkAuth()) {
      window.location.href = '/';
      return;
    }
    
    // Fetch daily solo
    try {
      const data = await getDailySolo();
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
      error = err.message || 'Failed to load daily solo';
      isLoading = false;
    }
  });
  
  async function handleGuess(event) {
    isSubmitting = true;
    const { guess } = event.detail;
    
    try {
      const response = await submitGuess(guess, $currentSolo.guessCount);
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
      error = err.message || 'Failed to submit guess';
    } finally {
      isSubmitting = false;
    }
  }
  
  function handleLogout() {
    console.log('Logging out...');
    logout();
    window.location.href = '/';
  }
  
  // Check if user is on mobile device
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
</script>

<div class="game-container">
  <div class="header-container">
    <h1>Guitar Solo Guesser</h1>
    <button class="logout-button" on:click={handleLogout}>Logout</button>
  </div>
  
  {#if isMobile}
    <div class="mobile-warning">
      <p>⚠️ This app currently works on desktop browsers only ⚠️</p>
      <p>Please visit from a desktop to play.</p>
    </div>
  {/if}
  
  {#if isLoading}
    <div class="loading">Loading today's guitar solo...</div>
  {:else if error}
    <div class="error">
      <p>{error}</p>
      <button on:click={() => window.location.reload()}>Try Again</button>
    </div>
  {:else}
    <div class="game-content">
      {#if isMobile}
        <div class="player-disabled">
          <p>Player disabled on mobile devices</p>
          <p class="desktop-note">Please use a desktop browser to play the game</p>
        </div>
      {:else}
        <SoloPlayer 
          spotifyId={$currentSolo.spotifyId}
          startTimeMs={$currentSolo.soloStartTimeMs}
          clipDurationMs={$currentSolo.clipDurationMs}
         />
      {/if}
      
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
    width: 100%;
    max-width: 100%;
  }
  
  .header-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    max-width: 600px;
    margin-bottom: 2rem;
    position: relative;
  }
  
  h1 {
    margin: 0;
    text-align: center;
    flex-grow: 1;
  }
  
  .logout-button {
    background: #444;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    position: absolute;
    right: 0;
  }
  
  .logout-button:hover {
    background: #555;
  }
  
  .mobile-warning {
    background-color: #fff3cd;
    color: #856404;
    border: 1px solid #ffeeba;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1.5rem;
    max-width: 500px;
    text-align: center;
  }
  
  .mobile-warning p {
    margin: 0.5rem 0;
  }
  
  .loading, .error {
    margin: 2rem 0;
    padding: 1rem;
    border-radius: 8px;
    text-align: center;
  }
  
  .loading {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .error {
    background-color: rgba(231, 76, 60, 0.1);
    color: #e74c3c;
  }
  
  .game-content {
    width: 100%;
    max-width: 600px;
  }
  
  .player-disabled {
    background-color: rgba(189, 195, 199, 0.3);
    border-radius: 8px;
    padding: 2rem;
    margin-bottom: 2rem;
    text-align: center;
  }
  
  .player-disabled p {
    margin: 0.5rem 0;
    font-weight: bold;
  }
  
  .desktop-note {
    font-size: 0.9rem;
    font-style: italic;
    opacity: 0.8;
  }
</style>