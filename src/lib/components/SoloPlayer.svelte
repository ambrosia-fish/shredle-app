<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { accessToken } from '$lib/services/spotifyAuth';
  
  // Props
  export let spotifyId: string = '';
  export let startTimeMs: number = 0;
  export let clipDurationMs: number = 3000;
  
  // State
  let player: any = null;
  let deviceId: string = '';
  let isPlaying: boolean = false;
  let isReady: boolean = false;
  let isLoading: boolean = true;
  let isTrackLoaded: boolean = false;
  let error: string = '';
  let loadingMessage: string = 'Initializing player...';
  let loadingProgress: number = 0;
  
  // Track load timeout
  let loadTimeout: any = null;
  
  onMount(() => {
    console.log('Mounting SoloPlayer component...');
    // Load Spotify Web Player SDK
    loadSpotifySDK();
    
    // Set up loading animation
    startLoadingAnimation();
  });
  
  onDestroy(() => {
    console.log('Destroying SoloPlayer component...');
    if (player) {
      try {
        player.disconnect();
      } catch (e) {
        console.error('Error disconnecting player:', e);
      }
    }
    
    // Clear any timeouts
    if (loadTimeout) {
      clearTimeout(loadTimeout);
    }
  });
  
  function startLoadingAnimation() {
    // Simulate loading progress
    const interval = setInterval(() => {
      if (loadingProgress < 95 && isLoading) {
        // Slow down as we approach 95%
        const increment = loadingProgress < 50 ? 5 : (loadingProgress < 80 ? 2 : 1);
        loadingProgress += increment;
      } else if (isTrackLoaded) {
        loadingProgress = 100;
        clearInterval(interval);
      }
    }, 100);
    
    // Clean up interval on destroy
    onDestroy(() => {
      clearInterval(interval);
    });
  }
  
  function loadSpotifySDK() {
    try {
      // Check if SDK is already loaded
      if (window.Spotify && window.Spotify.Player) {
        console.log('Spotify SDK already loaded');
        initPlayer();
        return;
      }
      
      console.log('Loading Spotify SDK script...');
      // Load the SDK script
      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      
      script.onerror = () => {
        console.error('Failed to load Spotify Web Player SDK');
        error = 'Failed to load Spotify Web Player SDK';
        isLoading = false;
      };
      
      document.body.appendChild(script);
      
      // Set up SDK ready callback
      window.onSpotifyWebPlaybackSDKReady = () => {
        console.log('Spotify SDK ready');
        initPlayer();
      };
    } catch (err) {
      console.error('Error loading Spotify SDK:', err);
      error = `Failed to load Spotify player: ${err.message}`;
      isLoading = false;
    }
  }
  
  function initPlayer() {
    try {
      console.log('Initializing Spotify player...');
      
      // Get token from store
      const token = $accessToken;
      
      if (!token) {
        console.error('No access token available');
        error = 'No access token available';
        isLoading = false;
        return;
      }
      
      loadingMessage = 'Connecting to Spotify...';
      
      // Create hidden player instance
      player = new Spotify.Player({
        name: 'Guitar Solo Guesser',
        getOAuthToken: cb => cb(token),
        volume: 0.8
      });
      
      // Error handling
      player.addListener('initialization_error', ({ message }) => {
        console.error('Player initialization error:', message);
        error = `Player initialization error: ${message}`;
        isLoading = false;
      });
      
      player.addListener('authentication_error', ({ message }) => {
        console.error('Authentication error:', message);
        error = `Authentication error: ${message}`;
        isLoading = false;
      });
      
      player.addListener('account_error', ({ message }) => {
        console.error('Premium account required:', message);
        error = `Premium account required: ${message}`;
        isLoading = false;
      });
      
      player.addListener('playback_error', ({ message }) => {
        console.error('Playback error:', message);
        error = `Playback error: ${message}`;
      });
      
      // State change handler
      player.addListener('player_state_changed', state => {
        console.log('Player state changed:', state ? `paused: ${state.paused}` : 'no state');
        
        if (state) {
          isPlaying = !state.paused;
          
          // When we get a player state change, it means the track has loaded
          if (!isTrackLoaded) {
            console.log('Track loaded successfully');
            isTrackLoaded = true;
            loadingProgress = 100;
            isLoading = false;
          }
        }
      });
      
      // When player is ready
      player.addListener('ready', ({ device_id }) => {
        console.log('Player ready with device ID:', device_id);
        deviceId = device_id;
        isReady = true;
        
        // Only preload if we have a track ID
        if (spotifyId) {
          loadingMessage = 'Loading song...';
          preloadTrack();
          
          // Set a timeout for loading in case player_state_changed is never fired
          loadTimeout = setTimeout(() => {
            if (isLoading) {
              console.log('Force completing track load after timeout');
              // Force loading to complete after 5 seconds as a fallback
              isTrackLoaded = true;
              loadingProgress = 100;
              isLoading = false;
            }
          }, 5000);
        } else {
          isLoading = false;
        }
      });
      
      // Connect the player
      console.log('Connecting to Spotify player...');
      player.connect()
        .then(success => {
          if (!success) {
            console.error('Failed to connect to Spotify');
            error = 'Failed to connect to Spotify';
            isLoading = false;
          } else {
            console.log('Successfully connected to Spotify');
          }
        })
        .catch(err => {
          console.error('Connection error:', err);
          error = `Connection error: ${err.message}`;
          isLoading = false;
        });
        
    } catch (err) {
      console.error('Player initialization failed:', err);
      error = `Player initialization failed: ${err.message}`;
      isLoading = false;
    }
  }
  
  async function preloadTrack() {
    if (!isReady || !deviceId || !spotifyId) return;
    
    try {
      console.log(`Preloading track: ${spotifyId} at position: ${startTimeMs}ms`);
      await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify({
          uris: [`spotify:track:${spotifyId}`],
          position_ms: startTimeMs
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${$accessToken}`
        }
      });
      
      // Immediately pause after loading
      setTimeout(() => {
        player.pause();
      }, 100);
      
    } catch (err) {
      console.error('Error preloading track:', err);
      
      // Still allow playback attempt even if preload fails
      isTrackLoaded = true;
      loadingProgress = 100;
      isLoading = false;
    }
  }
  
  // Custom player controls
  async function playSolo() {
    if (!isReady || !deviceId || !spotifyId) return;
    
    try {
      console.log(`Playing solo: ${spotifyId} at position: ${startTimeMs}ms for ${clipDurationMs}ms`);
      
      // If we're already playing, reset to start position
      if (isPlaying) {
        await fetch(`https://api.spotify.com/v1/me/player/seek?device_id=${deviceId}&position_ms=${startTimeMs}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${$accessToken}`
          }
        });
        return;
      }
      
      // Start playback
      await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify({
          uris: [`spotify:track:${spotifyId}`],
          position_ms: startTimeMs
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${$accessToken}`
        }
      });
      
      isPlaying = true;
      
      // Set timer to pause after clip duration
      setTimeout(() => {
        if (isPlaying) {
          pauseSolo();
        }
      }, clipDurationMs);
      
    } catch (err) {
      console.error('Playback error:', err);
      error = `Playback error: ${err.message}`;
    }
  }
  
  function pauseSolo() {
    if (player && isPlaying) {
      console.log('Pausing playback');
      player.pause();
      isPlaying = false;
    }
  }
  
  function restartSolo() {
    console.log('Restarting solo');
    pauseSolo();
    setTimeout(() => {
      playSolo();
    }, 100);
  }
</script>

<div class="player-container">
  {#if isLoading}
    <div class="loading-container">
      <div class="loading-text">{loadingMessage}</div>
      <div class="progress-bar-container">
        <div class="progress-bar" style="width: {loadingProgress}%"></div>
      </div>
    </div>
  {:else if error}
    <div class="error">
      <p>{error}</p>
      <button on:click={() => window.location.reload()}>Try Again</button>
    </div>
  {:else if isReady}
    <div class="controls">
      <button 
        class="play-button" 
        on:click={isPlaying ? pauseSolo : playSolo}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {#if isPlaying}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
          </svg>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
          </svg>
        {/if}
      </button>
      
      <button 
        class="restart-button" 
        on:click={restartSolo}
        aria-label="Restart"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M12,4V1L8,5l4,4V6c3.31,0,6,2.69,6,6c0,1.01-0.25,1.97-0.7,2.8l1.46,1.46C19.54,15.03,20,13.57,20,12C20,7.58,16.42,4,12,4z M12,18c-3.31,0-6-2.69-6-6c0-1.01,0.25-1.97,0.7-2.8L5.24,7.74C4.46,8.97,4,10.43,4,12c0,4.42,3.58,8,8,8v3l4-4l-4-4V18z" />
        </svg>
      </button>
    </div>
    
    <div class="info">{clipDurationMs / 1000}s clip</div>
  {:else}
    <div class="error">
      <p>Unable to initialize player. Please make sure you have a Spotify Premium account.</p>
      <button on:click={() => window.location.reload()}>Try Again</button>
    </div>
  {/if}
</div>

<style>
  .player-container {
    margin: 2rem 0;
    text-align: center;
  }
  
  .controls {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
  }
  
  .play-button, .restart-button {
    display: flex;
    justify-content: center;
    align-items: center;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .play-button {
    background: #1DB954; /* Spotify green */
    color: white;
    width: 64px;
    height: 64px;
  }
  
  .restart-button {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    width: 40px;
    height: 40px;
  }
  
  .play-button:hover {
    background: #1ed760;
    transform: scale(1.05);
  }
  
  .restart-button:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.05);
  }
  
  .loading-container, .error {
    padding: 1rem;
    border-radius: 8px;
    margin: 1rem 0;
  }
  
  .loading-container {
    background-color: rgba(255, 255, 255, 0.1);
    width: 100%;
    max-width: 300px;
    margin: 0 auto;
  }
  
  .loading-text {
    margin-bottom: 10px;
    font-size: 0.9rem;
  }
  
  .progress-bar-container {
    height: 4px;
    background-color: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    overflow: hidden;
  }
  
  .progress-bar {
    height: 100%;
    background-color: #1DB954; /* Spotify green */
    transition: width 0.3s ease;
  }
  
  .error {
    color: #e74c3c;
    background-color: rgba(231, 76, 60, 0.1);
  }
  
  .info {
    margin-top: 1rem;
    font-size: 0.9rem;
    color: #999;
  }
</style>