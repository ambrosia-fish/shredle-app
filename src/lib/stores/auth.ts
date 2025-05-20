// src/lib/stores/auth.ts
import { writable } from 'svelte/store';

// Simple auth stores
export const isAuthenticated = writable(false);
export const accessToken = writable('');
