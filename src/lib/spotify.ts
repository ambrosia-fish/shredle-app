// src/lib/spotify.ts
import { PUBLIC_SPOTIFY_CLIENT_ID } from '$env/static/public';

interface SpotifyPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  getCurrentState(): Promise<unknown>;
}

interface SpotifyAPI {
  Player: new (options: { name: string; getOAuthToken: (cb: (token: string) => void) => void }) => SpotifyPlayer;
}

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: SpotifyAPI;
  }
}

// PKCE helper functions
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function isSpotifyLoggedIn(): boolean {
  const token = localStorage.getItem('spotify_access_token');
  return token !== null;
}

export function getSpotifyToken(): string | null {
  return localStorage.getItem('spotify_access_token');
}

export async function loginToSpotify(): Promise<void> {
  const clientId = PUBLIC_SPOTIFY_CLIENT_ID;
  const redirectUri = 'https://ca11-68-0-249-64.ngrok-free.app';
  const scopes = 'streaming user-read-email user-read-private';
  
  // Generate PKCE codes
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  
  // Store code verifier in URL state instead of localStorage
  const state = btoa(codeVerifier); // Base64 encode the verifier
  
  const authUrl = `https://accounts.spotify.com/authorize?` +
    `client_id=${clientId}&` +
    `response_type=code&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `scope=${encodeURIComponent(scopes)}&` +
    `code_challenge_method=S256&` +
    `code_challenge=${codeChallenge}&` +
    `state=${state}`;
  
  window.location.href = authUrl;
}

export async function handleSpotifyCallback(): Promise<void> {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  
  if (code && state) {
    try {
      // Decode the code verifier from the state parameter
      const codeVerifier = atob(state);
      
      // Exchange code for access token
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: 'https://ca11-68-0-249-64.ngrok-free.app',
          client_id: PUBLIC_SPOTIFY_CLIENT_ID,
          code_verifier: codeVerifier,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('spotify_access_token', data.access_token);
        console.log('Successfully stored access token');
        
        // Clean up the URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        const errorText = await response.text();
        console.error('Failed to exchange code for token:', errorText);
      }
    } catch (error) {
      console.error('Error in callback handling:', error);
    }
  }
}

export function initializeSpotifyPlayer(): Promise<SpotifyPlayer> {
  return new Promise((resolve, reject) => {
    const token = getSpotifyToken();
    if (!token) {
      reject('No Spotify token available');
      return;
    }

    const player = new window.Spotify.Player({
      name: 'Shredle Game Player',
      getOAuthToken: (cb: (token: string) => void) => { cb(token); }
    });

    player.connect().then((success: boolean) => {
      if (success) {
        resolve(player);
      } else {
        reject('Failed to connect Spotify player');
      }
    });
  });
}