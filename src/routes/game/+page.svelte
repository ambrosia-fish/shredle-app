<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { checkAuthStatus } from '$lib/services/spotifyAuth';
  import { getDailySolo, submitGuess } from '$lib/services/api';
  import { updateGameState, gameState, currentSolo, attemptsRemaining } from '$lib/stores/game';
  import { isAuthenticated, isPremium } from '$lib/stores/auth';
  import SoloPlayer from '$lib/components/SoloPlayer.svelte';
  import GuessForm from '$lib/components/GuessForm.svelte';
  import DebugInfo from '$lib/components/DebugInfo.svelte';
  
  let isLoading = true;
  let error = '';
  let isSubmitting = false;
  let debugInfo = '';
  
  onMount(async () => {
    console.log("Game page mounted");
    debugInfo += "Game page mounted\n";
    
    // Log authentication state
    debugInfo += `Auth state: isAuthenticated=${$isAuthenticated}, isPremium=${$isPremium}\n`;
    console.log("Auth state:", { isAuthenticated: $isAuthenticated, isPremium: $isPremium });
    
    // Verify authentication
    const authStatus = checkAuthStatus();
    debugInfo += `checkAuthStatus result: ${authStatus}\n`;
    console.log("checkAuthStatus result:", authStatus);
    
    if (!authStatus) {
      debugInfo += "Not authenticated, redirecting to home\n";
      console.log("Not authenticated, redirecting to home");
      window.location.href = '/';
      return;
    }
    
    // Verify premium
    debugInfo += `After checkAuthStatus, isPremium: ${$isPremium}\n`;
    console.log("After checkAuthStatus, isPremium:", $isPremium);
    
    if (!$isPremium) {
      debugInfo += "No premium, redirecting to home\n";
      console.log("No premium, redirecting to home");
      window.location.href = '/';
      return;
    }
    
    // Fetch daily solo
    try {
      debugInfo += "Fetching daily solo...\n";
      console.log("Fetching daily solo");
      
      const data = await getDailySolo();
      debugInfo += "Daily solo fetched successfully\n";
      console.log("Daily solo fetched:", data);
      
      updateGameState(data);
      isLoading = false;
      
      // If game is already complete, redirect to result page
      if (data.isComplete) {
        if (data.currentSolo.isCorrect) {
          debugInfo += "Game already complete with correct answer, redirecting to /correct\n";
          window.location.href = '/correct';
        } else {
          debugInfo += "Game already complete with incorrect answer, redirecting to /incorrect\n";
          window.location.href = '/incorrect';
        }
      }
    } catch (err) {
      error = err.message || 'Failed to load daily solo';
      debugInfo += `Error loading daily solo: ${err.message}\n`;
      console.error("Error loading daily solo:", err);
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
        if (response.currentSolo.isCorrect) {
          goto('/correct');
        } else {
          goto('/incorrect');
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
        endTimeMs={$currentSolo.soloEndTimeMs}
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
  
  {#if debugInfo}
    <pre class="debug-log">{debugInfo}</pre>
  {/if}
</div>

{#if import.meta.env.DEV}
  <DebugInfo />
{/if}

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
  
  .debug-log {
    margin-top: 2rem;
    padding: 1rem;
    background-color: rgba(0, 0, 0, 0.8);
    color: #00ff00;
    font-family: monospace;
    font-size: 12px;
    border-radius: 5px;
    text-align: left;
    width: 100%;
    max-width: 600px;
    overflow-x: auto;
    white-space: pre-wrap;
  }
</style>