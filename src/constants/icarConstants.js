/* src/constants/icarConstants.js */

/**
 * Item bank + frontend constants for the Reasoning Check (ICAR16-based).
 *
 * IMPORTANT — keep in sync with `functions/icarConstants.js` per CLAUDE.md
 * convention. Both files must be edited together for any item-bank change.
 *
 * Source: ICAR Sample Test (Condon & Revelle, 2014, Intelligence). Items are
 * described as public-domain by the authors. Cross-referenced against the
 * `psychTools::iqitems` R package (canonical answer key:
 * c(4,4,4, 6, 6,3,4,4, 5,2,2,4, 3,2,6,7) for items in the order below).
 *
 * SECURITY NOTE — `correctAnswer` is included here for parity with the
 * server-side mirror, but the frontend NEVER reads it at runtime. Items
 * shipped to the client come from `getReasoningCheckItems` (Cloud Function),
 * which strips answer keys before sending. All scoring happens server-side
 * in `submitReasoningCheckResults`.
 */

// Item-set version baked into every saved attempt so future revisions
// (procedural items, new bank) don't corrupt historical comparisons.
export const ICAR_ITEM_SET_VERSION = 'icar16-v1';

// Subtest tags. Four lower-order factors per Condon & Revelle (2014).
export const ICAR_SUBTEST = {
    VERBAL: 'verbal',     // Verbal Reasoning (VR)
    SERIES: 'series',     // Letter & Number Series (LN)
    MATRIX: 'matrix',     // Matrix Reasoning (MX / MR)
    ROTATION: 'rotation', // Three-Dimensional Rotation (R3D)
};

// Phases driving the ReasoningCheckTask state machine. Mirrors the CST
// pattern (`cstConstants.js`) so `data-game-active` wiring matches.
export const TASK_PHASES = {
    INSTRUCTIONS: 'instructions',     // Pre-test page (refreshable)
    READY: 'ready',                   // After tutorial, before first item
    ITEM: 'item',                     // Active item — refresh blocked
    SAVING: 'saving',                 // Submitting to backend
    RESULTS: 'results',               // Final score screen
};

export const REASONING_CHECK_TEST_TYPE = 'REASONING_CHECK';

// Convenience labels for choice rendering. Matrix/rotation items use these
// for the answer-choice grid (labels shown beneath each visual option).
const SIX_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

const labelChoices = (labels) => labels.map((label) => ({ label }));

// Rotation items have 6 visual cube choices (A,B,C,E,F,G) plus 2 text-only
// choices (D = "None of the cubes could be a rotation", H = "I do not know
// the solution"). Renderer detects text choices via the `text` property.
const ROTATION_CHOICES = [
    { label: 'A' },
    { label: 'B' },
    { label: 'C' },
    { label: 'D', text: 'None of the cubes could be a rotation' },
    { label: 'E' },
    { label: 'F' },
    { label: 'G' },
    { label: 'H', text: 'I do not know the solution' },
];

/**
 * The 16 ICAR Sample Test items.
 *
 * Shape:
 *   id            string   Canonical item label (e.g. 'VR.4', 'MX.45')
 *   subtest       string   One of ICAR_SUBTEST values
 *   prompt        string   Question text (visual items use this for the
 *                          instruction line; their stem is rendered as SVG)
 *   choices       array    For text items: [{label, text}]
 *                          For visual items: [{label}] (image resolved by
 *                          the renderer using `id` + label)
 *   correctAnswer number   1-based index into `choices`. Server-only at
 *                          runtime; see security note above.
 */
export const ICAR_ITEMS = [
    // ---- Verbal Reasoning (4) ----
    {
        id: 'VR.4',
        subtest: ICAR_SUBTEST.VERBAL,
        prompt: 'What number is one fifth of one fourth of one ninth of 900?',
        choices: [
            { label: 'A', text: '2' },
            { label: 'B', text: '3' },
            { label: 'C', text: '4' },
            { label: 'D', text: '5' },
            { label: 'E', text: '6' },
            { label: 'F', text: '7' },
        ],
        correctAnswer: 4,
    },
    {
        id: 'VR.16',
        subtest: ICAR_SUBTEST.VERBAL,
        prompt: 'Zach is taller than Matt and Richard is shorter than Zach. Which of the following statements would be most accurate?',
        choices: [
            { label: 'A', text: 'Richard is taller than Matt' },
            { label: 'B', text: 'Richard is shorter than Matt' },
            { label: 'C', text: 'Richard is as tall as Matt' },
            { label: 'D', text: "It's impossible to tell" },
        ],
        correctAnswer: 4,
    },
    {
        id: 'VR.17',
        subtest: ICAR_SUBTEST.VERBAL,
        prompt: 'Joshua is 12 years old and his sister is three times as old as he. When Joshua is 23 years old, how old will his sister be?',
        choices: [
            { label: 'A', text: '35' },
            { label: 'B', text: '39' },
            { label: 'C', text: '44' },
            { label: 'D', text: '47' },
            { label: 'E', text: '53' },
            { label: 'F', text: '57' },
        ],
        correctAnswer: 4,
    },
    {
        id: 'VR.19',
        subtest: ICAR_SUBTEST.VERBAL,
        prompt: 'If the day after tomorrow is two days before Thursday then what day is it today?',
        choices: [
            { label: 'A', text: 'Friday' },
            { label: 'B', text: 'Monday' },
            { label: 'C', text: 'Wednesday' },
            { label: 'D', text: 'Saturday' },
            { label: 'E', text: 'Tuesday' },
            { label: 'F', text: 'Sunday' },
        ],
        correctAnswer: 6,
    },

    // ---- Letter & Number Series (4) ----
    {
        id: 'LN.7',
        subtest: ICAR_SUBTEST.SERIES,
        prompt: 'In the following alphanumeric series, what letter comes next? K N P S U',
        choices: [
            { label: 'A', text: 'S' },
            { label: 'B', text: 'T' },
            { label: 'C', text: 'U' },
            { label: 'D', text: 'V' },
            { label: 'E', text: 'W' },
            { label: 'F', text: 'X' },
        ],
        correctAnswer: 6,
    },
    {
        id: 'LN.33',
        subtest: ICAR_SUBTEST.SERIES,
        prompt: 'In the following alphanumeric series, what letter comes next? V Q M J H',
        choices: [
            { label: 'A', text: 'E' },
            { label: 'B', text: 'F' },
            { label: 'C', text: 'G' },
            { label: 'D', text: 'H' },
            { label: 'E', text: 'I' },
            { label: 'F', text: 'J' },
        ],
        correctAnswer: 3,
    },
    {
        id: 'LN.34',
        subtest: ICAR_SUBTEST.SERIES,
        prompt: 'In the following alphanumeric series, what letter comes next? I J L O S',
        choices: [
            { label: 'A', text: 'T' },
            { label: 'B', text: 'U' },
            { label: 'C', text: 'V' },
            { label: 'D', text: 'X' },
            { label: 'E', text: 'Y' },
            { label: 'F', text: 'Z' },
        ],
        correctAnswer: 4,
    },
    {
        id: 'LN.58',
        subtest: ICAR_SUBTEST.SERIES,
        prompt: 'In the following alphanumeric series, what letter comes next? Q S N P L',
        choices: [
            { label: 'A', text: 'J' },
            { label: 'B', text: 'H' },
            { label: 'C', text: 'I' },
            { label: 'D', text: 'N' },
            { label: 'E', text: 'M' },
            { label: 'F', text: 'L' },
        ],
        correctAnswer: 4,
    },

    // ---- Matrix Reasoning (4) — visual stems, A–F choices ----
    // Whole-figure asset (stem grid + answer-choice strip baked together)
    // lives at src/assets/icar/matrix/{ID-without-dot}.jpg
    // e.g. MX.45 → src/assets/icar/matrix/MX45.jpg
    // Initial assets are the canonical authors-supplied figures from
    // Condon & Revelle (2014) supplement; SVG conversion is a follow-up.
    {
        id: 'MX.45',
        subtest: ICAR_SUBTEST.MATRIX,
        prompt: 'Please indicate which is the best answer to complete the figure below.',
        choices: labelChoices(SIX_LABELS),
        correctAnswer: 5,
    },
    {
        id: 'MX.46',
        subtest: ICAR_SUBTEST.MATRIX,
        prompt: 'Please indicate which is the best answer to complete the figure below.',
        choices: labelChoices(SIX_LABELS),
        correctAnswer: 2,
    },
    {
        id: 'MX.47',
        subtest: ICAR_SUBTEST.MATRIX,
        prompt: 'Please indicate which is the best answer to complete the figure below.',
        choices: labelChoices(SIX_LABELS),
        correctAnswer: 2,
    },
    {
        id: 'MX.55',
        subtest: ICAR_SUBTEST.MATRIX,
        prompt: 'Please indicate which is the best answer to complete the figure below.',
        choices: labelChoices(SIX_LABELS),
        correctAnswer: 4,
    },

    // ---- 3-D Rotation (4) — 6 visual cube choices + 2 text choices ----
    // Whole-figure asset (stem cube + 6 candidate cubes + 2 text boxes baked
    // together) at src/assets/icar/rotation/R3D{NN}.jpg, two-digit padded,
    // e.g. R3D.3 → src/assets/icar/rotation/R3D03.jpg.
    {
        id: 'R3D.3',
        subtest: ICAR_SUBTEST.ROTATION,
        prompt: 'All the cubes below have a different image on each side. Select the choice that could represent a rotation of the cube labeled X.',
        choices: ROTATION_CHOICES,
        correctAnswer: 3,
    },
    {
        id: 'R3D.4',
        subtest: ICAR_SUBTEST.ROTATION,
        prompt: 'All the cubes below have a different image on each side. Select the choice that could represent a rotation of the cube labeled X.',
        choices: ROTATION_CHOICES,
        correctAnswer: 2,
    },
    {
        id: 'R3D.6',
        subtest: ICAR_SUBTEST.ROTATION,
        prompt: 'All the cubes below have a different image on each side. Select the choice that could represent a rotation of the cube labeled X.',
        choices: ROTATION_CHOICES,
        correctAnswer: 6,
    },
    {
        id: 'R3D.8',
        subtest: ICAR_SUBTEST.ROTATION,
        prompt: 'All the cubes below have a different image on each side. Select the choice that could represent a rotation of the cube labeled X.',
        choices: ROTATION_CHOICES,
        correctAnswer: 7,
    },
];

// Total items + per-subtest count, useful for results breakdown UI.
export const ICAR_TOTAL_ITEMS = 16;
export const ICAR_ITEMS_PER_SUBTEST = 4;
