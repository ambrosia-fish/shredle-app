// src/lib/types/spotify.d.ts

/**
 * Typescript declarations for Spotify Web Playback SDK
 * https://developer.spotify.com/documentation/web-playback-sdk/reference/
 */

declare global {
  interface Window {
    Spotify: typeof Spotify;
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

declare namespace Spotify {
  interface Player {
    connect(): Promise<boolean>;
    disconnect(): void;
    addListener(event: 'ready', callback: (data: { device_id: string }) => void): void;
    addListener(event: 'not_ready', callback: (data: { device_id: string }) => void): void;
    addListener(event: 'player_state_changed', callback: (state: PlaybackState) => void): void;
    addListener(event: 'autoplay_failed', callback: () => void): void;
    addListener(event: 'initialization_error', callback: (e: ErrorEvent) => void): void;
    addListener(event: 'authentication_error', callback: (e: ErrorEvent) => void): void;
    addListener(event: 'account_error', callback: (e: ErrorEvent) => void): void;
    addListener(event: 'playback_error', callback: (e: ErrorEvent) => void): void;
    removeListener(event: string, callback?: (...args: any[]) => void): void;
    getCurrentState(): Promise<PlaybackState | null>;
    setName(name: string): Promise<void>;
    getVolume(): Promise<number>;
    setVolume(volume: number): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    togglePlay(): Promise<void>;
    seek(position_ms: number): Promise<void>;
    previousTrack(): Promise<void>;
    nextTrack(): Promise<void>;
  }

  interface PlaybackState {
    context: {
      uri: string | null;
      metadata: Record<string, unknown> | null;
    };
    disallows: {
      pausing: boolean;
      peeking_next: boolean;
      peeking_prev: boolean;
      resuming: boolean;
      seeking: boolean;
      skipping_next: boolean;
      skipping_prev: boolean;
    };
    duration: number;
    paused: boolean;
    position: number;
    repeat_mode: number;
    shuffle: boolean;
    track_window: {
      current_track: Track;
      previous_tracks: Track[];
      next_tracks: Track[];
    };
  }

  interface Track {
    id: string | null;
    uri: string;
    type: 'track' | 'episode' | 'ad';
    uid: string;
    name: string;
    media_type: 'audio' | 'video';
    duration_ms: number;
    artists: Artist[];
    album: Album;
    is_playable: boolean;
    linked_from?: {
      uri: string | null;
      id: string | null;
    };
  }

  interface Artist {
    name: string;
    uri: string;
  }

  interface Album {
    name: string;
    uri: string;
    images: Image[];
  }

  interface Image {
    url: string;
    height: number | null;
    width: number | null;
  }

  interface ErrorEvent {
    message: string;
  }

  interface PlayerInit {
    name: string;
    getOAuthToken(cb: (token: string) => void): void;
    volume?: number;
  }

  class Player {
    constructor(options: PlayerInit);
    connect(): Promise<boolean>;
    disconnect(): void;
    addListener(event: string, callback: (data: any) => void): void;
    removeListener(event: string, callback?: (data: any) => void): void;
    getCurrentState(): Promise<PlaybackState | null>;
    setName(name: string): Promise<void>;
    getVolume(): Promise<number>;
    setVolume(volume: number): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    togglePlay(): Promise<void>;
    seek(position_ms: number): Promise<void>;
    previousTrack(): Promise<void>;
    nextTrack(): Promise<void>;
  }
}

export {};
