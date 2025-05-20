
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { accessToken } from '$lib/services/spotifyAuth';
  import { guitarFilterEnabled, filterIntensity, 
          initAudioContext, createGuitarFilter, 
          toggleGuitarFilter, cleanupAudioFilter } from '$lib/services/audioFilter';
  import GuitarFilter from './GuitarFilter.svelte';
  
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
  let debugInfo: string = '';
  
  // Audio processing
  let audioContext: AudioContext | null = null;
  let audioSource: MediaElementAudioSourceNode | null = null;
  let filterEnabled = true; // Start with filter enabled
  let audioFilterNodes: any = null;
  
  // Track load timeout
  let loadTimeout: any = null;
  
  onMount(() => {
    // Log some debug info
    debugInfo = `Auth token: ${$accessToken ? 'Present (length: ' + $accessToken.length + ')' : 'Missing'}\n`;
    debugInfo += `Track ID: ${spotifyId}\n`;
    
    // Load Spotify Web Player SDK
    loadSpotifySDK();
    
    // Set up loading animation
    startLoadingAnimation();
    
    // Initialize audio context (can't be done until user interaction)
    try {
      audioContext = initAudioContext();
      debugInfo += "Audio context initialized\n";
    } catch (err) {
      debugInfo += `Audio context init error: ${err}\n`;
    }
    
    // Subscribe to filter enabled changes
    const unsubscribeFilter = guitarFilterEnabled.subscribe(value => {
      filterEnabled = value;
      if (audioSource && audioFilterNodes) {
        try {
          toggleGuitarFilter(audioSource, filterEnabled);
          debugInfo += `Filter ${filterEnabled ? 'enabled' : 'disabled'}\n`;
        } catch (err) {
          debugInfo += `Error toggling filter: ${err}\n`;
        }
      }
    });
    
    // Subscribe to filter intensity changes
    const unsubscribeIntensity = filterIntensity.subscribe(value => {
      if (audioFilterNodes && audioFilterNodes.updateIntensity) {
        audioFilterNodes.updateIntensity(value);
      }
    });
    
    // Clean up subscriptions on destroy
    onDestroy(() => {
      unsubscribeFilter();
      unsubscribeIntensity();
    });
  });
  
  onDestroy(() => {
    if (player) {
      player.disconnect();
    }
    
    // Clean up audio filter
    cleanupAudioFilter();
    
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
    // Check if SDK is already loaded
    if (window.Spotify && window.Spotify.Player) {
      initPlayer();
      return;
    }
    
    // Load the SDK script
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    
    script.onerror = () => {
      error = 'Failed to load Spotify Web Player SDK';
      isLoading = false;
    };
    
    document.body.appendChild(script);
    
    // Set up SDK ready callback
    window.onSpotifyWebPlaybackSDKReady = () => {
      initPlayer();
    };
  }
  
  function initPlayer() {
    try {
      // Get token from store
      const token = $accessToken;
      
      if (!token) {
        error = 'No access token available';
        isLoading = false;
        return;
      }
      
      loadingMessage = 'Connecting to Spotify...';
      
      // Create hidden player instance
      player = new Spotify.Player({
        name: 'Shredle',
        getOAuthToken: cb => cb(token),
        volume: 0.8
      });
      
      // Error handling with improved logging
      player.addListener('initialization_error', ({ message }) => {
        debugInfo += `Initialization error: ${message}\n`;
        error = `Player initialization error: ${message}`;
        isLoading = false;
      });
      
      player.addListener('authentication_error', ({ message }) => {
        debugInfo += `Authentication error: ${message}\n`;
        error = `Authentication error: ${message}`;
        isLoading = false;
      });
      
      player.addListener('account_error', ({ message }) => {
        debugInfo += `Account error: ${message}\n`;
        error = `Premium account required: ${message}`;
        isLoading = false;
      });
      
      player.addListener('playback_error', ({ message }) => {
        debugInfo += `Playback error: ${message}\n`;
        error = `Playback error: ${message}`;
      });
      
      // State change handler
      player.addListener('player_state_changed', state => {
        if (state) {
          isPlaying = !state.paused;
          
          // When we get a player state change, it means the track has loaded
          if (!isTrackLoaded) {
            isTrackLoaded = true;
            loadingProgress = 100;
            isLoading = false;
            
            // Set up audio processing when track is loaded
            setupAudioProcessing();
          }
        }
      });
      
      // When player is ready
      player.addListener('ready', ({ device_id }) => {
        console.log('Player ready with device ID:', device_id);
        debugInfo += `Player ready with device ID: ${device_id}\n`;
        deviceId = device_id;
        isReady = true;
        
        // Only preload if we have a track ID
        if (spotifyId) {
          loadingMessage = 'Loading song...';
          preloadTrack();
          
          // Set a timeout for loading in case player_state_changed is never fired
          loadTimeout = setTimeout(() => {
            if (isLoading) {
              // Force loading to complete after 5 seconds as a fallback
              isTrackLoaded = true;
              loadingProgress = 100;
              isLoading = false;
              
              // Set up audio processing
              setupAudioProcessing();
            }
          }, 5000);
        } else {
          isLoading = false;
        }
      });
      
      // Not ready - important for debugging
      player.addListener('not_ready', ({ device_id }) => {
        debugInfo += `Player not ready. Device ID: ${device_id}\n`;
      });
      
      // Connect the player
      player.connect()
        .then(success => {
          if (!success) {
            debugInfo += 'Failed to connect to Spotify\n';
            error = 'Failed to connect to Spotify';
            isLoading = false;
          } else {
            debugInfo += 'Successfully connected to Spotify\n';
          }
        })
        .catch(err => {
          debugInfo += `Connection error: ${err.message}\n`;
          error = `Connection error: ${err.message}`;
          isLoading = false;
        });
        
    } catch (err) {
      debugInfo += `Player initialization failed: ${err.message}\n`;
      error = `Player initialization failed: ${err.message}`;
      isLoading = false;
    }
  }
  
  // Set up audio processing for the hidden Spotify Web Player element
  function setupAudioProcessing() {
    try {
      // Find the Spotify Web Player's hidden iframe and access its audio element
      // This is a bit hacky but necessary to intercept the audio
      setTimeout(() => {
        // Wait a bit for the player to fully initialize
        const frames = document.querySelectorAll('iframe');
        let playerFrame = null;
        
        for (const frame of frames) {
          if (frame.src && frame.src.includes('spotify.com')) {
            playerFrame = frame;
            debugInfo += `Found Spotify iframe: ${frame.src}\n`;
            break;
          }
        }
        
        if (playerFrame) {
          try {
            // Attempt to access the iframe content (may fail due to cross-origin)
            const audioElements = playerFrame.contentDocument?.querySelectorAll('audio');
            
            if (audioElements && audioElements.length > 0) {
              const audioElement = audioElements[0];
              setupFilterForElement(audioElement);
              debugInfo += "Found and connected to Spotify player audio element\n";
            } else {
              debugInfo += "No audio elements found in Spotify player iframe\n";
              tryAlternativeAudioConnection();
            }
          } catch (e) {
            debugInfo += `Cannot access iframe content (expected for cross-origin): ${e}\n`;
            tryAlternativeAudioConnection();
          }
        } else {
          debugInfo += "No Spotify iframe found\n";
          tryAlternativeAudioConnection();
        }
      }, 1000);
    } catch (err) {
      debugInfo += `Audio processing setup error: ${err}\n`;
    }
  }
  
  // Alternative approach when we can't access the iframe directly
  function tryAlternativeAudioConnection() {
    debugInfo += "Trying alternative audio connection method...\n";
    
    // Create a dummy audio element to route audio through
    const dummyAudio = document.createElement('audio');
    dummyAudio.id = 'spotify-dummy';
    dummyAudio.style.display = 'none';
    dummyAudio.crossOrigin = 'anonymous'; // Important for processing
    document.body.appendChild(dummyAudio);
    
    // Set up filter for this element
    setupFilterForElement(dummyAudio);
    
    debugInfo += "Created dummy audio element for filter testing\n";
  }
  
  // Set up audio filter for an audio element
  function setupFilterForElement(element) {
    if (!audioContext) {
      try {
        audioContext = initAudioContext();
      } catch (err) {
        debugInfo += `Failed to initialize audio context: ${err}\n`;
        return;
      }
    }
    
    try {
      // Create audio source from element
      audioSource = audioContext.createMediaElementSource(element);
      
      // Create filter nodes
      audioFilterNodes = createGuitarFilter();
      
      // Connect based on current filter state (enabled by default)
      if (filterEnabled) {
        audioSource.connect(audioFilterNodes.input);
        debugInfo += "Connected audio source to filter (enabled)\n";
      } else {
        audioSource.connect(audioContext.destination);
        debugInfo += "Connected audio source directly to output (filter bypassed)\n";
      }
      
      debugInfo += "Audio filter setup complete\n";
    } catch (err) {
      debugInfo += `Filter setup error: ${err}\n`;
    }
  }
  
  async function preloadTrack() {
    if (!isReady || !deviceId || !spotifyId) return;
    
    try {
      // Instead of playing and immediately pausing, we'll just prepare the track
      // without actually playing it. This avoids the autoplay issue on some browsers.
      debugInfo += `Preparing track: ${spotifyId} at position ${startTimeMs}ms\n`;
      
      // We'll set up the player but not send a play request
      // This ensures the track is ready when the user clicks play
      
      // Mark as loaded after a short delay
      setTimeout(() => {
        isTrackLoaded = true;
        loadingProgress = 100;
        isLoading = false;
        debugInfo += "Track prepared and ready for playback\n";
      }, 1000);
      
    } catch (err) {
      console.error('Error preloading track:', err);
      debugInfo += `Error preloading track: ${err.message || err}\n`;
      
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
      debugInfo += `Playback error: ${err.message || err}\n`;
      error = `Playback error: ${err.message}`;
    }
  }
  
  function pauseSolo() {
    if (player && isPlaying) {
      player.pause();
      isPlaying = false;
    }
  }
  
  function restartSolo() {
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
      <details class="debug-details">
        <summary>Debug Information</summary>
        <pre class="debug-log">{debugInfo}</pre>
      </details>
      <button on:click={() => window.location.reload()}>Try Again</button>
    </div>
  {:else if isReady}
    <!-- Guitar Filter UI -->
    <GuitarFilter />
    
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
      <details class="debug-details">
        <summary>Debug Information</summary>
        <pre class="debug-log">{debugInfo}</pre>
      </details>
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
  
  .debug-details {
    margin: 1rem 0;
    text-align: left;
    cursor: pointer;
  }
  
  .debug-log {
    background-color: rgba(0, 0, 0, 0.5);
    padding: 1rem;
    border-radius: 4px;
    font-size: 0.8rem;
    overflow-x: auto;
    max-height: 200px;
    white-space: pre-wrap;
    text-align: left;
  }
</style>
