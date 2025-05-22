// src/lib/spotify.ts
import { PUBLIC_SPOTIFY_CLIENT_ID, PUBLIC_REDIRECT_URL } from '$env/static/public';

interface SpotifyPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  getCurrentState(): Promise<unknown>;
  addListener(event: string, callback: (data: any) => void): void;
  removeListener(event: string, callback?: (data: any) => void): void;
  activateElement?(): Promise<void>; // For mobile browsers
}

interface SpotifyAPI {
  Player: new (options: { 
    name: string; 
    getOAuthToken: (cb: (token: string) => void) => void;
    volume?: number;
  }) => SpotifyPlayer;
}

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: SpotifyAPI;
  }
}

// Promise to track when Spotify SDK is ready
let spotifySDKPromise: Promise<void> | null = null;

// Initialize the SDK promise and callback
function initializeSpotifySDKPromise(): Promise<void> {
  if (spotifySDKPromise) {
    return spotifySDKPromise;
  }

  spotifySDKPromise = new Promise((resolve) => {
    // If already loaded, resolve immediately
    if (window.Spotify) {
      resolve();
      return;
    }

    // Set up the callback for when SDK loads
    window.onSpotifyWebPlaybackSDKReady = () => {
      resolve();
    };
  });

  return spotifySDKPromise;
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
  const clientId = PUBLIC_SPOTIFY_CLIENT_ID || 'ae13f4b403584b2f8d8bce37273a1686';
  const redirectUri = PUBLIC_REDIRECT_URL || 'https://shredle.feztech.io/';
  // Only the required scopes for Web Playback SDK
  const scopes = 'streaming user-read-email user-read-private';
  
  // Generate PKCE codes
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  
  // Store code verifier in URL state
  const state = btoa(codeVerifier);
  
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
      const codeVerifier = atob(state);
      
      const clientId = PUBLIC_SPOTIFY_CLIENT_ID || 'ae13f4b403584b2f8d8bce37273a1686';
      const redirectUri = PUBLIC_REDIRECT_URL || 'https://shredle.feztech.io/';
      
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri,
          client_id: clientId,
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
        throw new Error(`Token exchange failed: ${errorText}`);
      }
    } catch (error) {
      console.error('Error in callback handling:', error);
      throw error;
    }
  }
}

export async function initializeSpotifyPlayer(): Promise<SpotifyPlayer> {
  const token = getSpotifyToken();
  if (!token) {
    throw new Error('No Spotify token available');
  }

  // Wait for Spotify SDK to be ready
  await initializeSpotifySDKPromise();

  if (!window.Spotify) {
    throw new Error('Spotify SDK failed to load');
  }

  return new Promise((resolve, reject) => {
    console.log('Creating Spotify Player instance...');
    
    const player = new window.Spotify.Player({
      name: 'Shredle Game Player',
      getOAuthToken: (cb: (token: string) => void) => { 
        console.log('Spotify requesting token...');
        cb(token); 
      },
      volume: 0.5
    });

    // Set up error listeners first
    player.addListener('initialization_error', ({ message }) => {
      console.error('Spotify initialization error:', message);
      reject(new Error(`Initialization error: ${message}`));
    });

    player.addListener('authentication_error', ({ message }) => {
      console.error('Spotify authentication error:', message);
      reject(new Error(`Authentication error: ${message}`));
    });

    player.addListener('account_error', ({ message }) => {
      console.error('Spotify account error:', message);
      reject(new Error(`Account error: ${message}. Note: Spotify Premium is required.`));
    });

    player.addListener('playback_error', ({ message }) => {
      console.error('Spotify playback error:', message);
      // Don't reject on playback errors, just log them
    });

    // Set up ready listener
    player.addListener('ready', ({ device_id }) => {
      console.log('Spotify player ready with device ID:', device_id);
    });

    player.addListener('not_ready', ({ device_id }) => {
      console.log('Spotify player not ready with device ID:', device_id);
    });

    // Attempt to connect
    console.log('Connecting to Spotify...');
    player.connect().then((success: boolean) => {
      if (success) {
        console.log('Successfully connected to Spotify player');
        resolve(player);
      } else {
        reject(new Error('Failed to connect Spotify player'));
      }
    }).catch((error) => {
      console.error('Error connecting to Spotify player:', error);
      reject(new Error(`Connection error: ${error}`));
    });
  });
}

// Initialize the SDK promise when this module loads
if (typeof window !== 'undefined') {
  initializeSpotifySDKPromise();
}
