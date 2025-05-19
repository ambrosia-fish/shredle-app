<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { checkAuthStatus } from '$lib/services/spotifyAuth';
  import { gameState, currentSolo } from '$lib/stores/game';
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
    
    // Ensure this is indeed a correct guess
    if (!$currentSolo.isCorrect) {
      goto('/game');
    }
  });
</script>

<div class="result-page">
  <SongResult solo={$currentSolo} isCorrect={true} />
</div>

<style>
  .result-page {
    padding: 2rem 1rem;
  }
</style>