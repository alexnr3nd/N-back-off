/* Offline-only persistence: sessions are saved directly to the active local profile.
 * There is no remote retry queue in this build.
 */
import React, { createContext, useContext } from 'react';
export const STALE_ENTRY_MS = 0;
const OfflineSaveContext = createContext({
  pendingCount: 0, failedCount: 0, isSyncing: false, lastSyncResult: null,
  retryAll: async () => ({ success: true }), clearAll: async () => true,
});
export const OfflineSaveProvider = ({ children }) => (
  <OfflineSaveContext.Provider value={{
    pendingCount: 0, failedCount: 0, isSyncing: false, lastSyncResult: null,
    retryAll: async () => ({ success: true }), clearAll: async () => true,
  }}>{children}</OfflineSaveContext.Provider>
);
export const useOfflineSave = () => useContext(OfflineSaveContext);
