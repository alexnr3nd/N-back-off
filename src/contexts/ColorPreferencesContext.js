/* src/contexts/ColorPreferencesContext.js */

/**
 * Stimulus color customization preferences.
 *
 * Mirrors the SettingsContext patterns:
 *  - localStorage cache for first-paint
 *  - Firestore subscribe at users/{uid}/profiles/{profileId}/profileSettings/colorPreferences
 *  - Direct setDoc(..., { merge: true }) writes (matches saveSettingsToFirestore)
 *  - Immediate-write per change (no Save button)
 *
 * Stored shape:
 *   { paletteId, customPalette, updatedAt }
 *
 * Exposes:
 *   { paletteId, customPalette, resolvedPalette, isLoading, savePreference }
 *
 * resolvedPalette is the theme-aware hex map ready for renderer lookup —
 * always includes the 8 canonical color names plus 3 legacy names
 * (yellow/cyan/magenta) so old replay sequences still render.
 */

import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { useUser } from './UserContext';
import { useSettings } from './SettingsContext';
import { getPresetPalette } from '../constants/colorPresets';
import { colorToHex } from '../components/game/stimulusRenderers';

const STORAGE_KEY = 'userColorPreferences';
const DEFAULT_PREFS = { paletteId: 'default', customPalette: null };

const ColorPreferencesContext = createContext({
    paletteId: 'default',
    customPalette: null,
    resolvedPalette: colorToHex,
    isLoading: true,
    savePreference: async () => {},
});

export const useColorPreferences = () => {
    const ctx = useContext(ColorPreferencesContext);
    if (!ctx) throw new Error('useColorPreferences must be used within a ColorPreferencesProvider');
    return ctx;
};

/**
 * Resolves the user's theme setting ('light' | 'dark' | 'system') down to
 * a concrete 'dark' or 'light' value, watching window.matchMedia for
 * system-theme changes.
 */
export const useResolvedTheme = () => {
    const { settings } = useSettings();
    const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return true;
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    useEffect(() => {
        if (settings?.theme !== 'system') return undefined;
        if (typeof window === 'undefined' || !window.matchMedia) return undefined;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e) => setSystemPrefersDark(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [settings?.theme]);

    if (settings?.theme === 'light') return 'light';
    if (settings?.theme === 'dark') return 'dark';
    return systemPrefersDark ? 'dark' : 'light';
};

export const ColorPreferencesProvider = ({ children }) => {
    const [paletteId, setPaletteId] = useState(DEFAULT_PREFS.paletteId);
    const [customPalette, setCustomPalette] = useState(DEFAULT_PREFS.customPalette);
    const [isLoading, setIsLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState(null);

    const { userId, isDataReady } = useUser();
    const resolvedTheme = useResolvedTheme();

    // 1. Hydrate from localStorage on mount
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (typeof parsed?.paletteId === 'string') setPaletteId(parsed.paletteId);
                if (parsed?.customPalette && typeof parsed.customPalette === 'object') {
                    setCustomPalette(parsed.customPalette);
                }
            }
        } catch (e) {
            console.warn('[ColorPreferences] localStorage parse error', e);
        }
    }, []);

    // 2. Track auth state — clear prefs on logout
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            const newUid = user ? user.uid : null;
            setCurrentUserId((prev) => {
                if (prev === newUid) return prev;
                if (!newUid) {
                    setPaletteId(DEFAULT_PREFS.paletteId);
                    setCustomPalette(DEFAULT_PREFS.customPalette);
                    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
                    setIsLoading(false);
                }
                return newUid;
            });
        });
        return () => unsub();
    }, []);

    // 3. Sync from Firestore once we have a user + profile
    useEffect(() => {
        if (!currentUserId || !userId || !isDataReady) {
            if (currentUserId === null) setIsLoading(false);
            return undefined;
        }
        let cancelled = false;
        const ref = doc(db, 'users', currentUserId, 'profiles', userId, 'profileSettings', 'colorPreferences');
        getDoc(ref).then((snap) => {
            if (cancelled) return;
            if (snap.exists()) {
                const d = snap.data() || {};
                if (typeof d.paletteId === 'string') setPaletteId(d.paletteId);
                setCustomPalette(d.customPalette ?? null);
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify({
                        paletteId: d.paletteId || DEFAULT_PREFS.paletteId,
                        customPalette: d.customPalette ?? null,
                    }));
                } catch (e) { /* ignore */ }
            }
            setIsLoading(false);
        }).catch((err) => {
            if (cancelled) return;
            console.error('[ColorPreferences] Firestore load error', err);
            setIsLoading(false);
        });
        return () => { cancelled = true; };
    }, [currentUserId, userId, isDataReady]);

    // Resolved palette — what the renderer actually uses
    const resolvedPalette = useMemo(() => {
        if (paletteId === 'custom' && customPalette && typeof customPalette === 'object') {
            // Spread legacy colorToHex first so any unknown color name (incl. legacy
            // yellow/cyan/magenta from old session sequences) still resolves to a hex.
            return { ...colorToHex, ...customPalette };
        }
        return getPresetPalette(paletteId, resolvedTheme);
    }, [paletteId, customPalette, resolvedTheme]);

    // savePreference — immediate localStorage + fire-and-forget Firestore.
    // Mirrors the updateSetting pattern from SettingsContext.
    const savePreference = useCallback(async (next) => {
        const nextPaletteId = next?.paletteId !== undefined ? next.paletteId : paletteId;
        const nextCustomPalette = next?.customPalette !== undefined ? next.customPalette : customPalette;

        if (next?.paletteId !== undefined) setPaletteId(nextPaletteId);
        if (next?.customPalette !== undefined) setCustomPalette(nextCustomPalette);

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                paletteId: nextPaletteId,
                customPalette: nextCustomPalette,
            }));
        } catch (e) { /* ignore */ }

        if (!currentUserId || !userId) return;
        const ref = doc(db, 'users', currentUserId, 'profiles', userId, 'profileSettings', 'colorPreferences');
        try {
            await setDoc(ref, {
                paletteId: nextPaletteId,
                customPalette: nextCustomPalette ?? null,
                updatedAt: serverTimestamp(),
            }, { merge: true });
        } catch (err) {
            console.error('[ColorPreferences] Firestore save error', err);
        }
    }, [paletteId, customPalette, currentUserId, userId]);

    const value = useMemo(() => ({
        paletteId,
        customPalette,
        resolvedPalette,
        isLoading,
        savePreference,
    }), [paletteId, customPalette, resolvedPalette, isLoading, savePreference]);

    return (
        <ColorPreferencesContext.Provider value={value}>
            {children}
        </ColorPreferencesContext.Provider>
    );
};
