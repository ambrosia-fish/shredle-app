<script lang="ts">
  import { onMount } from 'svelte';
  
  // Simple state management
  let isLoaded = false;
  
  onMount(() => {
    // Simple fade-in effect
    setTimeout(() => {
      isLoaded = true;
    }, 100);
  });
</script>

<main class:loaded={isLoaded}>
  <div class="coming-soon-screen">
    <div class="logo">
      <h1>Shredle</h1>
    </div>
    
    <div class="tagline-section">
      <p class="tagline">Guess the guitar solo in 4 tries</p>
      <p class="description">
        Listen to iconic guitar solos and test your rock knowledge.
        From classic rock legends to modern shredders.
      </p>
    </div>
    
    <div class="status-card">
      <div class="status-icon">🚧</div>
      <h2>Coming Soon</h2>
      <p class="status-text">
        We're working on bringing you the ultimate guitar solo guessing game.
        Get ready to test your knowledge of legendary solos!
      </p>
      
      <div class="features-preview">
        <div class="feature">
          <span class="feature-emoji">🎸</span>
          <span>Classic rock solos</span>
        </div>
        <div class="feature">
          <span class="feature-emoji">🔥</span> 
          <span>Daily challenges</span>
        </div>
        <div class="feature">
          <span class="feature-emoji">🏆</span>
          <span>Leaderboards</span>
        </div>
      </div>
    </div>
    
    <div class="notify-section">
      <p class="notify-text">Want to be notified when we launch?</p>
      <div class="email-signup">
        <input 
          type="email" 
          placeholder="Enter your email" 
          class="email-input"
        />
        <button class="notify-btn">
          Notify Me
        </button>
      </div>
    </div>
    
    <footer class="footer">
      <p>&copy; 2025 Shredle. Rock on! 🤘</p>
    </footer>
  </div>
</main>

<style>
  :global(body) {
    background: #0a0a0a;
    color: #ffffff;
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  main {
    max-width: 600px;
    margin: 0 auto;
    padding: 2rem 1rem;
    min-height: 100vh;
    background: #0a0a0a;
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.6s ease;
  }
  
  main.loaded {
    opacity: 1;
    transform: translateY(0);
  }
  
  .coming-soon-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 90vh;
    text-align: center;
    gap: 2rem;
  }
  
  .logo {
    margin-bottom: 1rem;
  }
  
  .logo h1 {
    font-size: 3.5rem;
    font-weight: 700;
    color: #6366f1;
    margin: 0;
    text-shadow: 0 0 30px rgba(99, 102, 241, 0.3);
  }
  
  .tagline-section {
    max-width: 500px;
  }
  
  .tagline {
    font-size: 1.5rem;
    color: #a0a0a0;
    margin-bottom: 1rem;
    font-weight: 600;
  }
  
  .description {
    color: #666;
    font-size: 1.1rem;
    line-height: 1.6;
    margin: 0;
  }
  
  .status-card {
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 20px;
    padding: 2.5rem 2rem;
    max-width: 450px;
    width: 100%;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  }
  
  .status-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }
  
  .status-card h2 {
    font-size: 2rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0 0 1rem 0;
  }
  
  .status-text {
    color: #a0a0a0;
    font-size: 1.1rem;
    line-height: 1.6;
    margin-bottom: 2rem;
  }
  
  .features-preview {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .feature {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem;
    background: #0f0f0f;
    border-radius: 12px;
    border: 1px solid #2a2a2a;
  }
  
  .feature-emoji {
    font-size: 1.5rem;
  }
  
  .feature span:last-child {
    color: #e0e0e0;
    font-weight: 500;
  }
  
  .notify-section {
    max-width: 400px;
    width: 100%;
  }
  
  .notify-text {
    color: #a0a0a0;
    margin-bottom: 1rem;
    font-size: 1.1rem;
  }
  
  .email-signup {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  
  .email-input {
    flex: 1;
    min-width: 200px;
    background: #1a1a1a;
    border: 2px solid #333;
    border-radius: 12px;
    padding: 1rem 1.25rem;
    color: #ffffff;
    font-size: 1rem;
    transition: all 0.3s ease;
  }
  
  .email-input:focus {
    outline: none;
    border-color: #6366f1;
    background: #111;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }
  
  .email-input::placeholder {
    color: #666;
  }
  
  .notify-btn {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    border: none;
    padding: 1rem 2rem;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    white-space: nowrap;
    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
  }
  
  .notify-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
  }
  
  .footer {
    margin-top: 3rem;
  }
  
  .footer p {
    color: #666;
    font-size: 0.9rem;
    margin: 0;
  }
  
  @media (max-width: 480px) {
    .logo h1 {
      font-size: 2.5rem;
    }
    
    .status-card {
      padding: 2rem 1.5rem;
    }
    
    .tagline {
      font-size: 1.3rem;
    }
    
    .email-signup {
      flex-direction: column;
    }
    
    .email-input {
      min-width: auto;
    }
  }
</style>