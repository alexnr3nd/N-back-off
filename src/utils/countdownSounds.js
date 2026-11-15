/* src/utils/countdownSounds.js */
import audioManager from './audioManager'; // Import the central audio manager

/**
 * Play a countdown beep sound using the shared audioManager context and gain node.
 * Relies on the audio context being 'running' due to an earlier user interaction
 * that called audioManager.resume().
 *
 * @param {number} countdownValue - Current countdown value (e.g., 3, 2, 1).
 */
export const playCountdownSound = (countdownValue) => {
  // Get context and gain node via the manager's exported functions
  const context = audioManager.getAudioContext();
  const mainGain = audioManager.getMasterGainNode();

  // Pre-condition check: Ensure context and gain node are available.
  if (!context || !mainGain) {
    console.warn('[CountdownSounds] Cannot play: AudioManager context or gain node not ready. Was resume() called successfully after user interaction?');
    return; // Exit if essential components aren't ready
  }

  // Only play sounds for the actual countdown numbers (e.g., 3, 2, 1)
  if (countdownValue <= 0 || typeof countdownValue !== 'number') {
    // console.log(`[CountdownSounds] Skipping sound for value: ${countdownValue}`);
    return;
  }

  // Internal function to create and play the sound IF the context is running
  const generateAndPlay = () => {
    try {
      // Create nodes for this specific sound instance
      const oscillator = context.createOscillator();
      const gainNode = context.createGain(); // Local gain for this sound's envelope

      // Sound characteristics (increasing pitch for countdown)
      oscillator.type = 'sine'; // Simple, clear tone
      // Frequency increases as countdownValue decreases (3=low, 1=high)
      const baseFrequency = 440; // A4 note
      const frequencyStep = 110; // How much pitch increases per step
      oscillator.frequency.setValueAtTime(baseFrequency + ((3 - countdownValue) * frequencyStep), context.currentTime);

      // Envelope (volume control over time)
      const startTime = context.currentTime;
      const attackTime = 0.01; // Very short attack
      const decayTime = 0.12; // Short decay/duration
      const peakVolume = 0.25; // Keep volume moderate

      gainNode.gain.setValueAtTime(0.001, startTime); // Start silent
      gainNode.gain.linearRampToValueAtTime(peakVolume, startTime + attackTime); // Quick ramp up
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + attackTime + decayTime); // Fade out

      // Connect the nodes: Oscillator -> Local Gain -> Master Gain -> Destination (Speakers)
      oscillator.connect(gainNode);
      gainNode.connect(mainGain);

      // Cleanup function when the sound finishes playing
      oscillator.onended = () => {
        try {
          // Disconnect nodes to free up resources
          gainNode.disconnect();
          oscillator.disconnect();
        } catch (e) {
          // Ignore potential errors if nodes are already disconnected
        }
      };

      // Start the sound now
      oscillator.start(startTime);
      // Schedule the sound to stop slightly after the envelope ends
      oscillator.stop(startTime + attackTime + decayTime + 0.05);

    } catch (error) {
      console.error('[CountdownSounds] Error generating or playing countdown sound:', error);
    }
  };

  // *** CRITICAL CHECK ***
  // Only attempt to play if the audio context is actually running.
  if (context.state === 'running') {
    // console.log(`[CountdownSounds] Context is running. Playing sound for ${countdownValue}`);
    generateAndPlay();
  } else {
    // Log a warning if called when context isn't running. This indicates the
    // user interaction resume might have failed or wasn't called yet.
    console.warn(`[CountdownSounds] Skipped playback for ${countdownValue}: Context state is '${context.state}'. Needs to be 'running'.`);
  }
};

/**
 * Intended to be called ONCE as a result of direct user interaction (e.g., button click)
 * BEFORE any audio needs to play. This attempts to unlock the AudioContext on mobile.
 * It simply delegates the resume attempt to the central audioManager.
 *
 * @returns {Promise<boolean>} A promise that resolves to true if the context is
 * running or was successfully resumed, false otherwise.
 */
export const initializeAudio = async () => {
  // Ensure the manager itself has had a chance to initialize (create context if needed)
  audioManager.init();
  // Attempt to resume the context via the manager - THIS IS THE KEY STEP FOR MOBILE
  return await audioManager.resume();
};

// Export the functions for use in other parts of the application
export default {
  playCountdownSound,
  initializeAudio // Keep this export, even if primarily called elsewhere, for clarity
};
