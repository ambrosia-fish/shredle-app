<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { checkAuth } from '$lib/services/spotifyAuth';
  import { gameState, currentSolo, updateGameState } from '$lib/stores/game';
  import SongResult from '$lib/components/SongResult.svelte';
  
  let isLoading = true;
  let error = '';
  
  onMount(() => {
    // Check authentication
    if (!checkAuth()) {
      window.location.href = '/';
      return;
    }
    
    try {
      // First try to load game state from localStorage
      const storedState = localStorage.getItem('game_state');
      if (storedState) {
        const parsedState = JSON.parse(storedState);
        updateGameState(parsedState);
        
        // Ensure this is indeed a correct guess
        if (!parsedState.currentSolo.isCorrect) {
          window.location.href = '/incorrect';
          return;
        }
      } else {
        // If no stored state and current state is empty, go to game
        if (!$currentSolo.id) {
          window.location.href = '/game';
          return;
        }
        
        // Ensure this is indeed a correct guess
        if (!$currentSolo.isCorrect) {
          window.location.href = '/game';
          return;
        }
      }
      
      isLoading = false;
    } catch (err) {
      error = 'Failed to load result data';
      isLoading = false;
    }
  });
</script>

<div class="result-page">
  {#if isLoading}
    <div class="loading">Loading result...</div>
  {:else if error}
    <div class="error">
      <p>{error}</p>
      <a href="/game" class="button">Back to Game</a>
    </div>
  {:else}
    <SongResult solo={$currentSolo} isCorrect={true} />
  {/if}
</div>

<style>
  .result-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem 1rem;
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
  
  .button {
    display: inline-block;
    margin-top: 1rem;
    padding: 8px 16px;
    background-color: #3498db;
    color: white;
    border-radius: 4px;
    text-decoration: none;
  }
  
  .button:hover {
    background-color: #2980b9;
  }
</style>