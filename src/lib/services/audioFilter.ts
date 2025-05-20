// src/lib/services/audioFilter.ts
import { writable } from 'svelte/store';

// Guitar filter settings store
export const guitarFilterEnabled = writable(false);
export const filterIntensity = writable(50); // 0-100 range

// Create AudioNode types for TypeScript
type AudioFilterNodes = {
  input: AudioNode;
  output: AudioNode;
  context: AudioContext;
  analyser?: AnalyserNode;
  filters?: BiquadFilterNode[];
  disconnect: () => void;
  updateIntensity: (intensity: number) => void;
};

let audioContext: AudioContext | null = null;
let filterNodes: AudioFilterNodes | null = null;

/**
 * Initialize the audio context (must be called after user interaction)
 */
export function initAudioContext(): AudioContext {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('Audio context initialized');
    } catch (err) {
      console.error('Failed to create audio context:', err);
      throw new Error('Audio context initialization failed');
    }
  }
  
  return audioContext;
}

/**
 * Create a guitar-enhancing filter chain
 * This uses a multi-band EQ approach to emphasize frequencies typical of guitar solos
 */
export function createGuitarFilter(): AudioFilterNodes {
  if (!audioContext) {
    throw new Error('Audio context not initialized');
  }
  
  if (filterNodes) {
    // Clean up existing filter if it exists
    filterNodes.disconnect();
  }
  
  // Create filter chain nodes
  const input = audioContext.createGain();
  const output = audioContext.createGain();
  
  // Create analyser for visualization if needed later
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  
  // Create filters for guitar frequency ranges
  // Guitar typically sits between 80Hz and 5kHz, with solos often in the 1-3kHz range

  // 1. High-pass to remove bass/drums below ~120Hz
  const highPass = audioContext.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.value = 120;
  highPass.Q.value = 0.7;
  
  // 2. Low-pass to remove high elements (cymbals, etc) above ~5kHz
  const lowPass = audioContext.createBiquadFilter();
  lowPass.type = 'lowpass';
  lowPass.frequency.value = 5000;
  lowPass.Q.value = 0.7;
  
  // 3. Multiple peaking filters to emphasize guitar frequencies
  const lowMidBoost = audioContext.createBiquadFilter();
  lowMidBoost.type = 'peaking';
  lowMidBoost.frequency.value = 500;
  lowMidBoost.gain.value = 6; // Will be adjusted by intensity
  lowMidBoost.Q.value = 1;
  
  const midBoost = audioContext.createBiquadFilter();
  midBoost.type = 'peaking';
  midBoost.frequency.value = 1500;
  midBoost.gain.value = 12; // Will be adjusted by intensity
  midBoost.Q.value = 1.5;
  
  const highMidBoost = audioContext.createBiquadFilter();
  highMidBoost.type = 'peaking';
  highMidBoost.frequency.value = 3000;
  highMidBoost.gain.value = 8; // Will be adjusted by intensity
  highMidBoost.Q.value = 1;
  
  // 4. Cut some frequencies where vocals typically sit
  const vocalCut = audioContext.createBiquadFilter();
  vocalCut.type = 'peaking';
  vocalCut.frequency.value = 800;
  vocalCut.gain.value = -3; // Will be adjusted by intensity
  vocalCut.Q.value = 2;
  
  // A small notch around vocal fundamental frequency
  const vocalCut2 = audioContext.createBiquadFilter();
  vocalCut2.type = 'peaking';
  vocalCut2.frequency.value = 300;
  vocalCut2.gain.value = -2; // Will be adjusted by intensity
  vocalCut2.Q.value = 3;
  
  // Connect the filter chain
  input
    .connect(highPass)
    .connect(lowPass)
    .connect(lowMidBoost)
    .connect(midBoost)
    .connect(highMidBoost)
    .connect(vocalCut)
    .connect(vocalCut2)
    .connect(analyser)
    .connect(output);
  
  const filters = [lowMidBoost, midBoost, highMidBoost, vocalCut, vocalCut2];
  
  // Create filter object with control methods
  filterNodes = {
    input,
    output,
    context: audioContext,
    analyser,
    filters,
    disconnect: () => {
      input.disconnect();
      output.disconnect();
      highPass.disconnect();
      lowPass.disconnect();
      lowMidBoost.disconnect();
      midBoost.disconnect();
      highMidBoost.disconnect();
      vocalCut.disconnect();
      vocalCut2.disconnect();
      analyser.disconnect();
    },
    updateIntensity: (intensity: number) => {
      // Scale the intensity (0-100) to appropriate filter gains
      const scaleFactor = intensity / 50;
      
      if (filters) {
        lowMidBoost.gain.value = 6 * scaleFactor;
        midBoost.gain.value = 12 * scaleFactor;
        highMidBoost.gain.value = 8 * scaleFactor;
        vocalCut.gain.value = -3 * scaleFactor;
        vocalCut2.gain.value = -2 * scaleFactor;
      }
    }
  };
  
  return filterNodes;
}

/**
 * Connect the filter to an HTML audio element
 */
export function connectFilterToElement(element: HTMLAudioElement | HTMLMediaElement): AudioFilterNodes | null {
  try {
    if (!audioContext) {
      audioContext = initAudioContext();
    }
    
    // Create an audio source from the element
    const source = audioContext.createMediaElementSource(element);
    
    // Create guitar filter
    const filter = createGuitarFilter();
    
    // Connect source to filter
    source.connect(filter.input);
    
    // Connect filter output to audio context destination
    filter.output.connect(audioContext.destination);
    
    console.log('Connected audio filter to element');
    return filter;
  } catch (err) {
    console.error('Failed to connect filter to element:', err);
    return null;
  }
}

/**
 * Create a frequency analyzer to visualize the audio
 */
export function createFrequencyAnalyzer(filterNodes: AudioFilterNodes): Uint8Array {
  if (!filterNodes.analyser) {
    throw new Error('No analyser node available in filter chain');
  }
  
  const analyser = filterNodes.analyser;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  
  // Get frequency data
  analyser.getByteFrequencyData(dataArray);
  return dataArray;
}

/**
 * Apply the filter to an existing audio source node or bypass it
 */
export function toggleGuitarFilter(source: AudioNode, enabled: boolean): void {
  if (!audioContext || !filterNodes) {
    throw new Error('Audio filter not initialized');
  }
  
  try {
    // Disconnect all existing connections
    source.disconnect();
    
    if (enabled) {
      // Enable filter: source -> filter -> destination
      source.connect(filterNodes.input);
      console.log('Guitar filter enabled');
    } else {
      // Bypass filter: source -> destination
      source.connect(audioContext.destination);
      console.log('Guitar filter bypassed');
    }
  } catch (err) {
    console.error('Error toggling guitar filter:', err);
  }
}

/**
 * Cleanup audio context and filter nodes
 */
export function cleanupAudioFilter(): void {
  if (filterNodes) {
    filterNodes.disconnect();
    filterNodes = null;
  }
  
  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close().catch(err => console.error('Error closing audio context:', err));
    audioContext = null;
  }
}
