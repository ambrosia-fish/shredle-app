<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { handleCallback } from '$lib/services/spotifyAuth';
  import { isPremium } from '$lib/stores/auth';
  
  let errorMessage = '';
  let loading = true;
  
  onMount(async () => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    
    if (error) {
      errorMessage = `Authentication error: ${error}`;
      loading = false;
      return;
    }
    
    if (code) {
      try {
        const success = await handleCallback(code);
        if (success) {
          // Check premium status
          if ($isPremium) {
            goto('/game');
          } else {
            goto('/'); // Back to home with premium required message
          }
        } else {
          errorMessage = 'Failed to authenticate with Spotify.';
        }
      } catch (err) {
        errorMessage = err.message || 'An error occurred during authentication.';
      }
    } else {
      errorMessage = 'No authentication code received from Spotify.';
    }
    
    loading = false;
  });
</script>

<div class="callback-container">
  {#if loading}
    <p>Logging you in...</p>
  {:else if errorMessage}
    <div class="error">
      <h2>Authentication Error</h2>
      <p>{errorMessage}</p>
      <a href="/">Return to home</a>
    </div>
  {/if}
</div>

<style>
  .callback-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    text-align: center;
  }
  
  .error {
    color: #e74c3c;
    padding: 2rem;
    border-radius: 8px;
    background-color: rgba(231, 76, 60, 0.1);
    max-width: 500px;
  }
</style>