/* src/components/tutorial/tutorialSteps.js */
/* Protocol Guide - Step Definitions */

/**
 * Tutorial step structure:
 * - id: Unique identifier
 * - phase: Group identifier (intro, 2back-visual, 2back-audio, dual, progression, complete)
 * - title: Step header text
 * - content: Main instruction text
 * - type: 'info' (just text), 'trial' (interactive), 'complete' (final step)
 * - nBack: N-back level for this step (2 for all practice steps)
 * - modality: 'visual' | 'audio' | 'dual'
 * - trialIndex: Which trial in the sequence this step represents
 * - expectResponse: 'position' | 'audio' | 'both' | false - what button(s) user should press
 * - isMatch: { visual: boolean, audio: boolean } - whether this trial is a match
 * - highlightHistory: Whether to highlight the N-back target in history display
 * - visibleWhen: 'hasClassic' | 'noClassic' — cohort visibility. Omit to always show.
 *   Users without Classic access (freeTier 'limited_modern') must not be taught a
 *   mode they cannot play. See getStepsByPhase below.
 */

export const TUTORIAL_STEPS = [
  // ═══════════════════════════════════════════════════════════════
  // PHASE: INTRO (4 steps)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'intro-1',
    phase: 'intro',
    title: 'Welcome to Dual N-Back',
    content: 'This exercise trains your working memory — the mental workspace you use for learning, problem-solving, and focus. Each session usually takes less than a minute.',
    type: 'info',
  },
  {
    id: 'intro-2',
    phase: 'intro',
    title: 'How It Works',
    content: 'You\'ll see squares flash on a grid and hear letters spoken. Your task is to remember what happened a few trials ago and identify when something repeats.',
    type: 'info',
  },
  {
    id: 'intro-3',
    phase: 'intro',
    title: 'The "N-Back" in Dual N-Back',
    content: 'The "N" refers to how many trials back you need to remember. At 2-back, you compare the current stimulus to what happened 2 trials ago. As you improve, you\'ll advance to 3-back, 4-back, and beyond.',
    type: 'info',
  },
  {
    id: 'intro-4',
    phase: 'intro',
    title: 'The "Dual" in Dual N-Back',
    content: 'You\'ll track both position AND audio simultaneously. They\'re independent — one can match while the other doesn\'t. This dual-task aspect is what makes the exercise effective.',
    type: 'info',
  },

  // ═══════════════════════════════════════════════════════════════
  // PHASE: 2-BACK VISUAL (5 steps)
  // ═══════════════════════════════════════════════════════════════
  {
    id: '2back-visual-intro',
    phase: '2back-visual',
    title: 'Position Training',
    content: 'Let\'s start with positions only. Watch the grid — you\'ll see a square light up in different positions. Remember: we\'re looking for matches from 2 trials back.',
    type: 'info',
    modality: 'visual',
    nBack: 2,
  },
  {
    id: '2back-visual-1',
    phase: '2back-visual',
    title: 'Trial 1: First Position',
    content: 'A square appears. Remember this position — you\'ll need it in 2 trials.',
    type: 'trial',
    modality: 'visual',
    nBack: 2,
    trialIndex: 0,
    expectResponse: false,
    isMatch: { visual: false, audio: false },
  },
  {
    id: '2back-visual-2',
    phase: '2back-visual',
    title: 'Trial 2: Second Position',
    content: 'Another position. Still no match possible yet — we need at least 2 previous trials to compare against.',
    type: 'trial',
    modality: 'visual',
    nBack: 2,
    trialIndex: 1,
    expectResponse: false,
    isMatch: { visual: false, audio: false },
  },
  {
    id: '2back-visual-3',
    phase: '2back-visual',
    title: 'Trial 3: Check 2-Back',
    content: 'Now compare this position to Trial 1 (2 back). Different position — no match. Don\'t press anything.',
    type: 'trial',
    modality: 'visual',
    nBack: 2,
    trialIndex: 2,
    expectResponse: false,
    isMatch: { visual: false, audio: false },
    highlightHistory: true,
  },
  {
    id: '2back-visual-4',
    phase: '2back-visual',
    title: 'Trial 4: Position Match!',
    content: 'This position matches Trial 2 (2 back). Press the POSITION button!',
    type: 'trial',
    modality: 'visual',
    nBack: 2,
    trialIndex: 3,
    expectResponse: 'position',
    isMatch: { visual: true, audio: false },
    highlightHistory: true,
  },

  // ═══════════════════════════════════════════════════════════════
  // PHASE: 2-BACK AUDIO (5 steps)
  // ═══════════════════════════════════════════════════════════════
  {
    id: '2back-audio-intro',
    phase: '2back-audio',
    title: 'Audio Training',
    content: 'Now let\'s practice with audio. You\'ll hear letters spoken. Same rule: identify when the current letter matches the one from 2 trials back.',
    type: 'info',
    modality: 'audio',
    nBack: 2,
  },
  {
    id: '2back-audio-1',
    phase: '2back-audio',
    title: 'Trial 1: First Letter',
    content: 'Listen to the letter. Remember it for 2 trials from now.',
    type: 'trial',
    modality: 'audio',
    nBack: 2,
    trialIndex: 0,
    expectResponse: false,
    isMatch: { visual: false, audio: false },
  },
  {
    id: '2back-audio-2',
    phase: '2back-audio',
    title: 'Trial 2: Second Letter',
    content: 'Another letter. Keep building your memory buffer.',
    type: 'trial',
    modality: 'audio',
    nBack: 2,
    trialIndex: 1,
    expectResponse: false,
    isMatch: { visual: false, audio: false },
  },
  {
    id: '2back-audio-3',
    phase: '2back-audio',
    title: 'Trial 3: Check 2-Back',
    content: 'Compare this letter to Trial 1. Different letter — no match.',
    type: 'trial',
    modality: 'audio',
    nBack: 2,
    trialIndex: 2,
    expectResponse: false,
    isMatch: { visual: false, audio: false },
    highlightHistory: true,
  },
  {
    id: '2back-audio-4',
    phase: '2back-audio',
    title: 'Trial 4: Audio Match!',
    content: 'This letter matches Trial 2 (2 back). Press the AUDIO button!',
    type: 'trial',
    modality: 'audio',
    nBack: 2,
    trialIndex: 3,
    expectResponse: 'audio',
    isMatch: { visual: false, audio: true },
    highlightHistory: true,
  },

  // ═══════════════════════════════════════════════════════════════
  // PHASE: DUAL 2-BACK (4 steps)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'dual-intro',
    phase: 'dual',
    title: 'The Full Challenge',
    content: 'Now track BOTH position and audio at the same time. They\'re independent — you might need to press Position, Audio, both, or neither on any given trial.',
    type: 'info',
    modality: 'dual',
    nBack: 2,
  },
  {
    id: 'dual-1',
    phase: 'dual',
    title: 'Dual Trial 1',
    content: 'Position AND letter. Remember both — you\'ll compare against these in 2 trials.',
    type: 'trial',
    modality: 'dual',
    nBack: 2,
    trialIndex: 0,
    expectResponse: false,
    isMatch: { visual: false, audio: false },
  },
  {
    id: 'dual-2',
    phase: 'dual',
    title: 'Dual Trial 2',
    content: 'Keep tracking both streams independently.',
    type: 'trial',
    modality: 'dual',
    nBack: 2,
    trialIndex: 1,
    expectResponse: false,
    isMatch: { visual: false, audio: false },
  },
  {
    id: 'dual-3',
    phase: 'dual',
    title: 'Dual Trial 3: Check 2-Back',
    content: 'Compare both streams to Trial 1 (2 back). Different position AND different letter — no match. Don\'t press anything.',
    type: 'trial',
    modality: 'dual',
    nBack: 2,
    trialIndex: 2,
    expectResponse: false,
    isMatch: { visual: false, audio: false },
    highlightHistory: true,
  },
  {
    id: 'dual-4',
    phase: 'dual',
    title: 'Dual Trial 4: Audio Match Only',
    content: 'The letter matches 2 back, but the position is different. Press AUDIO only!',
    type: 'trial',
    modality: 'dual',
    nBack: 2,
    trialIndex: 3,
    expectResponse: 'audio',
    isMatch: { visual: false, audio: true },
    highlightHistory: true,
  },

  // ═══════════════════════════════════════════════════════════════
  // PHASE: PROGRESSION EXPLAINER (4 steps)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'progression-1',
    phase: 'progression',
    title: 'Two Ways to Train',
    content: 'This app offers two training modes. Classic Training follows the standard Jaeggi protocol — great for straightforward practice. Adaptive Training uses a precision system that fine-tunes difficulty to your exact level every session.',
    type: 'info',
    visibleWhen: 'hasClassic',
  },
  {
    // Stand-in for progression-1 when Classic is unavailable. The section cannot simply
    // drop that step — progression-3 would open mid-thought.
    id: 'progression-1-adaptive-only',
    phase: 'progression',
    title: 'How Training Works',
    content: 'Training follows the standard Jaeggi dual n-back protocol, with one refinement: instead of stepping through fixed whole levels, difficulty is tuned continuously to your exact ability and adjusts after every session.',
    type: 'info',
    visibleWhen: 'noClassic',
  },
  {
    id: 'progression-2',
    phase: 'progression',
    title: 'Classic Training',
    content: 'In Classic mode, difficulty is fixed at each N-back level. Level up by scoring 90% or better on all active modalities. Drop below 75% on any one for three sessions in a row, and you\'ll step back a level. Simple and consistent.',
    type: 'info',
    visibleWhen: 'hasClassic',
  },
  {
    id: 'progression-3',
    phase: 'progression',
    title: 'Adaptive Training',
    content: 'Adaptive mode uses the N.DD level system. Your level is shown as a decimal (like 3.47) — the whole number is your N-back level, and the decimal tracks your progress within it. Difficulty adjusts after every session based on your performance.',
    type: 'info',
  },
  {
    id: 'progression-4',
    phase: 'progression',
    title: 'Finding Your Edge',
    content: 'The adaptive system keeps you training right at the boundary of your ability — not so easy it\'s boring, not so hard it\'s frustrating. As you improve, difficulty gradually increases until you advance to the next N-back level.',
    type: 'info',
  },

  // ═══════════════════════════════════════════════════════════════
  // PHASE: COMPLETE
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'complete',
    phase: 'complete',
    title: 'Protocol Orientation Complete',
    content: 'You\'re ready to begin training. Consistency is key — even short daily sessions lead to improvement. Let\'s take a quick tour of your dashboard.',
    type: 'complete',
  },
];

// Helper to get steps by phase, narrowed to the viewer's cohort
export const getStepsByPhase = (phase, { hasClassicAccess = true } = {}) =>
  TUTORIAL_STEPS.filter(s => {
    if (s.phase !== phase) return false;
    if (s.visibleWhen === 'hasClassic') return hasClassicAccess;
    if (s.visibleWhen === 'noClassic') return !hasClassicAccess;
    return true;
  });

// Get total step count
export const TOTAL_STEPS = TUTORIAL_STEPS.length;

// Get step by id
export const getStepById = (id) => TUTORIAL_STEPS.find(s => s.id === id);

// Get step index
export const getStepIndex = (id) => TUTORIAL_STEPS.findIndex(s => s.id === id);
