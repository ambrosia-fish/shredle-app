<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { SoloResponse } from '$lib/types/api';

  // Props
  export let solo: SoloResponse;
  export let isCorrect: boolean = false;
  export let attemptsRemaining: number = 4;
  export let isSubmitting: boolean = false;

  // Local state
  let guess: string = '';
  const dispatch = createEventDispatcher();

  // Submit the guess
  function handleSubmit() {
    if (!guess.trim() || isSubmitting) return;
    
    dispatch('submitGuess', { guess });
    guess = '';
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      handleSubmit();
    }
  }
</script>

<div class="guess-form">
  <div class="attempts-remaining">
    <span>Attempts remaining: {attemptsRemaining}</span>
  </div>
  
  {#if solo.revealGuitarist}
    <div class="hint guitarist">
      <span>Guitarist: {solo.guitarist}</span>
    </div>
  {/if}
  
  {#if solo.revealHint}
    <div class="hint ai-hint">
      <span>Hint: {solo.aiHint}</span>
    </div>
  {/if}
  
  <div class="form-group">
    <input
      type="text"
      bind:value={guess}
      placeholder="Guess the song title..."
      disabled={isCorrect || attemptsRemaining === 0 || isSubmitting}
      on:keydown={handleKeyDown}
    />
    
    <button 
      type="button" 
      on:click={handleSubmit}
      disabled={!guess.trim() || isCorrect || attemptsRemaining === 0 || isSubmitting}
    >
      {isSubmitting ? 'Submitting...' : 'Submit Guess'}
    </button>
  </div>
</div>

<style>
  .guess-form {
    margin: 2rem 0;
    max-width: 600px;
    width: 100%;
    margin-left: auto;
    margin-right: auto;
  }
  
  .attempts-remaining {
    text-align: center;
    margin-bottom: 1rem;
    font-weight: bold;
    font-size: 1.1rem;
  }
  
  .hint {
    margin: 1rem 0;
    padding: 0.8rem;
    border-radius: 8px;
    background-color: rgba(255, 255, 255, 0.1);
    text-align: center;
  }
  
  .guitarist {
    color: #f39c12;
  }
  
  .ai-hint {
    color: #3498db;
  }
  
  .form-group {
    display: flex;
    gap: 10px;
  }
  
  input {
    flex: 1;
  }
  
  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
</style>