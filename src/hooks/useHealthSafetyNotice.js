/* src/hooks/useHealthSafetyNotice.js
 *
 * Selector for the Health & Safety disclaimer state.
 *
 * The actual Firestore reads + acknowledge callable now live in UserContext
 * (via useHealthSafetyData) and run once per app session at login data-load
 * time. The gate at <GameScreen> (gameState === 'preparing' branch) therefore
 * resolves synchronously for users who have already acknowledged — they see
 * the countdown immediately instead of a "Preparing session..." flash.
 *
 * Public shape unchanged:
 *   { loading, needsAck, notice, isFirstSession, acknowledge, decline }
 */

import { useUser } from '../contexts/UserContext';

export default function useHealthSafetyNotice() {
    return useUser().healthSafetyNotice;
}
