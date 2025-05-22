// src/lib/spotify-playback.ts
import { getSpotifyToken } from './spotify';

interface PlaybackOptions {
  deviceId: string;
  spotifyTrackId: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
}

/**
 * Play a specific segment of a Spotify track
 */
export async function playTrackSegment(options: PlaybackOptions): Promise<void> {
  const { deviceId, spotifyTrackId, startTime, endTime } = options;
  const token = getSpotifyToken();
  
  if (!token) {
    throw new Error('No Spotify access token available');
  }

  const spotifyUri = `spotify:track:${spotifyTrackId}`;
  const startPositionMs = Math.floor(startTime * 1000);
  
  try {
    console.log(`Playing track ${spotifyTrackId} from ${startTime}s to ${endTime}s on device ${deviceId}`);
    
    // Start playback at the specified position
    const playResponse = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        uris: [spotifyUri],
        position_ms: startPositionMs
      })
    });

    if (!playResponse.ok) {
      const errorText = await playResponse.text();
      console.error('Spotify play API error:', errorText);
      throw new Error(`Failed to start playback: ${playResponse.status} ${errorText}`);
    }

    console.log('Playback started successfully');

    // Stop playback after the segment duration
    const segmentDuration = (endTime - startTime) * 1000; // Convert to milliseconds
    setTimeout(async () => {
      try {
        const pauseResponse = await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (pauseResponse.ok) {
          console.log('Playback stopped after segment duration');
        }
      } catch (error) {
        console.warn('Failed to stop playback:', error);
      }
    }, segmentDuration);

  } catch (error) {
    console.error('Error playing track segment:', error);
    throw error;
  }
}

/**
 * Transfer playback to our web player device
 */
export async function transferPlaybackToDevice(deviceId: string): Promise<void> {
  const token = getSpotifyToken();
  
  if (!token) {
    throw new Error('No Spotify access token available');
  }

  try {
    const response = await fetch('https://api.spotify.com/v1/me/player', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        device_ids: [deviceId],
        play: false // Don't start playing immediately
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Transfer playback error:', errorText);
      throw new Error(`Failed to transfer playback: ${response.status}`);
    }

    console.log('Playback transferred to web player');
  } catch (error) {
    console.error('Error transferring playback:', error);
    throw error;
  }
}

/**
 * Get current playback state
 */
export async function getCurrentPlaybackState(): Promise<any> {
  const token = getSpotifyToken();
  
  if (!token) {
    throw new Error('No Spotify access token available');
  }

  try {
    const response = await fetch('https://api.spotify.com/v1/me/player', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.status === 204) {
      // No active device
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to get playback state: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting playback state:', error);
    throw error;
  }
}
