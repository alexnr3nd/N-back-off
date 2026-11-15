/* src/utils/audioManager.js */

// Import LANGUAGE_AUDIO_LETTERS
import { LANGUAGE_AUDIO_LETTERS as APP_LANGUAGE_AUDIO_LETTERS } from '../constants/gameConstants'; // Aliased to avoid conflict

// Base path relative to the public folder where audio files are stored
// Guard against `process` being undefined in the browser
const _public = (
  typeof process !== 'undefined' &&
  process.env &&
  process.env.PUBLIC_URL
)
  ? process.env.PUBLIC_URL
  : '';
const AUDIO_BASE_PATH = `${_public}/audio`;

// Defines the sets of sounds available
const SOUND_SETS = {
alphabet: {
id: 'alphabet',
items: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), // Fallback English items
language_code: 'en-US',
},
// Future sound sets can be added here
};

// Defines the available voices and their corresponding folder IDs and display names
// Keys MUST match the folder names in public/audio/voices/
const VOICES = {
"google-en-gb-wavenet-n": {
  id: "google-en-gb-wavenet-n",
  name: "English (UK Female)"
},
"google-en-gb-wavenet-o": {
  id: "google-en-gb-wavenet-o",
  name: "English (UK Male)"
},
"google-en-us-wavenet-d": {
  id: "google-en-us-wavenet-d",
  name: "English (US Male)"
},
"google-en-us-wavenet-g": {
  id: "google-en-us-wavenet-g",
  name: "English (US Female)"
},
// --- START: Added new voices for multi-language support ---
// Mandarin Chinese
"cmn-TW-Wavenet-A": {
  id: "cmn-TW-Wavenet-A",
  name: "Mandarin (TW Female)"
},
"cmn-TW-Wavenet-B": {
  id: "cmn-TW-Wavenet-B",
  name: "Mandarin (TW Male)"
},
// Spanish
"es-ES-Wavenet-F": {
  id: "es-ES-Wavenet-F",
  name: "Spanish (ES Female)"
},
"es-ES-Wavenet-G": {
  id: "es-ES-Wavenet-G",
  name: "Spanish (ES Male)"
},
// Hindi
"hi-IN-Wavenet-D": {
  id: "hi-IN-Wavenet-D",
  name: "Hindi (IN Female)"
},
"hi-IN-Wavenet-F": {
  id: "hi-IN-Wavenet-F",
  name: "Hindi (IN Male)"
},
// Arabic
"ar-XA-Wavenet-A": {
  id: "ar-XA-Wavenet-A",
  name: "Arabic (XA Female)"
},
"ar-XA-Wavenet-B": {
  id: "ar-XA-Wavenet-B",
  name: "Arabic (XA Male)"
},
// Bengali
"bn-IN-Wavenet-B": {
  id: "bn-IN-Wavenet-B",
  name: "Bengali (IN Male)"
},
"bn-IN-Wavenet-C": {
  id: "bn-IN-Wavenet-C",
  name: "Bengali (IN Female)"
},
// Portuguese
"pt-PT-Wavenet-B": {
  id: "pt-PT-Wavenet-B",
  name: "Portuguese (PT Male)"
},
"pt-PT-Wavenet-D": {
  id: "pt-PT-Wavenet-D",
  name: "Portuguese (PT Female)"
},
// Japanese
"ja-JP-Wavenet-B": {
  id: "ja-JP-Wavenet-B",
  name: "Japanese (JP Female)"
},
"ja-JP-Wavenet-C": {
  id: "ja-JP-Wavenet-C",
  name: "Japanese (JP Male)"
},
// German
"de-DE-Wavenet-E": {
  id: "de-DE-Wavenet-E",
  name: "German (DE Male)"
},
"de-DE-Wavenet-A": {
  id: "de-DE-Wavenet-A",
  name: "German (DE Female)"
},
// French
"fr-FR-Wavenet-A": {
  id: "fr-FR-Wavenet-A",
  name: "French (FR Female)"
},
"fr-FR-Wavenet-B": {
  id: "fr-FR-Wavenet-B",
  name: "French (FR Male)"
},
// Italian
"it-IT-Wavenet-D": {
  id: "it-IT-Wavenet-D",
  name: "Italian (IT Male)"
},
"it-IT-Wavenet-E": {
  id: "it-IT-Wavenet-E",
  name: "Italian (IT Female)"
},
// Polish
"pl-PL-Wavenet-C": {
  id: "pl-PL-Wavenet-C",
  name: "Polish (PL Male)"
},
"pl-PL-Wavenet-D": {
  id: "pl-PL-Wavenet-D",
  name: "Polish (PL Female)"
},
// --- END: Added new voices for multi-language support ---
};

// Defines the speed buckets based on game difficulty (0.00-0.99)
const SPEED_BUCKETS = [
{ id: 'speed1', maxDifficulty: 0.19 }, // N.00 - N.19
{ id: 'speed2', maxDifficulty: 0.39 }, // N.20 - N.39
{ id: 'speed3', maxDifficulty: 0.59 }, // N.40 - N.59
{ id: 'speed4', maxDifficulty: 0.79 }, // N.60 - N.79
{ id: 'speed5', maxDifficulty: 0.99 }, // N.80 - N.99
];

const AUDIO_FILE_EXTENSION = 'mp3';

// --- Singleton Instances ---
let audioContext = null;
let masterGainNode = null;
const audioBufferCache = new Map(); // key = URL, value = AudioBuffer
let isInitializing = false;
let currentSourceNode = null; // Tracks the currently playing item sound
let feedbackNodes = []; // Tracks currently playing feedback sounds
let visibilityListenerRegistered = false;

// --- Android Bluetooth output-routing fix (see memory/project_bluetooth_audio_routing_bug.md) ---
// Web Audio latches its output sink at AudioContext creation; Android cannot
// re-route a live context (no working setSinkId / devicechange on Android
// WebView), so when Bluetooth connects AFTER creation, audio stays stuck on the
// original device (the phone speaker). We flag the output "stale" when the app
// is foregrounded and rebuild the context at the next game start.
// Kill switch: flip to false and ship a follow-up AAB to disable the behavior.
export const ENABLE_ANDROID_AUDIO_REROUTE = true;
let outputDeviceMaybeStale = false;

/**
* Creates or retrieves the singleton AudioContext and MasterGainNode.
* Needs user interaction to start/resume in many browsers.
* @returns {AudioContext | null} The AudioContext instance or null if unavailable.
*/
const getAudioContextInternal = () => {
if (typeof window === 'undefined') return null;

if (!audioContext && (window.AudioContext || window.webkitAudioContext)) {
try {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  audioContext.onstatechange = () => {
    if (audioContext.state === 'suspended' || audioContext.state === 'interrupted') {
      // AudioContext state changed - will resume on next interaction or visibility change
    }
  };
  masterGainNode = audioContext.createGain();
  masterGainNode.connect(audioContext.destination);
} catch (error) {
  console.error('[AudioManager] Error creating AudioContext:', error);
  audioContext = null;
  masterGainNode = null;
}
}
else if (audioContext && !masterGainNode) {
  try {
      console.warn('[AudioManager] Context exists but GainNode missing. Attempting recreation.');
      masterGainNode = audioContext.createGain();
      masterGainNode.connect(audioContext.destination);
  } catch (error) {
       console.error('[AudioManager] Error recreating MasterGainNode:', error);
       masterGainNode = null;
  }
}
return audioContext;
};

/**
* Primes the audio context by playing a 1-sample silent buffer to stabilize the
* playback pipeline immediately after resume(). NOTE: a silent buffer does NOT
* wake a sleeping OS audio output device — Android pauses silent output to save
* power, so silence cannot re-acquire the stream. Use warmUpTone() for the
* device-wake on countdown-skipping paths. The durationSeconds param is retained
* for the internal resume() callers (which use the default 1-sample form).
* @param {number} [durationSeconds=0] - Length of silent buffer. 0 → 1 sample.
*/
const primeAudioContext = (durationSeconds = 0) => {
const context = getAudioContextInternal();
if (!context || context.state !== 'running' || !masterGainNode) return;

try {
    const sampleCount = Math.max(1, Math.floor(durationSeconds * context.sampleRate));
    const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(masterGainNode);
    source.start(0);
} catch (error) {
    console.error("[AudioManager] Error priming AudioContext:", error);
}
};

/**
* Plays a short, soft, AUDIBLE warm-up tone to wake the OS audio output device
* before the first stimulus on paths that bypass the countdown beeps (results-
* page Continue/Retry/level-change). Android pauses the audio output stream
* during the silent results-page gap to save power, and a SILENT buffer does
* not re-acquire it — only real audible output does (the same reason the
* dashboard countdown beeps never had a silent-first-letter bug).
*
* Load-bearing design notes:
* - Duration (~0.4s) MUST exceed the first-trial lead (~250ms initialDelayMs) so
*   the tone is still playing when trial 0's letter begins: the tone (not the
*   letter) absorbs the device's cold-start warm-up latency, and the output is
*   provably hot at letter onset.
* - NOT tracked as currentSourceNode and NOT added to feedbackNodes. Both
*   playItemBuffer() and the audio effect call stopCurrentSound(), which only
*   touches currentSourceNode — leaving this tone untracked is what lets it and
*   the first letter coexist (they mix at masterGainNode). Do not "tidy" it into
*   the tracked feedback path.
* - Synchronous running-state guard only — no async resume here (callers
*   resume() first), so the tone fires immediately and keeps its lead.
*/
const warmUpTone = () => {
const context = getAudioContextInternal();
if (!context || context.state !== 'running' || !masterGainNode) return;

try {
    const now = context.currentTime;
    const peakVolume = 0.06; // ~1/4 of the 0.25 countdown beep — subtle but real
    const duration = 0.4;    // >= the ~250ms first-trial lead, so it overlaps trial 0

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(600, now);
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.linearRampToValueAtTime(peakVolume, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gainNode);
    gainNode.connect(masterGainNode);
    // Untracked / fire-and-forget — self-clean on end (see design notes above).
    oscillator.onended = () => {
        try { gainNode.disconnect(); oscillator.disconnect(); } catch (e) {}
    };
    oscillator.start(now);
    oscillator.stop(now + duration + 0.05);
} catch (error) {
    console.error("[AudioManager] Error playing warm-up tone:", error);
}
};

/**
* Tears down the current AudioContext and creates a fresh one.
* Used to recover from iOS "interrupted" state when resume() alone doesn't work.
* @returns {AudioContext | null} The new AudioContext, or null on failure.
*/
const recreateAudioContext = () => {
  const oldContext = audioContext;

  // Close the old context (fire-and-forget)
  if (oldContext) {
    try { oldContext.close(); } catch (e) { /* ignore */ }
  }

  // Reset all references tied to the old context
  audioContext = null;
  masterGainNode = null;
  currentSourceNode = null;
  feedbackNodes = [];
  audioBufferCache.clear(); // Decoded buffers are tied to the old context

  // Create a fresh context
  const newContext = getAudioContextInternal();
  if (newContext) {
    // Recreated AudioContext after interrupted state
  } else {
    console.error('[AudioManager] Failed to recreate AudioContext.');
  }
  return newContext;
};

/**
* Android Bluetooth fix: mark that the active OS audio output device may have
* changed (e.g. Bluetooth headphones connected before launch, while in the
* foreground, or while backgrounded). Consumed at the next session start by
* recreateForOutputChange(). No-op unless the fix is enabled. Only ever called
* on Android — the listeners that call this (capacitorInit.js) are registered
* only inside the Android app.
* @param {string} [source] - Trigger tag for field diagnostics ('cold-start',
*   'native-device-change', 'app-foreground'). console.info is captured into
*   feedback reports by logInterceptor.js.
*/
const markOutputDeviceStale = (source = 'unspecified') => {
    if (!ENABLE_ANDROID_AUDIO_REROUTE) return;
    const alreadyFlagged = outputDeviceMaybeStale;
    outputDeviceMaybeStale = true;
    console.info(`[AudioManager] Output device flagged stale (source: ${source}${alreadyFlagged ? ', already flagged' : ''}).`);
};

/**
* DIAGNOSTIC (2026-06, see memory/project_bluetooth_audio_routing_bug.md): enumerate
* the native Android audio OUTPUT devices at session start and log them so feedback
* reports show whether a Bluetooth A2DP sink was even AVAILABLE while audio still
* came out the phone speaker (a routing/binding failure) vs only SCO / none present.
* `outputLatency` alone is a host-buffering heuristic, not a device id — this turns
* it into hard data. Backed by the read-only AudioRouteDebugPlugin.java; fire-and-
* forget and log-only with NO routing side effects. Resolves to a silent no-op off
* Android (the plugin is absent → the dynamic import or call throws → caught). Only
* ever reached on Android, since recreateForOutputChange() is Android-gated upstream.
* @param {string} tag - context label for the log line ('at-recreate', 'settled-2.5s').
*/
const logNativeOutputDevices = async (tag) => {
    try {
        const { registerPlugin } = await import('@capacitor/core');
        const AudioRouteDebug = registerPlugin('AudioRouteDebug');
        const info = await AudioRouteDebug.getOutputDevices();
        const labels = Array.isArray(info?.devices) ? info.devices.map(d => d.label).join(', ') : '';
        console.info(`[AudioManager] Native output devices (${tag}): [${labels}] hasA2dp=${info?.hasA2dp} hasSco=${info?.hasSco} hasSpeaker=${info?.hasSpeaker} hasWired=${info?.hasWired} a2dpOn=${info?.a2dpOn} speakerphoneOn=${info?.speakerphoneOn} musicActive=${info?.musicActive}`);
    } catch (e) {
        // Plugin exists only in the Android app build — silently ignore elsewhere.
    }
};

/**
* Android Bluetooth fix: if the output device was flagged stale since the last
* rebuild, tear down + recreate the AudioContext so the fresh context binds to
* the CURRENTLY-active output device (Bluetooth A2DP if now connected).
*
* MUST be called from a session-start user gesture (e.g. startCountdown) BEFORE
* resume(), and NEVER mid-trial. The caller's existing resume()+preload()+warmUp()
* sequence then rebuilds the (context-bound) decoded buffers and wakes the new
* output device, preserving the first-trial A/V sync. Returns true if it rebuilt.
*/
const recreateForOutputChange = () => {
    if (!ENABLE_ANDROID_AUDIO_REROUTE || !outputDeviceMaybeStale) return false;
    outputDeviceMaybeStale = false;
    try {
        recreateAudioContext();
        console.info('[AudioManager] AudioContext recreated for output-device change.');
        // Field discriminator (log-only, advisory): outputLatency is typically
        // ~0.1-0.3s on Bluetooth A2DP vs ~0.02-0.05s on the phone speaker. It is a
        // host-buffering HEURISTIC, not a device id, and not meaningful until the
        // context is running. SAMPLE it at several offsets (after the caller's
        // resume() runs; countdown masks 3s, skipCountdown sessions play before 2s)
        // so a transient mid-route-migration reading can be told apart from a STABLE
        // speaker binding — a single one-shot probe could not. Corroborated by the
        // native device enumeration below (the hard signal). See
        // memory/project_bluetooth_audio_routing_bug.md.
        [1000, 2000, 4000, 6000].forEach((ms) => {
            setTimeout(() => {
                try {
                    if (audioContext) {
                        console.info(`[AudioManager] Post-recreate route probe (+${ms}ms): state=${audioContext.state} outputLatency=${audioContext.outputLatency} baseLatency=${audioContext.baseLatency} sampleRate=${audioContext.sampleRate}`);
                    }
                } catch (e) { /* diagnostics must never throw */ }
            }, ms);
        });
        // Native output-device enumeration: at recreate time, then again after the
        // route would have settled. Tells us whether A2DP was AVAILABLE at all.
        logNativeOutputDevices('at-recreate');
        setTimeout(() => logNativeOutputDevices('settled-2.5s'), 2500);
        return true;
    } catch (e) {
        console.error('[AudioManager] recreateForOutputChange failed:', e);
        return false;
    }
};

/**
* Attempts to resume the AudioContext if it's suspended.
* MUST be called as a direct result of user interaction (e.g., button click)
* when `skipRecreation` is false (default), because the recreation fallback
* requires a live user gesture on iOS. Non-gesture callers (e.g. visibilitychange)
* MUST pass `{ skipRecreation: true }`.
* Calls `primeAudioContext` after successful resume.
* @param {{ skipRecreation?: boolean }} [options]
* @returns {Promise<boolean>} True if context is running or was successfully resumed, false otherwise.
*/
const resumeContext = async ({ skipRecreation = false } = {}) => {
const context = getAudioContextInternal();
if (!context) {
  console.warn('[AudioManager] resumeContext: Cannot resume, context not available.');
  return false;
}

if (context.state === 'suspended') {
try {
  await context.resume();
  if (context.state === 'running') {
      primeAudioContext();
      return true;
  } else {
     console.warn(`[AudioManager] Context state is '${context.state}' after resume attempt.`);
     return false;
  }
} catch (error) {
  console.error('[AudioManager] Failed to resume AudioContext:', error);
  return false;
}
} else if (context.state === 'running') {
return true;
} else if (context.state === 'interrupted') {
  // iOS-specific: try resume() first (works if interruption source is gone)
  try {
    await context.resume();
    if (context.state === 'running') {
      primeAudioContext();
      return true;
    }
  } catch (e) {
    // resume() failed, will try recreation below
  }

  // Recreating an AudioContext on iOS requires a live user gesture; the
  // resulting context starts suspended and can only be unlocked from one.
  // Non-gesture callers (visibilitychange) skip this path and leave the
  // context in 'interrupted' state so the next user-gesture call can recover it.
  if (skipRecreation) {
    return false;
  }

  // Resume didn't work — recreate the context entirely (inside user gesture).
  const newContext = recreateAudioContext();
  if (newContext) {
    try {
      await newContext.resume();
      if (newContext.state === 'running') {
        primeAudioContext();
        return true;
      }
    } catch (e) { /* fall through to return false */ }
  }
  return false;
} else {
  console.warn(`[AudioManager] AudioContext in unexpected state: ${context.state}.`);
  return false;
}
};

/**
* Maps game difficulty (0.00-0.99) to a speed bucket ID ('speed1', 'speed2', etc.).
* @param {number} difficulty - The game's fractional difficulty.
* @returns {string} The corresponding speed bucket ID.
*/
const mapDifficultyToSpeedId = (difficulty) => {
const clampedDifficulty = Math.max(0, Math.min(0.99, difficulty || 0));
for (const bucket of SPEED_BUCKETS) {
if (clampedDifficulty <= bucket.maxDifficulty) {
  return bucket.id;
}
}
console.warn(`[AudioManager] mapDifficultyToSpeedId fallback for difficulty ${difficulty}.`);
return SPEED_BUCKETS[SPEED_BUCKETS.length - 1].id;
};

/**
* Constructs the URL path for a specific audio file.
* Handles fallback if the voiceId is invalid.
* @param {string} soundSetId - e.g., 'alphabet'
* @param {string} voiceId - e.g., 'google-en-gb-wavenet-n'
* @param {string} itemId - e.g., 'A' (NOT uppercased here for native chars)
* @param {string} speedId - e.g., 'speed1'
* @returns {string|null} The full URL path or null if errors occur.
*/
const getAudioPath = (soundSetId, voiceId, itemId, speedId) => {
let effectiveVoiceId = voiceId;
const availableVoiceIds = Object.keys(VOICES);

if (!VOICES[effectiveVoiceId]) {
if (availableVoiceIds.length > 0) {
    effectiveVoiceId = availableVoiceIds[0];
    console.warn(`[AudioManager] Unknown voiceId: '${voiceId}'. Falling back to '${effectiveVoiceId}'.`);
} else {
    console.error("[AudioManager] Cannot get audio path: No voices defined.");
    return null;
}
}

if (!SOUND_SETS[soundSetId]) {
  console.error(`[AudioManager] Invalid soundSetId '${soundSetId}'.`);
  return null;
}
if (!itemId || typeof itemId !== 'string' || !speedId) {
  console.error(`[AudioManager] Missing or invalid itemId/speedId.`);
  return null;
}

// Path: /audio/voices/{voiceId}/{soundSetId}/{ITEM_ID}/{speedId}.mp3
// ITEM_ID is NOT uppercased here to support native characters in folder names.
return `${AUDIO_BASE_PATH}/voices/${effectiveVoiceId}/${soundSetId}/${itemId}/${speedId}.${AUDIO_FILE_EXTENSION}`;
};

/**
* Loads an audio file, decodes it, and caches the AudioBuffer.
* @param {string} url - The URL of the audio file.
* @returns {Promise<AudioBuffer | null>} The decoded AudioBuffer or null on failure.
*/
const loadAudioBuffer = async (url) => {
const context = getAudioContextInternal();
if (!context) {
  console.error("[AudioManager] loadAudioBuffer: AudioContext not available.");
  return null;
}
if (audioBufferCache.has(url)) {
return audioBufferCache.get(url);
}

try {
const response = await fetch(url);
// status 0 is a SUCCESS here, not a failure. On iOS, Capacitor's
// WebViewAssetHandler serves media extensions (.mp3 included) with a plain
// URLResponse instead of an HTTPURLResponse, so the response carries no HTTP
// status line: fetch reports `status: 0, ok: false` even though the body is
// complete. Rejecting on !ok silenced every letter in the iOS app while the
// oscillator-based beeps kept working. Android (androidScheme: 'https') and
// the web both get a real 200, so their behavior is unchanged — and a file
// that is genuinely missing on iOS fails the scheme task, which REJECTS the
// fetch and lands in the catch below rather than arriving here as a 404.
if (!response.ok && response.status !== 0) {
  throw new Error(`HTTP error! Status: ${response.status} for ${url}`);
}
const arrayBuffer = await response.arrayBuffer();
// With the status check relaxed, an empty body is the real failure signal.
if (!arrayBuffer || arrayBuffer.byteLength === 0) {
  throw new Error(`Empty audio response for ${url}`);
}
const audioBuffer = await context.decodeAudioData(arrayBuffer);
audioBufferCache.set(url, audioBuffer);
return audioBuffer;
} catch (error) {
console.error(`[AudioManager] Error loading/decoding ${url}:`, error);
audioBufferCache.delete(url);
return null;
}
};

/**
* Plays a loaded AudioBuffer for an item (letter/number).
* Stops previous item sounds. Handles context state.
* @param {AudioBuffer} buffer - The AudioBuffer to play.
*/
// TODO(2026-06-11): remove onSourceStart param + the callback block below (audio-lag diagnostic added 2026-05-12; see memory/project_audio_timing_instrumentation_todo.md)
const playItemBuffer = (buffer, onSourceStart = null) => {
const context = getAudioContextInternal();
if (!context || !masterGainNode || !buffer) {
  console.warn("[AudioManager] playItemBuffer: Cannot play, missing context/gain/buffer.");
  return;
}

if (context.state !== 'running') {
console.warn(`[AudioManager] playItemBuffer: Context state is '${context.state}'. Playback deferred pending resume.`);
return;
}

stopCurrentSound();

try {
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(masterGainNode);

  currentSourceNode = source;

  source.onended = () => {
      if (currentSourceNode === source) {
          currentSourceNode = null;
      }
      try { source.disconnect(); } catch (e) {}
  };

  source.start(0);

  if (typeof onSourceStart === 'function') {
    try {
      onSourceStart({
        audioContextTime: context.currentTime,
        outputLatency: typeof context.outputLatency === 'number' ? context.outputLatency : null,
        baseLatency: typeof context.baseLatency === 'number' ? context.baseLatency : null,
        state: context.state,
      });
    } catch (e) { /* swallow — diagnostics must never break playback */ }
  }

} catch (error) {
 console.error("[AudioManager] Error starting item playback:", error);
 if (currentSourceNode && currentSourceNode.buffer === buffer) {
     currentSourceNode = null;
 }
}
};

/**
* Stops the currently playing *item* (letter/number) sound immediately.
*/
const stopCurrentSound = () => {
if (currentSourceNode) {
    try {
        currentSourceNode.stop(0);
        currentSourceNode.disconnect();
    } catch (e) {
    } finally {
        currentSourceNode = null;
    }
}
};

/**
* Stops all currently playing *feedback* sounds immediately.
*/
const stopFeedbackSounds = () => {
if (feedbackNodes.length > 0) {
    feedbackNodes.forEach(({ oscillator, gainNode }) => {
        try {
            oscillator.stop(0);
            oscillator.disconnect();
            gainNode.disconnect();
        } catch(e) {}
    });
    feedbackNodes = [];
}
};

/**
* Registers a visibilitychange listener to auto-resume the AudioContext
* when the user returns to the tab. Safari suspends the context on tab switch,
* and without this, audio is lost until a page reload.
*/
const registerVisibilityListener = () => {
    if (visibilityListenerRegistered || typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && audioContext) {
            // visibilitychange is NOT a user gesture on iOS. Only attempt a plain
            // resume() here — never recreate the context, because a non-gesture
            // creation leaves the new context suspended and unreachable until the
            // next user gesture. If resume() fails, the context stays in its
            // interrupted/suspended state and the next Start / Resume button
            // click will run the full recovery path (with recreation) inside a
            // live user gesture.
            resumeContext({ skipRecreation: true }).catch(() => {
                // Silently ignore — resumeContext already logs errors internally
            });
        }
    });

    visibilityListenerRegistered = true;
};

/**
* Initializes the AudioManager: creates AudioContext and MasterGainNode.
* Safe to call multiple times. Should ideally be called early.
* @returns {boolean} True if context and gain node are ready or created, false otherwise.
*/
const initAudioManager = () => {
if (isInitializing) return !!(audioContext && masterGainNode);
if (audioContext && masterGainNode) {
  registerVisibilityListener();
  return true;
}

isInitializing = true;
const context = getAudioContextInternal();
const success = !!(context && masterGainNode);
isInitializing = false;

if (success) {
  registerVisibilityListener();
} else {
  console.error('[AudioManager] Initialization failed (Context or GainNode unavailable).');
}
return success;
};

/**
* Plays the audio for a specific item (e.g., letter).
* Loads the audio file if needed. Handles voice/speed selection.
* @param {string} itemId - The item identifier (e.g., 'A'). Must be non-empty.
* @param {number} difficulty - Game difficulty (0.00-0.99).
* @param {object} [options={}] - Optional parameters.
* @param {string} [options.soundSetId='alphabet'] - ID of the sound set.
* @param {string} [options.voiceId] - ID of the voice. Uses first available if invalid/missing.
* @returns {Promise<void>} Resolves when playback is attempted or skipped.
*/
const playItem = async (itemId, difficulty, options = {}) => {
if (!itemId || typeof itemId !== 'string' || itemId.length === 0) {
console.warn(`[AudioManager] Invalid itemId: ${itemId}. Playback skipped.`);
return;
}
if (!initAudioManager()) {
   console.error('[AudioManager] playItem: Cannot play, AudioManager not initialized.');
   return;
}

let voiceIdToUse = options.voiceId;
const availableVoiceIds = Object.keys(VOICES);
if (!voiceIdToUse || !VOICES[voiceIdToUse]) {
 if (availableVoiceIds.length > 0) {
    voiceIdToUse = availableVoiceIds[0];
    if (options.voiceId) console.warn(`[AudioManager] playItem: Invalid voiceId '${options.voiceId}'. Defaulting to '${voiceIdToUse}'.`);
 } else {
    console.error(`[AudioManager] playItem Error: No voices defined.`);
    return;
 }
}

const soundSetIdToUse = options.soundSetId || 'alphabet';
if (!SOUND_SETS[soundSetIdToUse]) {
 console.error(`[AudioManager] playItem Error: Invalid soundSetId '${soundSetIdToUse}'.`);
 return;
}

const speedId = mapDifficultyToSpeedId(difficulty);
// itemId is NOT uppercased here to support native characters
const url = getAudioPath(soundSetIdToUse, voiceIdToUse, itemId, speedId);

if (!url) { return; }

try {
// TODO(2026-06-11): remove wasCachedBeforeAwait + onBufferReady block + onSourceStart pass-through (diagnostic; see memory/project_audio_timing_instrumentation_todo.md)
const wasCachedBeforeAwait = audioBufferCache.has(url);
const buffer = await loadAudioBuffer(url);
if (buffer) {
  if (typeof options.onBufferReady === 'function') {
    try {
      options.onBufferReady({ wasCached: wasCachedBeforeAwait, url });
    } catch (e) { /* swallow — diagnostics must never break playback */ }
  }
  playItemBuffer(buffer, options.onSourceStart);
} else {
  console.warn(`[AudioManager] Playback skipped for ${itemId} (Voice: ${voiceIdToUse}, Speed: ${speedId}) due to loading failure.`);
}
} catch (error) {
console.error(`[AudioManager] Unexpected error in playItem for ${url}:`, error);
}
};

/**
* Plays a simple synthesized feedback tone ('correct' or 'incorrect'/'missed').
* Uses a softer 'sine' wave for incorrect sounds.
* @param {'correct' | 'incorrect' | 'missed'} type - The type of feedback sound.
*/
const playFeedbackSound = (type) => {
const context = getAudioContextInternal();
if (!context || !masterGainNode) {
  console.warn('[AudioManager] playFeedbackSound: Cannot play, context/gain not ready.');
  return;
}

const generateAndPlay = () => {
  stopFeedbackSounds();
  try {
    let frequency, duration, vol, waveType;
    const effectiveType = type === 'missed' ? 'incorrect' : type;

    switch (effectiveType) {
      case 'correct': frequency = 880; duration = 0.12; vol = 0.25; waveType = 'sine'; break;
      case 'incorrect': frequency = 220; duration = 0.18; vol = 0.25; waveType = 'sine'; break;
      default:
          console.warn('[AudioManager] Unknown feedback sound type:', type); return;
    }

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = waveType;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    gainNode.gain.setValueAtTime(0.001, context.currentTime);
    gainNode.gain.linearRampToValueAtTime(vol, context.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.connect(gainNode);
    gainNode.connect(masterGainNode);
    const nodeRef = { oscillator, gainNode };
    feedbackNodes.push(nodeRef);
    oscillator.onended = () => {
       try { gainNode.disconnect(); oscillator.disconnect(); } catch(e) {}
       feedbackNodes = feedbackNodes.filter(n => n !== nodeRef);
    };
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + duration + 0.05);

  } catch (error) {
    console.error('[AudioManager] Error playing feedback sound:', error);
  }
};

if (context.state === 'running') {
  generateAndPlay();
} else if (context.state === 'suspended' || context.state === 'interrupted') {
  context.resume().then(() => {
    if (context.state === 'running') {
      generateAndPlay();
    }
  }).catch((err) => {
    console.warn('[AudioManager] playFeedbackSound: Resume failed:', err);
  });
} else {
  console.error(`[AudioManager] Cannot play feedback ('${type}') in context state: ${context.state}`);
}
};


/**
* Preloads audio files for given configurations.
* Uses representative difficulties to cover all speed buckets by default.
* @param {object} [config={}] - Preloading config.
* @param {string} [config.soundSetId='alphabet'] - Sound set ID.
* @param {string} [config.voiceId] - Voice ID. Defaults to first available.
* @param {number[]} [config.difficulties] - Difficulties for speed buckets. Defaults cover all 5.
* @returns {Promise<void>} Resolves when all preload attempts are complete.
*/
const preloadAudio = async (config = {}) => {
if (!initAudioManager()) {
    console.warn('[AudioManager] Preload skipped: AudioManager not initialized.');
    return;
}

let voiceIdToUse = config.voiceId;
const availableVoiceIds = Object.keys(VOICES);
if (!voiceIdToUse || !VOICES[voiceIdToUse]) {
    if (availableVoiceIds.length > 0) {
        voiceIdToUse = availableVoiceIds[0];
        if(config.voiceId) console.warn(`[AudioManager] Preload: Invalid voiceId '${config.voiceId}'. Defaulting to '${voiceIdToUse}'.`);
    } else {
        console.warn('[AudioManager] Preload skipped: No voices defined.');
        return;
    }
}

const soundSetIdToUse = config.soundSetId || 'alphabet';

let itemsToPreload = [];
const voiceLangParts = voiceIdToUse.split('-');
if (voiceLangParts.length >= 2) {
    // Skip 'google-' prefix when extracting language code
    // e.g., 'google-en-gb-wavenet-n' → 'en', not 'google-en'
    const langStartIdx = voiceLangParts[0] === 'google' ? 1 : 0;
    const langCode = voiceLangParts[langStartIdx];
    if (APP_LANGUAGE_AUDIO_LETTERS[langCode] && APP_LANGUAGE_AUDIO_LETTERS[langCode].letters) {
        const langSpecificLetterTiers = APP_LANGUAGE_AUDIO_LETTERS[langCode].letters;
        const uniqueLetters = new Set();
        langSpecificLetterTiers.forEach(tier => {
            tier.forEach(letter => uniqueLetters.add(letter));
        });
        itemsToPreload = Array.from(uniqueLetters);
    } else {
        console.warn(`[AudioManager] Preload: No letter set found for langCode '${langCode}' (from voice '${voiceIdToUse}'). Falling back to default English alphabet for preloading.`);
        itemsToPreload = SOUND_SETS.alphabet.items;
    }
} else {
    console.warn(`[AudioManager] Preload: Could not determine language from voiceId '${voiceIdToUse}'. Falling back to default English alphabet for preloading.`);
    itemsToPreload = SOUND_SETS.alphabet.items;
}

if (itemsToPreload.length === 0) {
    console.warn(`[AudioManager] Preload: No items determined for preloading with voice '${voiceIdToUse}'. Skipping.`);
    return;
}


const difficultiesToLoad = config.difficulties || [0.05, 0.25, 0.45, 0.65, 0.85];
const speedIdsToLoad = new Set(difficultiesToLoad.map(d => mapDifficultyToSpeedId(d)));

const urlsToLoad = [];
for (const item of itemsToPreload) {
    for (const speedId of speedIdsToLoad) {
        // itemId is NOT uppercased here for native character support in paths
        const url = getAudioPath(soundSetIdToUse, voiceIdToUse, item, speedId);
        if (url && !audioBufferCache.has(url)) {
            urlsToLoad.push(url);
        }
    }
}

if (urlsToLoad.length === 0) { return; }

const loadPromises = urlsToLoad.map(url =>
    loadAudioBuffer(url).catch(e => {
        console.error(`[AudioManager] Preload failed for ${url}: ${e}`);
        return null;
    })
);

try {
    await Promise.all(loadPromises);
} catch (error) {
    console.error('[AudioManager] Unexpected error during preload Promise.all:', error);
}
};

// --- PUBLIC API EXPORTS ---
export default {
// Core lifecycle
init: initAudioManager,
resume: resumeContext,
prime: primeAudioContext,
warmUp: warmUpTone,

// Android Bluetooth output-routing fix
markOutputDeviceStale,
recreateForOutputChange,

// Playback controls
playItem,
playFeedbackSound,
stopCurrentSound,
stopFeedbackSounds,

// Preloading
preload: preloadAudio,

// Accessors
getAudioContext: () => getAudioContextInternal(),
getMasterGainNode: () => masterGainNode,

// Configuration data
VOICES,
getAvailableVoices: () => ({ ...VOICES }),
getAvailableSoundSets: () => ({ ...SOUND_SETS }),
};
