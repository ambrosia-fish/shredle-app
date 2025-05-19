<script lang="ts">
  import type { SoloResponse } from '$lib/types/api';
  
  export let solo: SoloResponse;
  export let isCorrect: boolean = false;
</script>

<div class="result-container {isCorrect ? 'correct' : 'incorrect'}">
  <h2 class="result-title">
    {isCorrect ? 'Correct! 🎸' : 'Better luck next time! 🎵'}
  </h2>
  
  <div class="song-info">
    <h3>{solo.title}</h3>
    <p class="artist">by {solo.artist}</p>
    <p class="guitarist">Solo by {solo.guitarist}</p>
    
    {#if solo.aiHint}
      <div class="hint-box">
        <p class="hint-label">Fun fact:</p>
        <p class="hint-text">{solo.aiHint}</p>
      </div>
    {/if}
  </div>
  
  <div class="spotify-link">
    <a 
      href={`https://open.spotify.com/track/${solo.spotifyId}`} 
      target="_blank" 
      rel="noopener noreferrer"
    >
      Listen on Spotify
    </a>
  </div>
  
  <div class="play-again">
    <a href="/game">Play Again</a>
  </div>
</div>

<style>
  .result-container {
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    padding: 2rem;
    margin: 2rem auto;
    max-width: 600px;
    text-align: center;
  }
  
  .correct {
    border: 2px solid #2ecc71;
  }
  
  .incorrect {
    border: 2px solid #e74c3c;
  }
  
  .result-title {
    font-size: 2rem;
    margin-bottom: 1.5rem;
  }
  
  .song-info {
    margin-bottom: 2rem;
  }
  
  .song-info h3 {
    font-size: 1.8rem;
    margin-bottom: 0.5rem;
  }
  
  .artist {
    font-size: 1.2rem;
    margin-bottom: 0.5rem;
    opacity: 0.9;
  }
  
  .guitarist {
    font-size: 1.1rem;
    color: #f39c12;
    margin-bottom: 1rem;
  }
  
  .hint-box {
    background-color: rgba(52, 152, 219, 0.1);
    padding: 1rem;
    border-radius: 8px;
    margin: 1rem 0;
  }
  
  .hint-label {
    font-weight: bold;
    margin-bottom: 0.5rem;
    color: #3498db;
  }
  
  .spotify-link a, .play-again a {
    display: inline-block;
    margin-top: 1rem;
    padding: 0.8rem 1.5rem;
    border-radius: 30px;
    text-decoration: none;
    font-weight: bold;
    transition: all 0.2s;
  }
  
  .spotify-link a {
    background-color: #1DB954;
    color: white;
  }
  
  .play-again a {
    background-color: rgba(255, 255, 255, 0.1);
    color: white;
    margin-top: 1rem;
  }
  
  .spotify-link a:hover, .play-again a:hover {
    transform: scale(1.05);
  }
</style>