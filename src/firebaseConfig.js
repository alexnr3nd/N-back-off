/* Offline build Firebase compatibility shim.
 * Firebase services are intentionally not initialized or contacted.
 * The app's user data and sessions are stored per local profile.
 */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
export { httpsCallable } from 'firebase/functions';

export const isEmulatorEnv = true;
export const isEmulatorEnvironment = true;
export const app = initializeApp({
  apiKey: 'offline-no-network',
  authDomain: 'localhost',
  projectId: 'dual-n-back-offline',
  appId: 'offline-local-app',
});
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const appCheck = null;
export const analytics = null;
export const ensureAppCheckToken = async () => null;
export const fetchAppCheckToken = async () => ({ token: null, error: null });
export default app;
