/* src/contexts/LoadingContext.js */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback, // <<< Import useCallback
  useMemo // <<< Import useMemo
} from 'react';
import LoadingScreen from '../components/ui/LoadingScreen';

/**
* Context for managing application-wide loading states
* Provides both temporary (full-screen) and persistent (below header) loading modes.
*/
const LoadingContext = createContext({
isLoading: false,
message: '',
showLoading: () => {},
hideLoading: () => {},
updateMessage: () => {},
showPersistentLoading: () => {},
hidePersistentLoading: () => {}
});

export function LoadingProvider({ children }) {
const [isLoading, setIsLoading] = useState(false);
const [message, setMessage] = useState('');
const [bgColor, setBgColor] = useState('#0D0B09'); // Charcoal background
const [isPersistent, setIsPersistent] = useState(false);
// Control whether loader covers full screen or just content area
const [loaderFullScreen, setLoaderFullScreen] = useState(true);
// Theme: "dark" (default) or "auto" (uses CSS variables for theme-aware pages)
const [theme, setTheme] = useState('dark');

// Clear any stale persisted loading state on mount
// (Persistent loading is for SPA navigation, not hard page refreshes)
useEffect(() => {
  localStorage.removeItem('dualNBackLoadingState');
}, []);

/**
 * Show a normal (non-persistent) loading screen.
 * Clears any persisted state and covers full screen.
 * @param {string} loadingMessage - Message to display
 * @param {string} background - Background color (null for theme-based)
 * @param {string} loadingTheme - "dark" (default) or "auto" (theme-aware for light mode pages)
 */
const showLoading = useCallback((loadingMessage = 'Loading...', background = '#0D0B09', loadingTheme = 'dark') => {
  localStorage.removeItem('dualNBackLoadingState');
  setMessage(loadingMessage);
  setBgColor(background);
  setTheme(loadingTheme);
  setIsLoading(true);
  setIsPersistent(false);
  setLoaderFullScreen(true);
}, []); // State setters (setMessage, setIsLoading etc.) are stable, no need to list them

/**
 * Show a loading screen that persists across page navigations.
 * Persists state and covers only content area (header remains visible).
 * @param {string} loadingMessage - Message to display
 * @param {string} background - Background color (null for theme-based)
 * @param {string} loadingTheme - "dark" (default) or "auto" (theme-aware for light mode pages)
 */
const showPersistentLoading = useCallback((loadingMessage = 'Loading...', background = '#0D0B09', loadingTheme = 'dark') => {
  setMessage(loadingMessage);
  setBgColor(background);
  setTheme(loadingTheme);
  setIsLoading(true);
  setIsPersistent(true);
  setLoaderFullScreen(false);
  try {
    localStorage.setItem(
      'dualNBackLoadingState',
      JSON.stringify({ active: true, message: loadingMessage, bgColor: background, theme: loadingTheme })
    );
  } catch (e) {
    console.error('Failed to persist loading state', e);
  }
}, []); // State setters are stable

/**
 * Hide the loading screen (both modes).
 */
const hideLoading = useCallback(() => {
  setIsLoading(false);
  setMessage('');
  setIsPersistent(false);
  // Optionally reset loaderFullScreen to default true when hiding?
  // setLoaderFullScreen(true); // Keeping this commented as per original
}, []); // State setters are stable

/**
 * Hide persistent loading and clear persisted state.
 */
const hidePersistentLoading = useCallback(() => {
  localStorage.removeItem('dualNBackLoadingState');
  setIsLoading(false);
  setMessage('');
  setIsPersistent(false);
  // Optionally reset loaderFullScreen to default true when hiding?
  // setLoaderFullScreen(true); // Keeping this commented as per original
}, []); // State setters are stable

/**
 * Update the loading message. Also updates persisted message if in persistent mode.
 */
const updateMessage = useCallback((newMessage) => {
  setMessage(newMessage);
  if (isPersistent) { // <<< Depends on isPersistent state
    try {
      // Retrieve current state to only update message, preserving other persisted fields if any
      const currentStateString = localStorage.getItem('dualNBackLoadingState');
      const currentState = currentStateString ? JSON.parse(currentStateString) : {};
      localStorage.setItem(
        'dualNBackLoadingState',
        // Ensure active: true is preserved if it was there
        JSON.stringify({ ...currentState, active: !!currentState.active, message: newMessage })
      );
    } catch (e) {
      console.error('Failed to update persisted loading message', e);
    }
  }
}, [isPersistent]); // <<< Add isPersistent as a dependency

// Memoize the context value object
const value = useMemo(() => ({
  isLoading,
  message,
  showLoading,
  hideLoading,
  updateMessage,
  showPersistentLoading,
  hidePersistentLoading
}), [
  isLoading, // State value
  message,   // State value
  showLoading, // Memoized function
  hideLoading, // Memoized function
  updateMessage, // Memoized function
  showPersistentLoading, // Memoized function
  hidePersistentLoading // Memoized function
]);

return (
  <LoadingContext.Provider value={value}>
    {children}
    {isLoading && (
      <LoadingScreen
        message={message}
        bgColor={theme === 'auto' ? null : bgColor}
        fullScreen={loaderFullScreen}
        persistent={isPersistent}
        theme={theme}
      />
    )}
  </LoadingContext.Provider>
);
}

export function useLoading() {
return useContext(LoadingContext);
}