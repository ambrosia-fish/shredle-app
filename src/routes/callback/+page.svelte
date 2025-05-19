<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { handleCallback } from '$lib/services/spotifyAuth';
  import { isPremium } from '$lib/stores/auth';
  import DebugInfo from '$lib/components/DebugInfo.svelte';
  
  let errorMessage = '';
  let loading = true;
  let detailedError = '';
  
  onMount(async () => {
    try {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      
      console.log('Callback page loaded with:', {
        code: code ? 'Present' : 'Missing',
        error: error || 'None'
      });
      
      if (error) {
        errorMessage = `Authentication error: ${error}`;
        detailedError = 'Spotify returned an error during the authorization process.';
        loading = false;
        return;
      }
      
      if (!code) {
        errorMessage = 'No authentication code received from Spotify.';
        detailedError = 'The authorization code is missing from the callback URL.';
        loading = false;
        return;
      }
      
      try {
        console.log('Attempting to handle callback with code...');
        const success = await handleCallback(code);
        
        if (success) {
          console.log('Callback handled successfully, isPremium:', $isPremium);
          // Check premium status
          if ($isPremium) {
            goto('/game');
          } else {
            goto('/'); // Back to home with premium required message
          }
        } else {
          errorMessage = 'Failed to authenticate with Spotify.';
          detailedError = 'Authentication was unsuccessful. Please try again.';
        }
      } catch (err) {
        console.error('Error in callback handler:', err);
        errorMessage = err.message || 'An error occurred during authentication.';
        
        if (err.message.includes('code_verifier')) {
          detailedError = 'Authentication session expired or was invalid. Please clear your browser storage and try logging in again.';
        } else {
          detailedError = 'There was a problem processing your login. Please try again.';
        }
      }
    } catch (err) {
      console.error('Unexpected error in callback page:', err);
      errorMessage = 'An unexpected error occurred';
      detailedError = err.message || 'Unknown error';
    } finally {
      loading = false;
    }
  });
  
  function clearStorageAndRetry() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/';
  }
</script>

<div class="callback-container">
  {#if loading}
    <div class="loading">
      <h2>Logging you in...</h2>
      <p>Completing authentication with Spotify</p>
    </div>
  {:else if errorMessage}
    <div class="error">
      <h2>Authentication Error</h2>
      <p class="error-main">{errorMessage}</p>
      
      {#if detailedError}
        <p class="error-detail">{detailedError}</p>
      {/if}
      
      <div class="actions">
        <button class="action-button" on:click={clearStorageAndRetry}>
          Clear Storage & Retry
        </button>
        <a href="/" class="action-link">Return to Home</a>
      </div>
    </div>
  {/if}
</div>

<!-- Include debug panel in development only -->
{#if import.meta.env.DEV}
  <DebugInfo />
{/if}

<style>
  .callback-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    text-align: center;
    padding: 0 20px;
  }
  
  .loading, .error {
    background-color: rgba(30, 30, 30, 0.9);
    border-radius: 10px;
    padding: 2rem;
    max-width: 500px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
  }
  
  .loading h2, .error h2 {
    margin-top: 0;
    margin-bottom: 1rem;
    font-size: 1.8rem;
  }
  
  .loading {
    color: #1DB954; /* Spotify green */
  }
  
  .error {
    color: #e74c3c;
    border: 1px solid rgba(231, 76, 60, 0.3);
  }
  
  .error-main {
    font-weight: bold;
    font-size: 1.1rem;
    margin-bottom: 1rem;
  }
  
  .error-detail {
    opacity: 0.8;
    margin-bottom: 1.5rem;
  }
  
  .actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 1.5rem;
  }
  
  .action-button {
    background-color: #e74c3c;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    transition: background-color 0.2s;
  }
  
  .action-button:hover {
    background-color: #c0392b;
  }
  
  .action-link {
    color: #3498db;
    text-decoration: none;
    padding: 5px;
  }
  
  .action-link:hover {
    text-decoration: underline;
  }
</style>