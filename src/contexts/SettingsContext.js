/* Offline-first settings, isolated per local profile. */
import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { useUser } from './UserContext';
import audioManager from '../utils/audioManager';
import { applyTextScale } from '../utils/textScale';
import { loadProfileStore, updateLocalProfile, saveProfileStore } from '../services/localProfileStore';

export const getDefaultSettings = () => ({
    // Gameplay settings
    keyBindings: {
        visual: 'ArrowLeft', // Default visual match key
        audio: 'ArrowRight', // Default audio match key
        color: 'ArrowDown',  // Default color match key (Triple/Quad modes)
        shape: 'ArrowUp',    // Default shape match key (Quad mode)
    },
    // Split instant feedback settings - controls green (correct) and red feedback separately
    instantFeedbackPositive: true, // Green feedback for correct responses
    instantFeedbackErrors: true,   // Red feedback for false-alarm clicks (wrong key)
    instantFeedbackMisses: true,   // Red feedback + grid tile for missed matches
    // Compat shadow for installed Android clients still reading the old field;
    // derived from errors||misses on save.
    instantFeedbackNegative: true,
    // Audio settings
    selectedVoiceId: null, // Set to null initially. Will be validated/set by useEffect in the Provider.
    // Time zone setting
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, // Default to browser's timezone
    // Display settings
    theme: 'dark', // 'light', 'dark', or 'system' - defaults to dark for backwards compatibility
    textScale: 'default', // 'default' | 'large' | 'larger' — Settings > Appearance > Text Size
    autoHideCursor: false, // Auto-hide cursor during gameplay (off by default)
    // Cohort privacy settings
    cohortPrivacy: {
        showOnlineStatus: true,
        showGameActivity: true,
    },
    // Pro feature: difficulty adjustment speed
    difficultyAdjustmentRange: 'standard',
    // Classic mode: auto level adjustment (promote/demote based on accuracy)
    classicAutoLevel: true,
    // Adaptive/Dynamic mode: auto level adjustment (promote/demote based on accuracy)
    adaptiveAutoLevel: true,
    // Response Mode per single-stimulus game mode: 'match' (default) | 'recall'.
    // Keyed by mode so other single modes can adopt Recall later. Adding a mode
    // means adding the key BOTH here and in the saveSettingsToFirestore coercion,
    // which rebuilds this map from enumerated keys (unlisted keys are dropped on save).
    // Consumed at game start (gameSetup) to resolve singleColor -> singleColorRecall.
    responseModes: {
        singleColor: 'match',
    },
});


const SettingsContext = createContext({
  settings: getDefaultSettings(),
  updateSetting: () => {},
  isLoading: true,
  error: null,
  availableVoices: {},
});

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
};

export const SettingsProvider = ({ children }) => {
  const { activeProfileId } = useUser();
  const [settings, setSettings] = useState(() => {
    try {
      const profile = loadProfileStore().profiles.find((item) => item.id === activeProfileId);
      return { ...getDefaultSettings(), ...(profile?.settings || {}) };
    } catch {
      return getDefaultSettings();
    }
  });
  const [error, setError] = useState(null);
  const availableVoices = useMemo(() => audioManager.getAvailableVoices(), []);

  useEffect(() => {
    try {
      const profile = loadProfileStore().profiles.find((item) => item.id === activeProfileId);
      setSettings({ ...getDefaultSettings(), ...(profile?.settings || {}) });
      setError(null);
    } catch (err) {
      setSettings(getDefaultSettings());
      setError(err?.message || 'Não foi possível carregar as configurações locais.');
    }
  }, [activeProfileId]);

  const updateSetting = useCallback((key, value) => {
    setSettings((previous) => {
      const next = key && typeof key === 'object'
        ? { ...previous, ...key }
        : { ...previous, [key]: value };
      try {
        const store = loadProfileStore();
        const profile = store.profiles.find((item) => item.id === activeProfileId);
        if (profile) saveProfileStore(updateLocalProfile(store, activeProfileId, { settings: next }));
        setError(null);
      } catch (err) {
        setError(err?.message || 'Não foi possível salvar as configurações.');
      }
      return next;
    });
  }, [activeProfileId]);

  useEffect(() => {
    const root = document.documentElement;
    const theme = settings.theme || 'dark';
    if (theme === 'system') {
      const query = window.matchMedia('(prefers-color-scheme: dark)');
      const apply = () => root.classList.toggle('dark', query.matches);
      apply();
      query.addEventListener?.('change', apply);
      return () => query.removeEventListener?.('change', apply);
    }
    root.classList.toggle('dark', theme === 'dark');
  }, [settings.theme]);

  useEffect(() => {
    applyTextScale(settings.textScale || 'default');
  }, [settings.textScale]);

  const value = useMemo(() => ({
    settings,
    updateSetting,
    isLoading: false,
    error,
    availableVoices,
  }), [settings, updateSetting, error, availableVoices]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};
