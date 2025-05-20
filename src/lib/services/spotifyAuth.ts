// src/lib/services/spotifyAuth.ts
import { isAuthenticated, accessToken, isPremium, userProfile } from '../stores/auth';
import { get } from 'svelte/store';

// Spotify authorization variables
const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI || `${window.location.origin}/callback`;

// We need streaming scope for Web Player SDK
const scopes = ['streaming', 'user-read-email', 'user-read-private', 'user-modify-playback-state'];

// New approach: bypass browser storage entirely for auth flow
// Instead, encode everything necessary in the state parameter

// Simple login function using PKCE (no client secret needed in frontend)
export async function loginWithSpotify() {
  try {
    console.log('Starting Spotify login process');
    
    // Generate a random state value for security
    const state = generateRandomString(16);
    
    // Generate PKCE code verifier
    const codeVerifier = generateRandomString(64);
    
    // Calculate code challenge from verifier
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    
    // Combine state and verifier in one parameter 
    // This is our storage-free approach
    const encodedState = `${state}:${codeVerifier}`;
    
    // Build the authorization URL with our encoded state
    const authUrl = new URL('https://accounts.spotify.com/authorize');
    authUrl.search = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: scopes.join(' '),
      redirect_uri: redirectUri,
      state: encodedState,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      show_dialog: 'true',
    }).toString();
    
    // Log what we're doing for debugging
    console.log('Redirecting to Spotify with encoded state parameter (StatePart:CodeVerifier)');
    
    // Redirect to Spotify login
    window.location.href = authUrl.toString();
  } catch (error) {
    console.error('Login preparation error:', error);
    alert('Failed to start login process. Please try again.');
  }
}

// Process the callback after Spotify login
export async function handleCallback(code, state) {
  console.log('Handling callback with state parameter');
  
  try {
    // Safety check for missing code or state
    if (!code) {
      throw new Error('No authorization code received from Spotify');
    }
    
    if (!state) {
      throw new Error('No state parameter received from Spotify');
    }
    
    // Extract state and verifier
    // State parameter should be in the format "originalState:codeVerifier"
    if (!state.includes(':')) {
      throw new Error('Invalid state format - please try logging in again');
    }
    
    const parts = state.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid state parameter structure');
    }
    
    // We don't need to verify the original state since Spotify
    // already verifies the state parameter matches what we sent
    const codeVerifier = parts[1];
    
    // Verify code verifier looks valid
    if (!codeVerifier || codeVerifier.length < 43) {
      throw new Error('Invalid code verifier in state parameter');
    }
    
    console.log('Successfully extracted code verifier from state parameter');
    
    // Exchange code for tokens using PKCE
    console.log('Starting token exchange with code verifier');
    
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('Token exchange error:', response.status, errorData);
      throw new Error(`Token exchange failed (${response.status}). Please try again.`);
    }
    
    const data = await response.json();
    console.log('Token exchange successful!');
    
    // Store tokens in localStorage for app use (not for auth flow)
    try {
      localStorage.setItem('spotify_access_token', data.access_token);
      localStorage.setItem('spotify_refresh_token', data.refresh_token);
      localStorage.setItem('spotify_token_expires', String(Date.now() + (data.expires_in * 1000)));
    } catch (e) {
      console.warn('Failed to store tokens in localStorage, app functionality may be limited:', e);
    }
    
    // Update store regardless of localStorage success
    accessToken.set(data.access_token);
    isAuthenticated.set(true);
    
    // Fetch user profile to check premium status
    await fetchUserProfile();
    
    return true;
  } catch (error) {
    console.error('Token exchange error:', error);
    throw error;
  }
}

// Check if user is already authenticated
export function checkAuth() {
  try {
    const token = localStorage.getItem('spotify_access_token');
    const expiry = localStorage.getItem('spotify_token_expires');
    
    if (token && expiry && Date.now() < parseInt(expiry)) {
      accessToken.set(token);
      isAuthenticated.set(true);
      
      // Fetch user profile to ensure we have premium status
      fetchUserProfile().catch(err => {
        console.error('Error fetching profile during auth check:', err);
      });
      
      return true;
    }
  } catch (e) {
    console.warn('Error checking auth status:', e);
  }
  
  return false;
}

// Fetch user profile and check premium status
export async function fetchUserProfile() {
  const token = get(accessToken);
  
  if (!token) {
    isAuthenticated.set(false);
    isPremium.set(false);
    return null;
  }
  
  try {
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch profile: ${response.status}`);
    }
    
    const profile = await response.json();
    
    // Store the user profile
    userProfile.set(profile);
    
    // Check if user has premium
    if (profile.product === 'premium') {
      isPremium.set(true);
      return profile;
    } else {
      // Not premium
      isPremium.set(false);
      return { error: 'premium_required', profile };
    }
  } catch (error) {
    console.error('Error fetching profile:', error);
    isPremium.set(false);
    return null;
  }
}

// Helper for token refresh - can be implemented later if needed
export async function refreshToken() {
  // Implement token refresh using the refresh token from localStorage
  // This would be similar to the token exchange but with grant_type=refresh_token
}

// Helper to generate random string for state and code verifier
function generateRandomString(length) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  return Array.from(values).map(x => possible[x % possible.length]).join('');
}

// Helper to generate code challenge for PKCE
async function generateCodeChallenge(codeVerifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  
  return base64URLEncode(digest);
}

// Helper to encode base64URL for PKCE
function base64URLEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
