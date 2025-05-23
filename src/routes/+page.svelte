  async function playClip(clipNumber: number) {
    // Set visual feedback immediately when button is clicked
    clearAllClipTimeouts();
    playingClipNumber = clipNumber;
    errorMessage = ''; // Clear any previous errors
    
    if (!player || !deviceId || !currentGame || !isPlayerReady) {
      console.error('Cannot play clip: missing player, device ID, game data, or player not ready');
      // Keep visual state for a moment to show user the button was clicked
      setTimeout(() => {
        if (playingClipNumber === clipNumber) {
          playingClipNumber = 0;
        }
      }, 1000);
      return;
    }
    
    try {
      console.log(`Fetching latest solo data for clip ${clipNumber}...`);
      
      // Fetch fresh solo data from server each time
      const freshSoloData = await getSolo(currentGame.soloId);
      
      // Update our current solo data with the fresh data
      currentSolo = freshSoloData;
      
      // Activate player for mobile browsers on user interaction
      await activatePlayerForMobile(player);
      
      // Get the appropriate clip timing based on clip number
      let startTime: number, endTime: number;
      
      switch (clipNumber) {
        case 1:
          startTime = freshSoloData.startTimeClip1;
          endTime = freshSoloData.endTimeClip1;
          break;
        case 2:
          startTime = freshSoloData.startTimeClip2;
          endTime = freshSoloData.endTimeClip2;
          break;
        case 3:
          startTime = freshSoloData.startTimeClip3;
          endTime = freshSoloData.endTimeClip3;
          break;
        case 4:
          startTime = freshSoloData.startTimeClip4;
          endTime = freshSoloData.endTimeClip4;
          break;
        default:
          throw new Error('Invalid clip number');
      }
      
      console.log(`Playing clip ${clipNumber}: ${startTime}s to ${endTime}s (track: ${freshSoloData.spotifyId})`);
      
      await playTrackSegment({
        deviceId,
        spotifyTrackId: freshSoloData.spotifyId,
        startTime,
        endTime
      });
      
      // Reset playing state after the clip duration
      const clipDuration = (endTime - startTime) * 1000;
      const timeout = setTimeout(() => {
        // Only reset if this is still the active clip
        if (playingClipNumber === clipNumber) {
          playingClipNumber = 0;
        }
      }, clipDuration + 500); // Add small buffer
      
      clipTimeouts.push(timeout);
      
    } catch (error) {
      console.error('Failed to play clip:', error);
      if (error instanceof Error && error.message.includes('fetch')) {
        errorMessage = `Failed to load clip ${clipNumber} data. Please check your connection and try again.`;
      } else {
        errorMessage = `Failed to play clip ${clipNumber}. Make sure Spotify is active and try again.`;
      }
      playingClipNumber = 0;
    }
  }