<script lang="ts">
  import { onMount } from 'svelte';
  import { handleCallback } from '$lib/services/spotifyAuth';
  import { isPremium } from '$lib/stores/auth';
  
  let isLoading = true;
  let error = '';
  let detailedError = '';
  let debugInfo = '';
  
  onMount(async () => {
    console.log('Callback component mounted');
    
    try {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const spotifyError = url.searchParams.get('error');
      
      // Add debug information
      debugInfo = `
        URL: ${window.location.href}
        Code: ${code ? 'Present' : 'Missing'}
        State: ${state ? 'Present' : 'Missing'}
        Spotify Error: ${spotifyError || 'None'}
      `;
      
      console.log('Callback parameters:', { 
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
      
      console.log('Starting handleCallback with code');
      
      // Handle callback - try with state if present, otherwise without
      if (state) {
        await handleCallback(code, state);
      } else {
        // @ts-ignore - Type safety for backward compatibility
        await handleCallback(code);
      }
      
      console.log('Callback handled successfully, isPremium:', $isPremium);
      
      // Add small delay to allow stores to update
      setTimeout(() => {
        try {
          // Check premium status and redirect accordingly
          if ($isPremium) {
            // Premium user - go to game
            console.log('User has premium, redirecting to game page');
            window.location.href = '/game';
          } else {
            // Non-premium user - go to home with message
            console.log('User does NOT have premium, redirecting to home');
            window.location.href = '/?error=premium_required';
          }
        } catch (finalErr) {
          console.error('Error in redirect logic:', finalErr);
          error = 'Error during redirect after authentication';
          isLoading = false;
        }
      }, 1000);
      
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
    // Clear any persisted state
    try {
      localStorage.removeItem('code_verifier');
      localStorage.removeItem('spotify_auth_state');
      localStorage.removeItem('spotify_access_token');
      localStorage.removeItem('spotify_refresh_token');
      localStorage.removeItem('spotify_token_expires');
    } catch (e) {
      console.warn('Failed to clear storage:', e);
    }
    
    // Simple redirect to home
    window.location.href = '/';
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
      
      <details class="debug-details">
        <summary>Debug Information</summary>
        <pre>{debugInfo}</pre>
      </details>
      
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
  
  .debug-details {
    margin: 1rem 0;
    text-align: left;
  }
  
  .debug-details summary {
    cursor: pointer;
    color: #666;
    font-size: 0.9rem;
  }
  
  .debug-details pre {
    background-color: rgba(0, 0, 0, 0.2);
    padding: 1rem;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 0.8rem;
    text-align: left;
    white-space: pre-wrap;
    margin-top: 0.5rem;
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