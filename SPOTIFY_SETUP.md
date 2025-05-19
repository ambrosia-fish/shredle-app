# Spotify Authentication Setup Instructions

## Configuration Required

1. **Update your `.env` file** to include these values:

```
VITE_SPOTIFY_CLIENT_ID=your_client_id_here
VITE_SPOTIFY_CLIENT_SECRET=your_client_secret_here
VITE_SPOTIFY_REDIRECT_URI=https://your-ngrok-url.ngrok-free.app/callback
VITE_API_BASE_URL=http://localhost:5130
```

2. **Get your Spotify Client Secret**:
   - Go to your [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Select your application
   - You'll find both the Client ID and Client Secret there

3. **Update Spotify Developer Dashboard**:
   - Make sure your Redirect URI in the Spotify Dashboard settings matches exactly what's in your `.env` file

## Key Changes Made

1. **Authentication Flow**:
   - Switched from PKCE to standard OAuth flow with client secret
   - Improved error handling throughout the authentication process
   - Added debugging information to help troubleshoot issues

2. **API Configuration**:
   - Updated to use local development server instead of Heroku URL
   - Added environment variable for API base URL
   - Improved error logging for API requests

3. **SDK Integration**:
   - Fixed Spotify SDK initialization
   - Improved player component to handle errors gracefully

## Development Workflow

1. Start your local backend at port 5130
2. Start your ngrok tunnel for the frontend
3. Update your `.env` with the current ngrok URL
4. Start the Svelte development server
5. Use the debug panel to verify your configuration

## Common Issues & Troubleshooting

1. **"Invalid client secret" error**:
   - Make sure your client secret is correctly copied from the Spotify Dashboard
   - Check that it's properly set in your `.env` file

2. **CORS errors when connecting to backend**:
   - Ensure your backend is running at the URL specified in `VITE_API_BASE_URL`
   - Check that your backend has CORS configured to allow requests from your frontend

3. **Authentication errors**:
   - Clear browser storage using the debug panel's "Clear Storage" button
   - Check that your redirect URI exactly matches what's in the Spotify Dashboard

4. **Spotify SDK errors**:
   - Make sure you have a Spotify Premium account
   - Check the console for specific error messages