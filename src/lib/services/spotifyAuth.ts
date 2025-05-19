// src/lib/services/spotifyAuth.ts
import { isAuthenticated, userProfile, accessToken, isPremium } from '../stores/auth';
import { get } from 'svelte/store';

// Get client ID from environment variable
const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI || `${window.location.origin}/callback`;

// Generate a random string for PKCE
function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values).map(x => possible[x % possible.length]).join('');
}

// Helper to generate code challenge for PKCE
async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// Start Spotify login flow
export async function loginWithSpotify(): Promise<void> {
  try {
    console.log('Starting Spotify login process');
    
    // Clear any previous auth data
    localStorage.removeItem('code_verifier');
    
    // PKCE challenge
    const codeVerifier = generateRandomString(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    
    // Store code verifier for later exchange
    localStorage.setItem('code_verifier', codeVerifier);
    
    // Add small delay to ensure localStorage is written before redirect
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify the code verifier was actually stored
    const storedVerifier = localStorage.getItem('code_verifier');
    if (!storedVerifier) {
      // If storage failed, stop and show an error
      alert('Browser storage is not working properly. Please check your privacy settings and try again.');
      return;
    }
    
    // Auth parameters
    const scope = 'streaming user-read-email user-read-private user-modify-playback-state';
    const authUrl = new URL('https://accounts.spotify.com/authorize');
    
    // Add state parameter for extra security
    const state = generateRandomString(16);
    localStorage.setItem('spotify_auth_state', state);
    
    // Add parameters
    const params = {
      response_type: 'code',
      client_id: clientId,
      scope,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      redirect_uri: redirectUri,
      state, // Add state parameter
      show_dialog: 'true',
    };
    
    authUrl.search = new URLSearchParams(params).toString();
    
    // Redirect to Spotify auth page
    window.location.href = authUrl.toString();
  } catch (error) {
    console.error('Login preparation error:', error);
    alert('Failed to start login process. Please try again.');
  }
}

// Exchange code for tokens after redirect
export async function handleCallback(code: string): Promise<boolean> {
  try {
    // Check state parameter if present
    const url = new URL(window.location.href);
    const returnedState = url.searchParams.get('state');
    const originalState = localStorage.getItem('spotify_auth_state');
    
    if (returnedState && originalState && returnedState !== originalState) {
      throw new Error('State mismatch - possible security issue');
    }
    
    const codeVerifier = localStorage.getItem('code_verifier');
    
    console.log('Code verifier:', codeVerifier ? 'exists' : 'missing');
    
    if (!codeVerifier) {
      // Fallback mechanism - try to recover session
      localStorage.clear(); // Clear potentially corrupted state
      throw new Error('No stored state found - the authorization session may have expired or been cleared');
    }
    
    const tokenUrl = 'https://accounts.spotify.com/api/token';
    const payload = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    };
    
    console.log('Token request payload:', {
      client_id: clientId,
      redirect_uri: redirectUri,
      code_verifier_length: codeVerifier.length,
    });
    
    const response = await fetch(tokenUrl, payload);
    console.log('Token response status:', response.status);
    
    const data = await response.json();
    console.log('Token response:', data.error || 'Success');
    
    if (data.access_token) {
      // Store tokens
      localStorage.setItem('spotify_access_token', data.access_token);
      localStorage.setItem('spotify_refresh_token', data.refresh_token);
      localStorage.setItem('spotify_token_expiry', String(Date.now() + (data.expires_in * 1000)));
      
      // Clear PKCE and state data
      localStorage.removeItem('code_verifier');
      localStorage.removeItem('spotify_auth_state');
      
      // Update store
      accessToken.set(data.access_token);
      
      // Get user profile and check premium
      await fetchUserProfile();
      
      return true;
    }
    
    // If we get here, something went wrong
    throw new Error(data.error_description || data.error || 'Authentication failed');
  } catch (error) {
    console.error('Token exchange error:', error);
    throw error;
  }
}

// Get user profile and check premium status
export async function fetchUserProfile(): Promise<any> {
  const token = get(accessToken);
  
  if (!token) {
    isAuthenticated.set(false);
    return null;
  }
  
  try {
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const profile = await response.json();
    
    // Check if user has premium
    if (profile.product === 'premium') {
      userProfile.set(profile);
      isAuthenticated.set(true);
      isPremium.set(true);
      return profile;
    } else {
      // Not premium
      userProfile.set(profile);
      isAuthenticated.set(true);
      isPremium.set(false);
      return { error: 'premium_required' };
    }
  } catch (error) {
    console.error('Error fetching profile:', error);
    isAuthenticated.set(false);
    return null;
  }
}

// Refresh access token when expired
export async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem('spotify_refresh_token');
  
  if (!refreshToken) return false;
  
  const payload = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    }),
  };
  
  try {
    const response = await fetch('https://accounts.spotify.com/api/token', payload);
    const data = await response.json();
    
    if (data.access_token) {
      localStorage.setItem('spotify_access_token', data.access_token);
      localStorage.setItem('spotify_token_expiry', String(Date.now() + (data.expires_in * 1000)));
      
      if (data.refresh_token) {
        localStorage.setItem('spotify_refresh_token', data.refresh_token);
      }
      
      accessToken.set(data.access_token);
      return true;
    }
  } catch (error) {
    console.error('Error refreshing token:', error);
  }
  
  return false;
}

// Check if token needs refresh
export function checkAuthStatus(): boolean {
  const expiry = localStorage.getItem('spotify_token_expiry');
  const token = localStorage.getItem('spotify_access_token');
  
  if (!token || !expiry) {
    isAuthenticated.set(false);
    return false;
  }
  
  // If token expired, refresh it
  if (Date.now() > parseInt(expiry) - 300000) { // 5 min buffer
    refreshAccessToken();
  } else {
    accessToken.set(token);
    isAuthenticated.set(true);
    fetchUserProfile();
  }
  
  return true;
}

// Logout function
export function logout(): void {
  localStorage.removeItem('spotify_access_token');
  localStorage.removeItem('spotify_refresh_token');
  localStorage.removeItem('spotify_token_expiry');
  localStorage.removeItem('code_verifier');
  localStorage.removeItem('spotify_auth_state');
  
  isAuthenticated.set(false);
  userProfile.set(null);
  accessToken.set('');
  isPremium.set(false);
}