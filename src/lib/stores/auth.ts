// src/lib/stores/auth.ts
import { writable } from 'svelte/store';
import { persisted } from 'svelte-local-storage-store';

// Create auth stores
export const isAuthenticated = writable(false);
export const userProfile = writable(null);
export const accessToken = persisted('spotify_access_token', '');
export const isPremium = writable(false);