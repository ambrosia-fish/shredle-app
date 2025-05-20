# Guitar Solo Guesser (Shredle)

A daily guessing game inspired by Wordle/Heardle, focusing on guitar solos. Listen to famous guitar solos and try to guess the song title within 4 attempts.

## Features

- Daily guitar solo challenge with progressive hints
- Spotify Premium integration for high-quality audio playback
- **Guitar Focus Filter**: Enhance guitar frequencies in the mix to help isolate the solo
- Progressive reveal system: get more of the solo with each incorrect guess
- Score tracking and sharing functionality

## Guitar Focus Filter

The Guitar Focus Filter is a real-time audio processing feature that helps highlight guitar parts in the mix. This feature:

- Uses a multi-band EQ approach to enhance frequencies typical of guitar solos (500Hz-3kHz)
- Reduces frequencies where vocals and other instruments typically dominate
- Adjustable intensity slider for fine-tuning the effect
- Works in real-time with Spotify playback
- Enabled by default to provide the optimal guitar listening experience

This feature makes it easier to hear the nuances of guitar solos, especially in complex mixes where multiple instruments are playing simultaneously.

## Development

This project is built with:

- **Frontend**: Svelte/SvelteKit
- **Backend**: ASP.NET Core API
- **Audio**: Spotify Web Playback SDK + Web Audio API

### Running Locally

```bash
# Clone the repository
git clone https://github.com/ambrosia-fish/shredle-app.git

# Install dependencies
cd shredle-app
npm install

# Start development server
npm run dev
```

### Environment Variables

Create a `.env` file with:

```
VITE_SPOTIFY_CLIENT_ID=your_client_id
VITE_SPOTIFY_REDIRECT_URI=http://localhost:5173/callback
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
