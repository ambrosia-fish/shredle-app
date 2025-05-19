<script lang="ts">
  import { onMount } from 'svelte';
  import { accessToken, isAuthenticated, isPremium } from '$lib/stores/auth';
  
  let clientId = '';
  let clientSecret = '';
  let redirectUri = '';
  let sdkLoaded = false;
  let codeVerifier = '';
  let authToken = '';
  let localStorageAvailable = false;
  let tokenFromStore = '';
  let tokenFromStorage = '';
  
  onMount(() => {
    try {
      // Check environment variables
      clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID || 'Not defined';
      clientSecret = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET || 'Not defined';
      redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI || 'Not defined';
      
      // Check SDK
      sdkLoaded = typeof window.Spotify !== 'undefined';
      
      // Check localStorage
      localStorageAvailable = typeof localStorage !== 'undefined';
      if (localStorageAvailable) {
        codeVerifier = localStorage.getItem('code_verifier') ? 'Present' : 'Missing';
        authToken = localStorage.getItem('spotify_access_token') ? 'Present' : 'Missing';
        
        // Debug token values
        tokenFromStorage = localStorage.getItem('spotify_access_token') || '';
        if (tokenFromStorage) {
          // Show start and end characters only for security
          tokenFromStorage = `${tokenFromStorage.substring(0, 5)}...${tokenFromStorage.substring(tokenFromStorage.length - 5)}`;
        }
      }
      
      // Get token from store
      tokenFromStore = $accessToken;
      if (tokenFromStore) {
        // Show start and end characters only for security
        tokenFromStore = `${tokenFromStore.substring(0, 5)}...${tokenFromStore.substring(tokenFromStore.length - 5)}`;
      }
    } catch (error) {
      console.error('Error in debug component:', error);
    }
  });
  
  function clearStorage() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  }

  function fixToken() {
    try {
      // Get the token from localStorage
      const currentToken = localStorage.getItem('spotify_access_token');
      if (currentToken) {
        // Remove any quotes
        const cleanToken = String(currentToken).replace(/^["']|["']$/g, '');
        // Store it back
        localStorage.setItem('spotify_access_token', cleanToken);
        // Update the store
        accessToken.set(cleanToken);
        alert('Token cleaned and updated');
        window.location.reload();
      } else {
        alert('No token found in localStorage');
      }
    } catch (error) {
      console.error('Error fixing token:', error);
      alert('Error fixing token: ' + error.message);
    }
  }

  function reportTokenStatus() {
    try {
      const token = localStorage.getItem('spotify_access_token');
      const tokenInStore = $accessToken;
      
      const hasQuotes = token && (token.startsWith('"') || token.endsWith('"'));
      const storeHasQuotes = tokenInStore && (tokenInStore.startsWith('"') || tokenInStore.endsWith('"'));
      
      alert(`Token in localStorage: ${token ? 'Present' : 'Missing'}\n` +
            `Token has quotes: ${hasQuotes ? 'Yes' : 'No'}\n` +
            `Token in store: ${tokenInStore ? 'Present' : 'Missing'}\n` +
            `Store token has quotes: ${storeHasQuotes ? 'Yes' : 'No'}\n`);
    } catch (error) {
      alert('Error checking token: ' + error.message);
    }
  }
</script>

<div class="debug-panel">
  <h3>Auth Debug Info</h3>
  <ul>
    <li>Client ID: {clientId.substring(0, 4)}...</li>
    <li>Client Secret: {clientSecret ? 'Defined' : 'Not defined'}</li>
    <li>Redirect URI: {redirectUri}</li>
    <li>Spotify SDK Loaded: {sdkLoaded ? 'Yes' : 'No'}</li>
    <li>Local Storage: {localStorageAvailable ? 'Available' : 'Unavailable'}</li>
    <li>Code Verifier: {codeVerifier}</li>
    <li>Auth Token: {authToken}</li>
    <li>Is Authenticated: {$isAuthenticated ? 'Yes' : 'No'}</li>
    <li>Is Premium: {$isPremium ? 'Yes' : 'No'}</li>
    <li>Token from Store: {tokenFromStore || 'Empty'}</li>
    <li>Token from Storage: {tokenFromStorage || 'Empty'}</li>
  </ul>
  <div class="debug-actions">
    <button on:click={clearStorage}>Clear Storage</button>
    <button on:click={fixToken}>Fix Token</button>
    <button on:click={reportTokenStatus}>Check Token</button>
  </div>
</div>

<style>
  .debug-panel {
    position: fixed;
    bottom: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: #00ff00;
    font-family: monospace;
    padding: 15px;
    border-radius: 5px;
    font-size: 12px;
    max-width: 300px;
    z-index: 9999;
    border: 1px solid #00ff00;
  }

  h3 {
    margin-top: 0;
    margin-bottom: 10px;
    font-size: 14px;
  }

  ul {
    list-style-type: none;
    padding: 0;
    margin: 0;
  }

  li {
    margin-bottom: 5px;
  }

  .debug-actions {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  button {
    background: #333;
    color: #00ff00;
    border: 1px solid #00ff00;
    padding: 5px 10px;
    font-family: monospace;
    cursor: pointer;
    font-size: 12px;
  }

  button:hover {
    background: #444;
  }
</style>