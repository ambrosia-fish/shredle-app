<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  
  function goHome() {
    window.location.href = '/';
  }
</script>

<div class="error-page">
  <h1>Something went wrong</h1>
  
  <div class="error-details">
    <p>We encountered an error processing your request.</p>
    
    {#if $page.error?.message}
      <div class="error-message">
        <p><strong>Error:</strong> {$page.error.message}</p>
      </div>
    {/if}
    
    <p>Please try one of the following:</p>
    <ul>
      <li>Refresh the page and try again</li>
      <li>Go back to the home page</li>
      <li>Clear your browser cache and cookies</li>
      <li>Try a different browser</li>
    </ul>
  </div>
  
  <div class="actions">
    <button on:click={() => window.location.reload()}>Refresh Page</button>
    <button on:click={goHome}>Go to Home Page</button>
  </div>
</div>

<style>
  .error-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 2rem;
    text-align: center;
  }
  
  h1 {
    color: #e74c3c;
    margin-bottom: 2rem;
  }
  
  .error-details {
    background-color: rgba(30, 30, 30, 0.9);
    border-radius: 10px;
    padding: 2rem;
    max-width: 600px;
    margin-bottom: 2rem;
    text-align: left;
  }
  
  .error-message {
    background-color: rgba(231, 76, 60, 0.1);
    border-left: 4px solid #e74c3c;
    padding: 1rem;
    margin: 1rem 0;
    border-radius: 0 4px 4px 0;
  }
  
  ul {
    margin-top: 1rem;
    padding-left: 1.5rem;
  }
  
  li {
    margin-bottom: 0.5rem;
  }
  
  .actions {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    justify-content: center;
  }
  
  button {
    padding: 0.8rem 1.5rem;
  }
</style>