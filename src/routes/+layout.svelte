<script>
  // Add global styles
</script>

<div class="app">
  <main>
    <slot />
  </main>
</div>

<style>
  :global(:root) {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    --primary-color: #1DB954; /* Spotify green */
    --background-color: #121212;
    --text-color: #FFFFFF;
    --secondary-color: #535353;
  }
  
  :global(body) {
    background-color: var(--background-color);
    color: var(--text-color);
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  :global(button) {
    background-color: var(--primary-color);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 30px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  :global(button:hover) {
    background-color: #1ed760;
    transform: scale(1.05);
  }
  
  :global(input) {
    padding: 10px;
    border-radius: 4px;
    border: 1px solid var(--secondary-color);
    background-color: #2a2a2a;
    color: var(--text-color);
    width: 100%;
    font-size: 16px;
  }
  
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  
  main {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 1rem;
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    box-sizing: border-box;
  }
</style>