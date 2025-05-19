<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { loginWithSpotify, checkAuthStatus } from '$lib/services/spotifyAuth';
  import { isAuthenticated, isPremium } from '$lib/stores/auth';
  import DebugInfo from '$lib/components/DebugInfo.svelte';

  let debugInfo = '';

  onMount(() => {
    console.log('Home page mounted');
    debugInfo += 'Home page mounted\n';
    
    // Log auth state
    debugInfo += `Initial auth state: isAuthenticated=${$isAuthenticated}, isPremium=${$isPremium}\n`;
    console.log('Initial auth state:', { isAuthenticated: $isAuthenticated, isPremium: $isPremium });
    
    // Check if we need to refresh the auth
    debugInfo += 'Running checkAuthStatus()\n';
    const authStatus = checkAuthStatus();
    debugInfo += `checkAuthStatus result: ${authStatus}\n`;
    
    // Log updated auth state
    debugInfo += `Updated auth state: isAuthenticated=${$isAuthenticated}, isPremium=${$isPremium}\n`;
    console.log('Updated auth state:', { isAuthenticated: $isAuthenticated, isPremium: $isPremium });
    
    // Check if we're already authenticated and have premium
    if ($isAuthenticated && $isPremium) {
      debugInfo += 'Authenticated with Premium, redirecting to game page\n';
      console.log('Authenticated with Premium, redirecting to game page');
      // Use window.location for a full page reload to avoid navigation issues
      window.location.href = '/game';
    } else if ($isAuthenticated && !$isPremium) {
      debugInfo += 'Authenticated but no Premium\n';
      console.log('Authenticated but no Premium');
    } else {
      debugInfo += 'Not authenticated\n';
      console.log('Not authenticated');
    }
  });

  function handleLogin() {
    console.log('Initiating Spotify login');
    debugInfo += 'Login button clicked\n';
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
  
  {#if debugInfo}
    <pre class="debug-log">{debugInfo}</pre>
  {/if}
</div>

<!-- Include debug panel in development only -->
{#if import.meta.env.DEV}
  <DebugInfo />
{/if}

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
  
  .error-message {
    margin-top: 1rem;
    color: #e74c3c;
    background-color: rgba(231, 76, 60, 0.1);
    padding: 1rem;
    border-radius: 4px;
    max-width: 400px;
  }
  
  .debug-log {
    margin-top: 2rem;
    padding: 1rem;
    background-color: rgba(0, 0, 0, 0.8);
    color: #00ff00;
    font-family: monospace;
    font-size: 12px;
    border-radius: 5px;
    text-align: left;
    width: 100%;
    max-width: 600px;
    overflow-x: auto;
    white-space: pre-wrap;
  }
</style>