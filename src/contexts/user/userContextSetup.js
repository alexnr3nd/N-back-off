/* src/contexts/user/userContextSetup.js */
import { createContext, useContext } from 'react';

// 1. Create the context object - this is the single source of truth
export const UserContext = createContext(null);

// Backward-compat alias (SAME object, not new context - critical for React context identity)
/** @deprecated Use UserContext instead */
export const ProfileContext = UserContext;

// 2. Create the primary hook for consuming the context
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

// Deprecated alias (SAME function)
/** @deprecated Use useUser instead */
export const useProfile = useUser;