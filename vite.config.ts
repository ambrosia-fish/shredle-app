import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    allowedHosts: [
      'localhost',
      '8bde-68-0-249-64.ngrok-free.app'
    ]
  }
});