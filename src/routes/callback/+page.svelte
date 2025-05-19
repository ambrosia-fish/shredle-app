<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { handleCallback } from '$lib/services/spotifyAuth';
  import { isPremium } from '$lib/stores/auth';
  
  let errorMessage = '';
  let loading = true;
  let retryEnabled = false;
  
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
          retryEnabled = true;
        }
      } catch (err) {
        const error = err as Error;
        errorMessage = error.message || 'An error occurred during authentication.';
        // Enable retry for specific errors
        if (error.message.includes('No stored state found') || 
            error.message.includes('expired') || 
            error.message.includes('cleared')) {
          retryEnabled = true;
        }
      }
    } else {
      errorMessage = 'No authentication code received from Spotify.';
    }
    
    loading = false;
  });

  // Clear local storage and retry the login flow
  function handleClearAndRetry() {
    localStorage.clear();
    goto('/');
  }
</script>

<div class="callback-container">
  {#if loading}
    <p>Logging you in...</p>
  {:else if errorMessage}
    <div class="error">
      <h2>Authentication Error</h2>
      <p>{errorMessage}</p>
      {#if retryEnabled}
        <button class="retry-button" on:click={handleClearAndRetry}>Clear & Try Again</button>
      {/if}
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

  .retry-button {
    background-color: #3498db;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    margin: 1rem 0;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    display: block;
    width: 100%;
  }
  
  .retry-button:hover {
    background-color: #2980b9;
  }
  
  a {
    display: inline-block;
    margin-top: 1rem;
    color: #3498db;
    text-decoration: none;
  }
  
  a:hover {
    text-decoration: underline;
  }
</style>