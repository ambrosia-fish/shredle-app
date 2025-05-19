<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { accessToken } from '$lib/stores/auth';
  import { get } from 'svelte/store';
  
  // Props
  export let spotifyId: string = '';
  export let startTimeMs: number = 0;
  export const endTimeMs: number = 0; // Changed to const as it's unused
  export let clipDurationMs: number = 3000;

  // State
  let player: any;
  let deviceId: string = '';
  let isPlaying: boolean = false;
  let isReady: boolean = false;
  let isLoading: boolean = true;
  let error: string = '';
  
  onMount(() => {
    console.log('SoloPlayer mounted, waiting for SDK...');
    
    // Fix: Add a small delay to ensure the SDK is fully loaded
    setTimeout(() => {
      // Check if window.Spotify is defined
      if (window.Spotify) {
        console.log('Spotify SDK already loaded');
        initializePlayer();
      } else if (window.SpotifyPlayerSDKReady) {
        console.log('Spotify SDK ready flag is set');
        initializePlayer();
      } else {
        console.log('Setting up onSpotifyWebPlaybackSDKReady callback');
        // Set up the callback for when the SDK loads
        window.onSpotifyWebPlaybackSDKReady = () => {
          console.log('onSpotifyWebPlaybackSDKReady called');
          window.SpotifyPlayerSDKReady = true;
          initializePlayer();
        };
      }
    }, 1000); // 1 second delay
  });
  
  onDestroy(() => {
    if (player) {
      console.log('Disconnecting Spotify player');
      player.disconnect();
    }
  });
  
  function initializePlayer() {
    try {
      console.log('Initializing Spotify player...');
      const token = get(accessToken);
      console.log('Access token available:', !!token);
      
      if (!token) {
        error = 'No access token available. Please log in again.';
        isLoading = false;
        return;
      }
      
      // Fix: Make sure token is passed correctly without quotes
      player = new window.Spotify.Player({
        name: 'Guitar Solo Guesser',
        getOAuthToken: cb => { 
          // Pass the token directly without any manipulation
          console.log('Token provided to SDK:', token ? 'Token available' : 'No token');
          cb(token); 
        }
      });
      
      // Error handling
      player.addListener('initialization_error', ({ message }: { message: string }) => {
        console.error('Initialization error:', message);
        error = `Initialization error: ${message}`;
        isLoading = false;
      });
      
      player.addListener('authentication_error', ({ message }: { message: string }) => {
        console.error('Authentication error:', message);
        error = `Authentication error: ${message}`;
        isLoading = false;
      });
      
      player.addListener('account_error', ({ message }: { message: string }) => {
        console.error('Account error (Premium required):', message);
        error = `Account error: ${message}. Premium subscription is required.`;
        isLoading = false;
      });
      
      player.addListener('playback_error', ({ message }: { message: string }) => {
        console.error('Playback error:', message);
        error = `Playback error: ${message}`;
      });
      
      // Playback status updates
      player.addListener('player_state_changed', (state: any) => {
        console.log('Player state changed:', state ? 'State available' : 'No state');
        if (state) {
          isPlaying = !state.paused;
          
          // Auto-stop after duration
          if (isPlaying && clipDurationMs > 0) {
            console.log(`Setting auto-pause after ${clipDurationMs}ms`);
            setTimeout(() => {
              pauseSolo();
            }, clipDurationMs);
          }
        }
      });
      
      // Ready
      player.addListener('ready', ({ device_id }: { device_id: string }) => {
        console.log('Spotify player ready with Device ID:', device_id);
        deviceId = device_id;
        isReady = true;
        isLoading = false;
        
        // Pre-load the track
        if (spotifyId) {
          console.log('Preloading track:', spotifyId);
          preloadTrack();
        }
      });
      
      player.addListener('not_ready', ({ device_id }: { device_id: string }) => {
        console.log('Device has gone offline:', device_id);
        isReady = false;
      });
      
      // Connect to the player
      console.log('Connecting to Spotify player...');
      player.connect().then((success: boolean) => {
        if (success) {
          console.log('Connected to Spotify successfully');
        } else {
          console.error('Failed to connect to Spotify');
          error = 'Failed to connect to Spotify';
          isLoading = false;
        }
      }).catch((e: any) => {
        console.error('Error connecting to Spotify:', e);
        error = `Connection error: ${e.message || 'Unknown error'}`;
        isLoading = false;
      });
    } catch (err) {
      console.error('Error initializing player:', err);
      error = `Error initializing player: ${err.message}`;
      isLoading = false;
    }
  }
  
  async function preloadTrack() {
    if (!isReady || !deviceId || !spotifyId) {
      console.warn('Cannot preload track: player not ready, no device ID, or no track ID');
      return;
    }
    
    try {
      console.log(`Preloading track ${spotifyId} at position ${startTimeMs}ms`);
      const token = get(accessToken);
      
      const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify({
          uris: [`spotify:track:${spotifyId}`],
          position_ms: startTimeMs
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const responseData = await response.text();
        console.error('Error response from Spotify API:', response.status, responseData);
        throw new Error(`API returned ${response.status}: ${responseData}`);
      }
      
      console.log('Track loaded successfully, pausing in 100ms');
      // Immediately pause after loading
      setTimeout(() => {
        player.pause();
      }, 100);
      
    } catch (error) {
      console.error('Error preloading track:', error);
      this.error = `Error preloading track: ${error.message}`;
    }
  }
  
  async function playSolo() {
    if (!isReady || !deviceId || !spotifyId) {
      console.warn('Cannot play: player not ready, no device ID, or no track ID');
      return;
    }
    
    try {
      console.log(`Playing track ${spotifyId} from position ${startTimeMs}ms`);
      const token = get(accessToken);
      
      const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify({
          uris: [`spotify:track:${spotifyId}`],
          position_ms: startTimeMs
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const responseData = await response.text();
        console.error('Error response from play API:', response.status, responseData);
        throw new Error(`API returned ${response.status}: ${responseData}`);
      }
      
      console.log('Track playing');
      isPlaying = true;
      
    } catch (error) {
      console.error('Error playing track:', error);
      this.error = `Error playing track: ${error.message}`;
    }
  }
  
  function pauseSolo() {
    if (player) {
      console.log('Pausing playback');
      player.pause();
      isPlaying = false;
    }
  }
  
  // Update when props change
  $: if (spotifyId && isReady && !isLoading) {
    console.log('Track ID changed, preloading new track');
    preloadTrack();
  }
  
  // Format time (for display)
  function formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
</script>

<div class="player-container">
  {#if isLoading}
    <div class="loading">Loading player...</div>
  {:else if error}
    <div class="error">
      <p>{error}</p>
      <button on:click={() => window.location.reload()}>Try Again</button>
    </div>
  {:else if isReady}
    <button class="play-button" on:click={isPlaying ? pauseSolo : playSolo}>
      {isPlaying ? 'Pause' : 'Play Solo'}
    </button>
    
    <div class="info">
      <div class="clip-info">
        {clipDurationMs / 1000}s clip
      </div>
    </div>
  {:else}
    <div class="error">
      <p>Unable to initialize Spotify player. Please make sure you have a Premium account.</p>
      <button on:click={() => window.location.reload()}>Try Again</button>
    </div>
  {/if}
</div>

<style>
  .player-container {
    margin: 2rem 0;
    text-align: center;
  }
  
  .play-button {
    background: var(--primary-color);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 50px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 1.2rem;
  }
  
  .play-button:hover {
    background: #1ed760;
    transform: scale(1.05);
  }
  
  .loading, .error {
    padding: 1rem;
    border-radius: 8px;
    background-color: rgba(255, 255, 255, 0.1);
    margin: 1rem 0;
  }
  
  .error {
    color: #e74c3c;
    background-color: rgba(231, 76, 60, 0.1);
  }
  
  .info {
    margin-top: 1rem;
    font-size: 0.9rem;
    color: var(--secondary-color);
  }
</style>