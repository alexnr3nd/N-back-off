/* Offline build: remote version checks are intentionally disabled. */
import React, { createContext, useContext } from 'react';

const VersionCheckContext = createContext({
  isStale: false,
  serverVersion: null,
  clientVersion: 'offline',
  refresh: () => {},
});

export function VersionCheckProvider({ children }) {
  return (
    <VersionCheckContext.Provider value={{
      isStale: false,
      serverVersion: null,
      clientVersion: 'offline',
      refresh: () => {},
    }}>
      {children}
    </VersionCheckContext.Provider>
  );
}

export function useVersionCheck() {
  return useContext(VersionCheckContext);
}
