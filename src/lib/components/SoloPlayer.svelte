<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { accessToken } from '$lib/stores/auth';
  import { get } from 'svelte/store';
  
  // Props
  export let spotifyId: string = '';
  export let startTimeMs: number = 0;
  export let endTimeMs: number = 0;
  export let clipDurationMs: number = 3000;

  // State
  let player: any;
  let deviceId: string = '';
  let isPlaying: boolean = false;
  let isReady: boolean = false;
  let isLoading: boolean = true;
  
  onMount(() => {
  // Replace the global callback with our implementation
  if (window.SpotifyPlayerSDKReady) {
    // SDK is already loaded and ready
    initializePlayer();
  } else {
    // SDK is not yet ready, set up the callback
    window.onSpotifyWebPlaybackSDKReady = () => {
      window.SpotifyPlayerSDKReady = true;
      initializePlayer();
    };
  }
});
  
  onDestroy(() => {
    if (player) {
      player.disconnect();
    }
  });
  
  function initializePlayer() {
    player = new window.Spotify.Player({
      name: 'Guitar Solo Guesser',
      getOAuthToken: cb => { cb(get(accessToken)); }
    });
    
    // Error handling
    player.addListener('initialization_error', ({ message }: { message: string }) => {
      console.error('Initialization error:', message);
    });
    
    player.addListener('authentication_error', ({ message }: { message: string }) => {
      console.error('Authentication error:', message);
    });
    
    player.addListener('account_error', ({ message }: { message: string }) => {
      console.error('Account error (Premium required):', message);
    });
    
    player.addListener('playback_error', ({ message }: { message: string }) => {
      console.error('Playback error:', message);
    });
    
    // Playback status updates
    player.addListener('player_state_changed', (state: any) => {
      if (state) {
        isPlaying = !state.paused;
        
        // Auto-stop after duration
        if (isPlaying && clipDurationMs > 0) {
          setTimeout(() => {
            pauseSolo();
          }, clipDurationMs);
        }
      }
    });
    
    // Ready
    player.addListener('ready', ({ device_id }: { device_id: string }) => {
      console.log('Ready with Device ID', device_id);
      deviceId = device_id;
      isReady = true;
      isLoading = false;
      
      // Pre-load the track
      if (spotifyId) {
        preloadTrack();
      }
    });
    
    // Connect to the player
    player.connect();
  }
  
  async function preloadTrack() {
    if (!isReady || !deviceId || !spotifyId) return;
    
    try {
      await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify({
          uris: [`spotify:track:${spotifyId}`],
          position_ms: startTimeMs
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${get(accessToken)}`
        }
      });
      
      // Immediately pause after loading
      setTimeout(() => {
        player.pause();
      }, 100);
      
    } catch (error) {
      console.error('Error preloading track:', error);
    }
  }
  
  async function playSolo() {
    if (!isReady || !deviceId || !spotifyId) return;
    
    try {
      await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify({
          uris: [`spotify:track:${spotifyId}`],
          position_ms: startTimeMs
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${get(accessToken)}`
        }
      });
      
      isPlaying = true;
      
    } catch (error) {
      console.error('Error playing track:', error);
    }
  }
  
  function pauseSolo() {
    if (player) {
      player.pause();
      isPlaying = false;
    }
  }
  
  // Update when props change
  $: if (spotifyId && isReady && !isLoading) {
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