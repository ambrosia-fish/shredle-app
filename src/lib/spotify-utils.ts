// src/lib/spotify-utils.ts

/**
 * Utility functions for Spotify Web Playback SDK
 */

/**
 * Check if user is on a mobile browser
 */
export function isMobile(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Check if user has Spotify Premium (this requires calling the API)
 * But we can't really check this without making an API call, so this is placeholder
 */
export function isPremiumRequired(): boolean {
  return true; // Web Playback SDK always requires Premium
}

/**
 * Helper to activate element for mobile browsers
 * Should be called in response to user interaction
 */
export async function activatePlayerForMobile(player: any): Promise<void> {
  if (isMobile() && player && typeof player.activateElement === 'function') {
    try {
      await player.activateElement();
      console.log('Player activated for mobile browser');
    } catch (error) {
      console.warn('Failed to activate player for mobile:', error);
    }
  }
}

/**
 * Get user-friendly error messages for common Spotify errors
 */
export function getSpotifyErrorMessage(error: string): string {
  const errorMap: Record<string, string> = {
    'Premium required': 'Spotify Premium subscription is required to use this feature.',
    'Authentication error': 'Please log in to Spotify again.',
    'Initialization error': 'Failed to initialize Spotify player. Please refresh the page.',
    'No Spotify token available': 'Please log in to Spotify to continue.',
    'Failed to connect Spotify player': 'Could not connect to Spotify. Please check your internet connection.',
  };

  // Check if error contains any known patterns
  for (const [pattern, message] of Object.entries(errorMap)) {
    if (error.toLowerCase().includes(pattern.toLowerCase())) {
      return message;
    }
  }

  return 'An error occurred with Spotify. Please try again.';
}
