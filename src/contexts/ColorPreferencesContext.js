/* Local, per-profile stimulus color preferences. */
import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { useUser } from './UserContext';
import { useSettings } from './SettingsContext';
import { getPresetPalette } from '../constants/colorPresets';
import { colorToHex } from '../components/game/stimulusRenderers';

const ColorPreferencesContext = createContext({
  paletteId: 'default', customPalette: null, resolvedPalette: colorToHex,
  isLoading: false, savePreference: async () => {},
});
export const useColorPreferences = () => {
  const context = useContext(ColorPreferencesContext);
  if (!context) throw new Error('useColorPreferences must be used within a ColorPreferencesProvider');
  return context;
};
export const useResolvedTheme = () => {
  const { settings } = useSettings();
  const [systemPrefersDark] = React.useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  if (settings?.theme === 'light') return 'light';
  if (settings?.theme === 'dark') return 'dark';
  return systemPrefersDark ? 'dark' : 'light';
};
export const ColorPreferencesProvider = ({ children }) => {
  const { activeProfileId } = useUser();
  const { settings, updateSetting } = useSettings();
  const paletteId = settings?.colorPaletteId || 'default';
  const customPalette = settings?.customColorPalette || null;
  const resolvedTheme = useResolvedTheme();
  const resolvedPalette = useMemo(() => {
    if (paletteId === 'custom' && customPalette && typeof customPalette === 'object') {
      return { ...colorToHex, ...customPalette };
    }
    return getPresetPalette(paletteId, resolvedTheme);
  }, [paletteId, customPalette, resolvedTheme]);
  const savePreference = useCallback(async (next = {}) => {
    const nextPaletteId = next.paletteId !== undefined ? next.paletteId : paletteId;
    const nextCustomPalette = next.customPalette !== undefined ? next.customPalette : customPalette;
    updateSetting({
      colorPaletteId: nextPaletteId,
      customColorPalette: nextCustomPalette,
    });
    return true;
  }, [paletteId, customPalette, updateSetting, activeProfileId]);
  const value = useMemo(() => ({
    paletteId, customPalette, resolvedPalette, isLoading: false, savePreference,
  }), [paletteId, customPalette, resolvedPalette, savePreference]);
  return <ColorPreferencesContext.Provider value={value}>{children}</ColorPreferencesContext.Provider>;
};
