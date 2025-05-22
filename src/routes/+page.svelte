  async function playClip(clipNumber: number) {
    if (!player || !deviceId || !currentGame || isPlaying) {
      console.error('Cannot play clip: missing player, device ID, or game data');
      return;
    }
    
    try {
      isPlaying = true;
      errorMessage = ''; // Clear any previous errors
      
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
      setTimeout(() => {
        isPlaying = false;
      }, clipDuration + 500); // Add small buffer
      
    } catch (error) {
      console.error('Failed to play clip:', error);
      if (error.message && error.message.includes('fetch')) {
        errorMessage = `Failed to load clip ${clipNumber} data. Please check your connection and try again.`;
      } else {
        errorMessage = `Failed to play clip ${clipNumber}. Make sure Spotify is active and try again.`;
      }
      isPlaying = false;
    }
  }