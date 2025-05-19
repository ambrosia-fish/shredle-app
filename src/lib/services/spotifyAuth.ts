// src/lib/services/spotifyAuth.ts
import { isAuthenticated, userProfile, accessToken, isPremium } from '../stores/auth';
import { get } from 'svelte/store';

// Get client ID from environment variable
const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;

// Generate a random string for PKCE
function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

// Generate code challenge from verifier
async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  
  // Convert the digest to base64url format properly
  return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Start Spotify login flow
export async function loginWithSpotify(): Promise<void> {
  // PKCE challenge
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  
  // Store code verifier for later exchange
  localStorage.setItem('code_verifier', codeVerifier);
  
  // Auth parameters - added user-modify-playback-state scope
  const scope = 'streaming user-read-email user-read-private user-modify-playback-state';
  const authUrl = new URL('https://accounts.spotify.com/authorize');
  
  console.log('Login initiated with redirect URI:', redirectUri);
  console.log('Code verifier stored in localStorage');
  
  // Add parameters
  const params = {
    response_type: 'code',
    client_id: clientId,
    scope,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    redirect_uri: redirectUri,
  };
  
  authUrl.search = new URLSearchParams(params).toString();
  
  // Redirect to Spotify auth page
  window.location.href = authUrl.toString();
}

// Exchange code for tokens after redirect
export async function handleCallback(code: string): Promise<boolean> {
  console.log('Callback received with code:', code ? 'Present (hidden for security)' : 'Missing');
  
  const codeVerifier = localStorage.getItem('code_verifier');
  
  console.log('Code verifier from localStorage:', codeVerifier ? 'exists' : 'missing');
  
  if (!codeVerifier) {
    console.error('No code verifier found in localStorage');
    throw new Error('No code verifier found. Please try logging in again.');
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
    client_id: clientId ? 'Present (hidden for security)' : 'Missing',
    redirect_uri: redirectUri,
    code_verifier_length: codeVerifier.length,
  });
  
  try {
    const response = await fetch(tokenUrl, payload);
    console.log('Token response status:', response.status);
    
    if (!response.ok) {
      console.error('Token response not OK:', response.status, response.statusText);
    }
    
    const data = await response.json();
    
    if (data.error) {
      console.error('Token response error:', data.error, data.error_description);
      throw new Error(data.error_description || data.error || 'Authentication failed');
    }
    
    console.log('Token response success:', data.access_token ? 'Token received' : 'No token received');
    
    if (data.access_token) {
      // Store tokens
      localStorage.setItem('spotify_access_token', data.access_token);
      localStorage.setItem('spotify_refresh_token', data.refresh_token);
      localStorage.setItem('spotify_token_expiry', String(Date.now() + (data.expires_in * 1000)));
      
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
  
  console.log('Fetching user profile with token:', token ? 'Present (hidden for security)' : 'Missing');
  
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
    
    if (!response.ok) {
      console.error('Profile fetch failed:', response.status, response.statusText);
      throw new Error(`Failed to fetch profile: ${response.statusText}`);
    }
    
    const profile = await response.json();
    console.log('Profile fetched:', profile.id, 'Product:', profile.product);
    
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
    
    if (!response.ok) {
      console.error('Token refresh failed:', response.status, response.statusText);
      return false;
    }
    
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
  
  isAuthenticated.set(false);
  userProfile.set(null);
  accessToken.set('');
  isPremium.set(false);
}