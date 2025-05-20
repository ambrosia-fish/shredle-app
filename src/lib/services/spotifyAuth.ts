// src/lib/services/spotifyAuth.ts
import { isAuthenticated, accessToken, isPremium, userProfile } from '../stores/auth';
import { get } from 'svelte/store';

// Spotify authorization variables
// Use defaults if environment variables aren't set
const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID || '';
const redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI || `${window.location.origin}/callback`;

// Log configuration info for debugging
console.log('Spotify Auth Configuration:', {
  clientId: clientId ? 'Set' : 'Not set',
  redirectUri
});

// We need these scopes for the Web Player SDK
const scopes = ['streaming', 'user-read-email', 'user-read-private', 'user-modify-playback-state'];

// Simple login function using PKCE (no client secret needed in frontend)
export async function loginWithSpotify() {
  try {
    console.log('Starting Spotify login process');
    
    if (!clientId) {
      throw new Error('Spotify Client ID is not configured. Please check your environment variables.');
    }
    
    // Generate a random state value for security
    const state = generateRandomString(16);
    
    // Generate PKCE code verifier
    const codeVerifier = generateRandomString(64);
    
    // Calculate code challenge from verifier
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    
    // Store these values in localStorage for the callback
    localStorage.setItem('spotify_auth_state', state);
    localStorage.setItem('code_verifier', codeVerifier);
    
    // Add small delay to ensure storage is written
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify storage worked
    const storedVerifier = localStorage.getItem('code_verifier');
    const storedState = localStorage.getItem('spotify_auth_state');
    
    if (!storedVerifier || !storedState) {
      throw new Error('Browser storage is not working. Please check your privacy settings and try again.');
    }
    
    // Build the authorization URL
    const authUrl = new URL('https://accounts.spotify.com/authorize');
    authUrl.search = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: scopes.join(' '),
      redirect_uri: redirectUri,
      state: state,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      show_dialog: 'true',
    }).toString();
    
    console.log('Redirecting to Spotify login');
    
    // Redirect to Spotify login
    window.location.href = authUrl.toString();
  } catch (error) {
    console.error('Login preparation error:', error);
    alert('Failed to start login process: ' + (error.message || 'Unknown error'));
  }
}

// Process the callback after Spotify login
export async function handleCallback(code, state = null) {
  console.log('Handling callback', { code: !!code, state: !!state });
  
  try {
    // Safety check for missing code
    if (!code) {
      throw new Error('No authorization code received from Spotify');
    }
    
    // Get the code verifier from localStorage
    const codeVerifier = localStorage.getItem('code_verifier');
    
    if (!codeVerifier) {
      throw new Error('No code verifier found - the authentication session may have expired');
    }
    
    // Validate state if provided
    if (state) {
      const storedState = localStorage.getItem('spotify_auth_state');
      if (storedState && state !== storedState) {
        throw new Error('State mismatch - possible security issue');
      }
    }
    
    console.log('Starting token exchange with code verifier');
    
    // Exchange code for tokens
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
      const errorText = await response.text();
      console.error('Token exchange HTTP error:', response.status, errorText);
      throw new Error(`Token exchange failed (${response.status}). Please try again.`);
    }
    
    const data = await response.json();
    
    if (!data.access_token) {
      console.error('No access token in response:', data);
      throw new Error('No access token received from Spotify');
    }
    
    console.log('Token exchange successful!');
    
    // Store tokens in localStorage
    try {
      localStorage.setItem('spotify_access_token', data.access_token);
      localStorage.setItem('spotify_refresh_token', data.refresh_token);
      localStorage.setItem('spotify_token_expires', String(Date.now() + (data.expires_in * 1000)));
      
      // Clean up PKCE and state values
      localStorage.removeItem('code_verifier');
      localStorage.removeItem('spotify_auth_state');
    } catch (e) {
      console.warn('Failed to store tokens in localStorage:', e);
    }
    
    // Update stores
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
    
    if (!token || !expiry) {
      isAuthenticated.set(false);
      isPremium.set(false);
      return false;
    }
    
    // If token expired, refresh it
    if (Date.now() > parseInt(expiry) - 300000) { // 5 min buffer
      console.log('Token expired, refreshing...');
      refreshAccessToken();
    } else {
      console.log('Token valid, updating stores');
      accessToken.set(token);
      isAuthenticated.set(true);
      
      // Try to fetch user profile in background
      fetchUserProfile().catch(err => {
        console.warn('Background profile fetch failed:', err);
      });
    }
    
    return true;
  } catch (e) {
    console.error('Error checking auth status:', e);
    return false;
  }
}

// Fetch user profile and check premium status
export async function fetchUserProfile() {
  const token = get(accessToken);
  
  if (!token) {
    console.log('No access token available for profile fetch');
    isAuthenticated.set(false);
    isPremium.set(false);
    return null;
  }
  
  try {
    console.log('Fetching user profile from Spotify');
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      console.error('Profile fetch error:', response.status);
      throw new Error(`Failed to fetch profile: ${response.status}`);
    }
    
    const profile = await response.json();
    console.log('Profile received, product type:', profile.product);
    
    // Store the user profile
    userProfile.set(profile);
    isAuthenticated.set(true);
    
    // Check if user has premium
    if (profile.product === 'premium') {
      console.log('User has Spotify Premium');
      isPremium.set(true);
      return profile;
    } else {
      console.log('User does NOT have Spotify Premium');
      isPremium.set(false);
      return { error: 'premium_required', profile };
    }
  } catch (error) {
    console.error('Error fetching profile:', error);
    isPremium.set(false);
    return null;
  }
}

// Refresh access token when expired
export async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('spotify_refresh_token');
  
  if (!refreshToken) {
    console.log('No refresh token available');
    return false;
  }
  
  try {
    console.log('Refreshing access token');
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
      }),
    });
    
    if (!response.ok) {
      console.error('Token refresh error:', response.status);
      throw new Error(`Token refresh failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.access_token) {
      localStorage.setItem('spotify_access_token', data.access_token);
      localStorage.setItem('spotify_token_expires', String(Date.now() + (data.expires_in * 1000)));
      
      if (data.refresh_token) {
        localStorage.setItem('spotify_refresh_token', data.refresh_token);
      }
      
      accessToken.set(data.access_token);
      isAuthenticated.set(true);
      
      // Update premium status
      await fetchUserProfile();
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return false;
  }
}

// Logout function
export function logout() {
  console.log('Logging out user');
  localStorage.removeItem('spotify_access_token');
  localStorage.removeItem('spotify_refresh_token');
  localStorage.removeItem('spotify_token_expires');
  localStorage.removeItem('code_verifier');
  localStorage.removeItem('spotify_auth_state');
  
  isAuthenticated.set(false);
  userProfile.set(null);
  accessToken.set('');
  isPremium.set(false);
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