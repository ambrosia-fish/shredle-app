<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { loginWithSpotify } from '$lib/services/spotifyAuth';
  import { isAuthenticated, isPremium } from '$lib/stores/auth';

  onMount(() => {
    // Check if we're already authenticated and have premium
    if ($isAuthenticated && $isPremium) {
      goto('/game');
    }
  });

  function handleLogin() {
    loginWithSpotify();
  }
</script>

<div class="home-container">
  <h1>Guitar Solo Guesser</h1>
  <p>Test your knowledge of famous guitar solos!</p>
  
  <button on:click={handleLogin}>Login with Spotify</button>
  
  {#if $isAuthenticated && !$isPremium}
    <div class="error-message">
      <p>Spotify Premium is required to play Guitar Solo Guesser.</p>
    </div>
  {/if}
</div>

<style>
  .home-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    height: 80vh;
  }
  
  h1 {
    font-size: 2.5rem;
    margin-bottom: 1rem;
  }
  
  p {
    margin-bottom: 2rem;
    font-size: 1.2rem;
  }
  
  .error-message {
    margin-top: 1rem;
    color: #e74c3c;
    background-color: rgba(231, 76, 60, 0.1);
    padding: 1rem;
    border-radius: 4px;
    max-width: 400px;
  }
</style>