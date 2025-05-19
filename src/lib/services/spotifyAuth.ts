// src/lib/services/spotifyAuth.ts
import { isAuthenticated, userProfile, accessToken, isPremium } from '../stores/auth';
import { get } from 'svelte/store';

// Get environment variables
const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const clientSecret = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET; 
const redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;

// Using a simplified auth flow without PKCE

// Start Spotify login flow
export async function loginWithSpotify(): Promise<void> {
  try {
    // Clear storage first to prevent any stale data issues
    localStorage.clear();
    console.log('Storage cleared before login');
    
    // Auth parameters - include all required scopes
    const scope = 'streaming user-read-email user-read-private user-modify-playback-state';
    const authUrl = new URL('https://accounts.spotify.com/authorize');
    
    console.log('Login initiated with redirect URI:', redirectUri);
    
    // Add parameters - using standard OAuth flow (no PKCE)
    const params = {
      response_type: 'code',
      client_id: clientId,
      scope,
      redirect_uri: redirectUri,
    };
    
    authUrl.search = new URLSearchParams(params).toString();
    
    // Redirect to Spotify auth page
    window.location.href = authUrl.toString();
  } catch (error) {
    console.error('Error initiating Spotify login:', error);
    alert('Failed to start Spotify login. Please try again.');
  }
}

// Exchange code for tokens after redirect
export async function handleCallback(code: string): Promise<boolean> {
  console.log('Callback received with code:', code ? 'Present' : 'Missing');
  
  if (!clientSecret) {
    console.error('Client secret is missing - required for token exchange!');
    throw new Error('Client secret is missing. Please check your environment variables.');
  }
  
  const tokenUrl = 'https://accounts.spotify.com/api/token';
  
  // Create Basic Auth header with client ID and secret
  const authHeader = 'Basic ' + btoa(clientId + ':' + clientSecret);
  
  const payload = {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  };
  
  console.log('Token request payload:', {
    client_id: clientId ? 'Present' : 'Missing',
    client_secret: clientSecret ? 'Present' : 'Missing',
    redirect_uri: redirectUri,
  });
  
  try {
    const response = await fetch(tokenUrl, payload);
    console.log('Token response status:', response.status);
    
    // Log more details about the response if it fails
    if (!response.ok) {
      const responseText = await response.text();
      console.error('Token response not OK:', response.status, responseText);
      
      try {
        // Try to parse as JSON for more detailed error
        const errorData = JSON.parse(responseText);
        console.error('Error details:', errorData);
        throw new Error(errorData.error_description || errorData.error || 'Authentication failed');
      } catch (parseError) {
        throw new Error(`Authentication failed (${response.status})`);
      }
    }
    
    const data = await response.json();
    
    if (data.error) {
      console.error('Token response error:', data.error, data.error_description);
      throw new Error(data.error_description || data.error || 'Authentication failed');
    }
    
    console.log('Token response success:', data.access_token ? 'Token received' : 'No token received');
    
    if (data.access_token) {
      // Important: Make sure we store the token as a plain string without quotes
      const tokenValue = String(data.access_token).replace(/^["']|["']$/g, '');
      const refreshTokenValue = String(data.refresh_token).replace(/^["']|["']$/g, '');
      const expiryValue = String(Date.now() + (data.expires_in * 1000));
      
      // Store tokens
      localStorage.setItem('spotify_access_token', tokenValue);
      localStorage.setItem('spotify_refresh_token', refreshTokenValue);
      localStorage.setItem('spotify_token_expiry', expiryValue);
      
      // Update store
      accessToken.set(tokenValue);
      
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
  // Get token directly from localStorage to avoid any store issues
  const token = localStorage.getItem('spotify_access_token');
  
  console.log('Fetching user profile with token:', token ? 'Present' : 'Missing');
  
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
  
  if (!refreshToken || !clientSecret) return false;
  
  // Create Basic Auth header with client ID and secret
  const authHeader = 'Basic ' + btoa(clientId + ':' + clientSecret);
  
  const payload = {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
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
      // Store tokens without quotes
      const tokenValue = String(data.access_token).replace(/^["']|["']$/g, '');
      const expiryValue = String(Date.now() + (data.expires_in * 1000));
      
      localStorage.setItem('spotify_access_token', tokenValue);
      localStorage.setItem('spotify_token_expiry', expiryValue);
      
      if (data.refresh_token) {
        const refreshTokenValue = String(data.refresh_token).replace(/^["']|["']$/g, '');
        localStorage.setItem('spotify_refresh_token', refreshTokenValue);
      }
      
      accessToken.set(tokenValue);
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
    // Make sure we're using a token without quotes in the store
    const cleanToken = String(token).replace(/^["']|["']$/g, '');
    accessToken.set(cleanToken);
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
  
  isAuthenticated.set(false);
  userProfile.set(null);
  accessToken.set('');
  isPremium.set(false);
}