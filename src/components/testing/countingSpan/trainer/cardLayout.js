/* src/components/testing/countingSpan/trainer/cardLayout.js */
/**
 * Client port of the assessment's server-side card layout
 * (functions/cstUtils.js `generateLayout`) — pure, no Firebase, no React.
 *
 * Why the port: the trainer draws a whole session's cards up front, and a server
 * pool carrying item coordinates would be 300-600 KB per session (up to 594
 * cards). Counts-only is ~6 KB, so `getCountingSpanTrainerStructure` sends
 * `{ t, d1, d2 }` per card and the client reproduces the assessment card here by
 * construction: the same 500x350 canvas, 30 px items, 33 px minimum separation,
 * 100 placement tries and random fallback. The output feeds the assessment's
 * untouched `StimulusDisplay` (viewBox 0 0 500 350).
 *
 * Layout is re-randomized for every card on purpose — canonical patterns let a
 * count be recognized instead of counted (Mandler & Shebo 1982).
 *
 * Placement order is target-first, exactly as the assessment does it; positions
 * are random, so there is deliberately no shuffle.
 */

const DISPLAY_WIDTH = 500;
const DISPLAY_HEIGHT = 350;
const ITEM_SIZE = 30;
const ITEM_RADIUS = ITEM_SIZE / 2;
const MIN_SEPARATION = ITEM_SIZE * 1.1;
const MAX_PLACEMENT_TRIES = 100;
const BOUNDARY_PADDING = ITEM_RADIUS + 2;

export const LAYOUT = {
    DISPLAY_WIDTH,
    DISPLAY_HEIGHT,
    ITEM_SIZE,
    ITEM_RADIUS,
    MIN_SEPARATION,
    MAX_PLACEMENT_TRIES,
    BOUNDARY_PADDING,
};

/** Shape names understood by the assessment's StimulusDisplay. */
export const CARD_TYPES = {
    TARGET: 'blueCircle',
    DISTRACTOR_1: 'greenCircle',
    DISTRACTOR_2: 'blueSquare',
};

const randomId = (rng) => Math.floor(rng() * 0x7fffffff).toString(36);

/**
 * Places each requested item at a random non-overlapping position.
 * @param {Array<{type: string}>} itemsToPlace
 * @param {function} [rng] - injectable random source (tests); defaults to Math.random.
 * @returns {Array<{type: string, x: number, y: number, id: string}>}
 */
export const generateCardLayout = (itemsToPlace, rng = Math.random) => {
    if (!Array.isArray(itemsToPlace)) return [];
    const placedItems = [];
    const spanX = DISPLAY_WIDTH - 2 * BOUNDARY_PADDING;
    const spanY = DISPLAY_HEIGHT - 2 * BOUNDARY_PADDING;

    for (const item of itemsToPlace) {
        let placed = false;
        for (let tries = 0; tries < MAX_PLACEMENT_TRIES; tries++) {
            const potentialX = rng() * spanX + BOUNDARY_PADDING;
            const potentialY = rng() * spanY + BOUNDARY_PADDING;

            let collision = false;
            for (const placedItem of placedItems) {
                const dx = potentialX - placedItem.x;
                const dy = potentialY - placedItem.y;
                if ((dx * dx + dy * dy) < (MIN_SEPARATION * MIN_SEPARATION)) {
                    collision = true;
                    break;
                }
            }

            if (!collision) {
                placedItems.push({
                    ...item,
                    x: potentialX,
                    y: potentialY,
                    id: `item_${randomId(rng)}_${placedItems.length}`,
                });
                placed = true;
                break;
            }
        }

        if (!placed) {
            // Same documented fallback as the assessment: after 100 tries place
            // it anywhere in bounds rather than dropping the shape (which would
            // change the count the user is asked to report).
            placedItems.push({
                ...item,
                x: rng() * spanX + BOUNDARY_PADDING,
                y: rng() * spanY + BOUNDARY_PADDING,
                id: `item_fallback_${randomId(rng)}_${placedItems.length}`,
            });
        }
    }

    return placedItems;
};

const safeCount = (v) => (Number.isInteger(v) && v > 0 ? v : 0);

/**
 * Turns one server-generated card (`{ t, d1, d2 }` counts) into laid-out items
 * for StimulusDisplay.
 */
export const buildCardItems = (card, rng = Math.random) => {
    const { t, d1, d2 } = card || {};
    const itemsToPlace = [
        ...Array.from({ length: safeCount(t) }, () => ({ type: CARD_TYPES.TARGET })),
        ...Array.from({ length: safeCount(d1) }, () => ({ type: CARD_TYPES.DISTRACTOR_1 })),
        ...Array.from({ length: safeCount(d2) }, () => ({ type: CARD_TYPES.DISTRACTOR_2 })),
    ];
    return generateCardLayout(itemsToPlace, rng);
};
