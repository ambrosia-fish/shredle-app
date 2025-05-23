  function isPlayButtonEnabled(index: number): boolean {
    // Enable if component is active or locked (previously unlocked)
    return guessStates[index] === 'active' || guessStates[index] === 'locked';
  }