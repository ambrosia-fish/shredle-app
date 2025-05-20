<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { loginWithSpotify, checkAuth } from '$lib/services/spotifyAuth';
  
  let isLoading = true;
  let authError = '';
  let errorDetail = '';
  
  onMount(() => {
    // Check for error query parameter (might be redirected from callback with error)
    const urlParams = new URLSearchParams(window.location.search);
    authError = urlParams.get('error') || '';
    
    // Add detailed message based on error type
    if (authError === 'premium_required') {
      authError = 'Premium Subscription Required';
      errorDetail = 'Guitar Solo Guesser requires a Spotify Premium subscription to play the audio samples. Please upgrade your Spotify account to enjoy the game.';
    }
    
    // Check if already authenticated
    if (checkAuth()) {
      // Already logged in, go to game
      window.location.href = '/game';
    }
    
    isLoading = false;
  });
  
  function handleLogin() {
    // Clear any error message
    authError = '';
    errorDetail = '';
    
    // Start login flow
    loginWithSpotify();
  }
</script>

<div class="home-container">
  <h1>Guitar Solo Guesser</h1>
  <p>Test your knowledge of famous guitar solos!</p>
  
  {#if isLoading}
    <div class="loading">Checking login status...</div>
  {:else if authError}
    <div class="error">
      <p class="error-title">{authError}</p>
      {#if errorDetail}
        <p class="error-detail">{errorDetail}</p>
      {:else}
        <p class="error-tip">Please try logging in again.</p>
      {/if}
    </div>
  {/if}
  
  <button on:click={handleLogin} class="login-button" disabled={isLoading}>
    Login with Spotify
  </button>
  
  <div class="info-box">
    <h3>How to play:</h3>
    <ol>
      <li>Login with your Spotify Premium account</li>
      <li>Listen to a snippet of a famous guitar solo</li>
      <li>Guess the song title within 4 attempts</li>
      <li>Each wrong guess reveals more of the solo</li>
    </ol>
    <p class="note">Note: Requires Spotify Premium to use the player</p>
  </div>
</div>

<style>
  .home-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    min-height: 80vh;
    padding: 1rem;
  }
  
  h1 {
    font-size: 2.5rem;
    margin-bottom: 1rem;
  }
  
  p {
    margin-bottom: 2rem;
    font-size: 1.2rem;
  }
  
  .login-button {
    background: #1DB954; /* Spotify green */
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 50px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 1.1rem;
    margin-bottom: 2rem;
  }
  
  .login-button:hover {
    background: #1ed760;
    transform: scale(1.05);
  }
  
  .login-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }
  
  .loading {
    opacity: 0.7;
    margin-top: 1rem;
    margin-bottom: 1rem;
  }
  
  .error {
    background-color: rgba(231, 76, 60, 0.1);
    color: #e74c3c;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1.5rem;
    max-width: 400px;
  }
  
  .error-title {
    font-weight: bold;
    margin-bottom: 0.5rem;
    font-size: 1.1rem;
  }
  
  .error-detail {
    font-size: 0.9rem;
    margin-bottom: 0;
  }
  
  .error-tip {
    font-size: 0.9rem;
    margin-top: 0.5rem;
    margin-bottom: 0;
  }
  
  .info-box {
    background-color: rgba(52, 152, 219, 0.1);
    border-radius: 8px;
    padding: 1.5rem;
    max-width: 400px;
    text-align: left;
  }
  
  .info-box h3 {
    margin-top: 0;
    margin-bottom: 1rem;
    text-align: center;
  }
  
  .info-box ol {
    padding-left: 1.5rem;
    margin: 0 0 1rem 0;
  }
  
  .info-box li {
    margin-bottom: 0.5rem;
  }
  
  .info-box li:last-child {
    margin-bottom: 0;
  }
  
  .note {
    font-size: 0.9rem;
    opacity: 0.8;
    font-style: italic;
    margin-bottom: 0;
  }
</style>