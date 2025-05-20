// src/lib/stores/auth.ts
import { writable } from 'svelte/store';

// Simple auth stores
export const isAuthenticated = writable(false);
export const accessToken = writable('');
export const isPremium = writable(false);
export const userProfile = writable(null);
