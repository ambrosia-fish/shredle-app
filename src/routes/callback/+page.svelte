
<script lang="ts">
  import { onMount } from 'svelte';
  import { handleCallback } from '$lib/services/spotifyAuth';
  
  let isLoading = true;
  let error = '';
  let detailedError = '';
  
  onMount(async () => {
    try {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const spotifyError = url.searchParams.get('error');
      
      // Log parameters for debugging
      console.log('Callback parameters received:', { 
        code: code ? 'Present' : 'Missing', 
        state: state ? `Present (${state.length} chars)` : 'Missing',
        error: spotifyError || 'None' 
      });
      
      // Check for error parameter from Spotify
      if (spotifyError) {
        throw new Error(`Spotify error: ${spotifyError}`);
      }
      
      // Verify code is present
      if (!code) {
        throw new Error('No authorization code received from Spotify');
      }
      
      // Verify state is present
      if (!state) {
        throw new Error('No state parameter received from Spotify');
      }
      
      // Process the callback - will throw error if state format is invalid
      await handleCallback(code, state);
      
      // Redirect to game page on success - using current origin
      const currentOrigin = window.location.origin;
      window.location.href = `${currentOrigin}/game`;
      
    } catch (err) {
      console.error('Callback error:', err);
      error = err.message || 'Authentication failed';
      
      // Provide more helpful error messages
      if (error.includes('state')) {
        detailedError = 'There was a problem with the authentication process. This can happen if you refresh the page during login or if your browser blocks certain features.';
      } else if (error.includes('Token exchange failed')) {
        detailedError = 'There was a problem communicating with Spotify. Please try again in a moment.';
      } else {
        detailedError = 'Please try logging in again. If the problem persists, try using a different browser.';
      }
      
      isLoading = false;
    }
  });
  
  function tryAgain() {
    // Simple redirect to home, maintaining current origin
    const currentOrigin = window.location.origin;
    window.location.href = `${currentOrigin}/`;
  }
</script>

<div class="callback-container">
  {#if isLoading}
    <div class="loading">
      <h2>Logging in...</h2>
      <div class="spinner"></div>
      <p>Completing authentication with Spotify</p>
    </div>
  {:else if error}
    <div class="error">
      <h2>Authentication Error</h2>
      <p class="error-main">{error}</p>
      
      {#if detailedError}
        <p class="error-detail">{detailedError}</p>
      {/if}
      
      <div class="actions">
        <button class="action-button" on:click={tryAgain}>
          Try Again
        </button>
        <a href="/" class="back-link">Return to Home</a>
      </div>
    </div>
  {/if}
</div>

<style>
  .callback-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    text-align: center;
    padding: 0 20px;
  }
  
  .loading, .error {
    background-color: rgba(30, 30, 30, 0.9);
    border-radius: 10px;
    padding: 2rem;
    max-width: 500px;
  }
  
  h2 {
    margin-top: 0;
    margin-bottom: 1rem;
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
  
  .back-link {
    color: #3498db;
    text-decoration: none;
    padding: 5px;
  }
  
  .back-link:hover {
    text-decoration: underline;
  }
  
  /* Loading spinner */
  .spinner {
    width: 40px;
    height: 40px;
    margin: 20px auto;
    border: 4px solid rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    border-top: 4px solid #e74c3c;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>
