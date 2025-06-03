# Shredle - Daily Guitar Solo Guessing Game

A web application where users guess songs based on guitar solo clips, inspired by Wordle's daily puzzle format.

## About

Shredle is a daily music guessing game that challenges players to identify songs by listening to isolated guitar solo clips. Players get multiple attempts to guess the correct song, with each clip revealing more of the solo. The game features intelligent guess validation that accounts for spelling variations, different languages, and colloquial song names.

**Live at**: [https://shredle.feztech.io](https://shredle.feztech.io)

## Tech Stack

- **Frontend Framework**: SvelteKit with TypeScript
- **Build Tool**: Vite
- **Styling**: CSS (with potential for Tailwind CSS)
- **API Integration**: Fetch API for backend communication
- **Music Playback**: Spotify Web API / Apple Music integration
- **Deployment**: Vercel
- **Code Quality**: ESLint, Prettier, svelte-check

## Features

- Daily guitar solo challenges
- Progressive hint system (4 clips of increasing length)
- Smart guess validation using AI
- Spotify and Apple Music integration for playback
- Mobile-responsive design
- Share results functionality
- Streak tracking
- Win/loss statistics

## Project Structure

```
src/
├── lib/
│   ├── api.ts              # API client for backend communication
│   ├── spotify.ts          # Spotify Web API integration
│   ├── spotify-playback.ts # Spotify playback SDK wrapper
│   ├── spotify-utils.ts    # Spotify utility functions
│   ├── types.ts            # TypeScript type definitions
│   └── index.ts            # Shared utilities and constants
├── routes/
│   └── +page.svelte        # Main game page
├── app.d.ts                # SvelteKit app types
└── app.html                # HTML template
```

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/ambrosia-fish/shredle-app.git
   cd shredle-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with necessary configuration:
   ```
   PUBLIC_API_URL=http://localhost:5000
   PUBLIC_SPOTIFY_CLIENT_ID=your_spotify_client_id
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:5173](http://localhost:5173) in your browser

## Development

- `npm run dev` - Start development server with hot module replacement
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run check` - Run svelte-check for type checking
- `npm run check:watch` - Run svelte-check in watch mode
- `npm run lint` - Run ESLint and Prettier checks
- `npm run format` - Format code with Prettier

## API Integration

The app communicates with the [Shredle API](https://github.com/ambrosia-fish/shredle-api) for:

- Fetching daily game data
- Retrieving solo information
- Validating user guesses
- Managing game state

### Key API Endpoints

- `GET /api/game/daily` - Get today's game
- `GET /api/solo/{id}` - Get solo details
- `POST /api/guess` - Submit and validate a guess

## Music Service Integration

### Spotify
- Web Playback SDK for in-browser playback
- OAuth authentication flow
- Track metadata and audio analysis

### Apple Music (Planned)
- MusicKit JS integration
- Apple ID authentication
- Cross-platform playback support

## Deployment

The app is configured for deployment on Vercel:

1. Push changes to GitHub
2. Vercel automatically builds and deploys from the main branch
3. Environment variables are configured in Vercel dashboard

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Code Style

- TypeScript for type safety
- Prettier for consistent formatting
- ESLint for code quality
- Conventional Commits for clear history

## Future Enhancements

- User accounts and persistent stats
- Leaderboards
- Custom playlists
- Multiple difficulty levels
- Genre-specific challenges
- Social features and multiplayer modes
- PWA support for mobile

## License

MIT

## Contact

For questions or feedback, contact: josef@feztech.io
