<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { checkAuthStatus } from '$lib/services/spotifyAuth';
  import { gameState, currentSolo, attemptsRemaining } from '$lib/stores/game';
  import { isAuthenticated } from '$lib/stores/auth';
  import SongResult from '$lib/components/SongResult.svelte';
  
  onMount(() => {
    // Check authentication
    if (!checkAuthStatus()) {
      goto('/');
      return;
    }
    
    // Ensure we have game state
    if (!$gameState.currentSolo.id) {
      goto('/game');
      return;
    }
    
    // Ensure this is indeed an incorrect guess and game is complete
    if ($currentSolo.isCorrect || $attemptsRemaining > 0) {
      goto('/game');
    }
  });
</script>

<div class="result-page">
  <SongResult solo={$currentSolo} isCorrect={false} />
</div>

<style>
  .result-page {
    padding: 2rem 1rem;
  }
</style>