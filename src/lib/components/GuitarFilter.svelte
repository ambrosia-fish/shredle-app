<script lang="ts">
  import { guitarFilterEnabled, filterIntensity } from '$lib/services/audioFilter';
  
  // Component props
  export let showControls: boolean = true;
  
  // Local state
  let intensity: number = $filterIntensity;
  let enabled: boolean = $guitarFilterEnabled;
  
  // Update store when local state changes
  function updateFilter() {
    guitarFilterEnabled.set(enabled);
    filterIntensity.set(intensity);
  }
  
  // Handle toggle switch click
  function toggleFilter() {
    enabled = !enabled;
    updateFilter();
  }
  
  // Handle intensity slider change
  function handleIntensityChange(event: Event) {
    const target = event.target as HTMLInputElement;
    intensity = parseInt(target.value);
    updateFilter();
  }
</script>

<div class="filter-container">
  <div class="filter-toggle">
    <label for="filter-switch" class="switch-label">
      <span>Guitar Focus</span>
      <div class="switch">
        <input 
          type="checkbox" 
          id="filter-switch"
          bind:checked={enabled}
          on:change={toggleFilter}
        />
        <span class="slider"></span>
      </div>
    </label>
  </div>
  
  {#if showControls && enabled}
    <div class="filter-controls">
      <label for="intensity-slider" class="slider-label">
        <span>Intensity: {intensity}%</span>
        <input 
          type="range" 
          id="intensity-slider"
          min="0" 
          max="100" 
          step="5"
          bind:value={intensity}
          on:input={handleIntensityChange}
        />
      </label>
    </div>
  {/if}
</div>

<style>
  .filter-container {
    margin: 0.5rem 0;
    padding: 0.5rem;
    border-radius: 6px;
    background-color: rgba(0, 0, 0, 0.15);
  }
  
  .filter-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .switch-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    cursor: pointer;
    font-size: 0.9rem;
    color: #fff;
  }
  
  .switch {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
  }
  
  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #444;
    transition: .3s;
    border-radius: 24px;
  }
  
  .slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: .3s;
    border-radius: 50%;
  }
  
  input:checked + .slider {
    background-color: #1DB954;
  }
  
  input:focus + .slider {
    box-shadow: 0 0 1px #1DB954;
  }
  
  input:checked + .slider:before {
    transform: translateX(20px);
  }
  
  .filter-controls {
    margin-top: 0.8rem;
    padding-top: 0.8rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .slider-label {
    display: flex;
    flex-direction: column;
    width: 100%;
    font-size: 0.85rem;
    color: #ccc;
  }
  
  .slider-label span {
    margin-bottom: 0.4rem;
  }
  
  input[type="range"] {
    -webkit-appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: #555;
    outline: none;
  }
  
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #1DB954;
    cursor: pointer;
  }
  
  input[type="range"]::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #1DB954;
    cursor: pointer;
    border: none;
  }
</style>
