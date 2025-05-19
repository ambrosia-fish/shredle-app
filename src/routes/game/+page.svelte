<script lang="ts">
  import { onMount } from 'svelte';
  import { checkAuth } from '$lib/services/spotifyAuth';
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
</script>

<div class="game-container">
  <h1>Guitar Solo Guesser</h1>
  
  {#if isLoading}
    <div class="loading">Loading today's guitar solo...</div>
  {:else if error}
    <div class="error">
      <p>{error}</p>
      <button on:click={() => window.location.reload()}>Try Again</button>
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
  }
  
  h1 {
    margin-bottom: 2rem;
    text-align: center;
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
</style>