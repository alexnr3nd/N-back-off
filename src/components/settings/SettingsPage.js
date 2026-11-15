/* src/components/settings/SettingsPage.js */
/* Redesigned: Cognitive Lab theme with sidebar navigation */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
// --- Import Context hooks ---
import { useSettings, getDefaultSettings } from '../../contexts/SettingsContext';
import { useUser } from '../../contexts/UserContext';
// --- Import UI Components ---
import ConfirmationModal from '../ui/ConfirmationModal';
import LoadingSpinner from '../ui/LoadingSpinner';
import { LabButton, LabAlert } from '../ui/LabControls';
// --- Import Settings section components ---
import KeyBindingsSettings from './sections/KeyBindingsSettings';
import GameplayAudioSettings from './sections/GameplayAudioSettings';
import AppearanceSettings from './sections/AppearanceSettings';
import ColorPreferencesSection from './ColorPreferencesSection';
import TimeZoneSettings from './sections/TimeZoneSettings';
import AdvancedSettingsSection from './sections/AdvancedSettingsSection';
import TrainingLevelSettings from './sections/TrainingLevelSettings';
import ResponseModeSettings from './sections/ResponseModeSettings';
import DisplayNameSettings from './sections/DisplayNameSettings';
import CohortDisplayNameSettings from './sections/CohortDisplayNameSettings';
import NotificationSettings from './sections/NotificationSettings';
import CoachAccessSettings from './sections/CoachAccessSettings';
// --- Import Account section components ---
import AccountEmailSection from '../account/AccountEmailSection';
import AccountPasswordSection from '../account/AccountPasswordSection';
import AccountSubscriptionSection from '../account/AccountSubscriptionSection';
import AccountDeleteFlow from '../account/AccountDeleteFlow';
import AccountLogoutSection from '../account/AccountLogoutSection';
// --- About content ---
import AboutContent from '../about/AboutContent';
// --- Legal / Health & Safety Notice ---
import LegalSection from './sections/LegalSection';
// --- Import Firebase Auth ---
import { functions as functionsInstance } from '../../firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import {
    getAuth,
    signOut,
    EmailAuthProvider,
    reauthenticateWithCredential,
    updateEmail,
    updatePassword,
    sendEmailVerification
} from 'firebase/auth';
// --- Import Payment Service & Platform ---
import { openBillingPortal, restorePurchases } from '../../services/paymentService';
import { isNative, isIOS } from '../../utils/platform';
// --- Import Routing & Icons ---
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faKeyboard,
    faVolumeUp,
    faGlobe,
    faFlask,
    faBrain,
    faCreditCard,
    faSignOutAlt,
    faExclamationCircle,
    faChevronRight,
    faArrowLeft,
    faCog,
    faUser,
    faBell,
    faPalette,
    faInfoCircle,
    faShieldHalved,
    faTrash,
} from '@fortawesome/free-solid-svg-icons';

// Import timezone options
import { TIMEZONE_OPTIONS } from '../../constants/timezoneData';

// --- Import LANGUAGE_AUDIO_LETTERS for dynamic sample letters ---
import { LANGUAGE_AUDIO_LETTERS } from '../../constants/gameConstants';
const DEFAULT_ENGLISH_SAMPLE_LETTERS = ['B', 'D', 'K', 'P', 'T', 'X'];

// --- Import audioManager ---
import audioManager from '../../utils/audioManager';

// --- Import timezone cloud functions ---
import { updateUserTimezoneFn, getTimezoneChangeStatusFn, cancelLifetimeTrialFn } from '../../contexts/user/userCloudFunctions';
import { primeReminderPreferenceCache } from '../../hooks/useReminderPreference';

// --- Text Size (Settings > Appearance) ---
import { applyTextScale, normalizeTextScale } from '../../utils/textScale';

// --- Initialize Cloud Function References ---
let createCustomerPortalSession;
let resumeSubscriptionFn;
let updateDisplayNameFn;
let updateCohortDisplayNameFn;
let getNotificationPreferencesFn;
let updateNotificationPreferencesFn;
let updateMarketingConsentFn;
try {
    if (functionsInstance) {
        createCustomerPortalSession = httpsCallable(functionsInstance, 'createCustomerPortalSession');
        resumeSubscriptionFn = httpsCallable(functionsInstance, 'resumeSubscription');
        updateDisplayNameFn = httpsCallable(functionsInstance, 'updateDisplayName');
        updateCohortDisplayNameFn = httpsCallable(functionsInstance, 'updateCohortDisplayName');
        getNotificationPreferencesFn = httpsCallable(functionsInstance, 'getNotificationPreferences');
        updateNotificationPreferencesFn = httpsCallable(functionsInstance, 'updateNotificationPreferences');
        updateMarketingConsentFn = httpsCallable(functionsInstance, 'updateMarketingConsent');
    }
} catch (error) {
    console.error("SettingsPage: Error getting Firebase Functions reference:", error);
}

// ============================================
// NAVIGATION CONFIGURATION
// ============================================
const SETTINGS_SECTIONS = {
    PROFILE: {
        id: 'profile',
        label: 'Profile',
        icon: faUser,
        description: 'Your name & display name',
    },
    CONTROLS: {
        id: 'controls',
        label: 'Controls',
        icon: faKeyboard,
        description: 'Key bindings & input',
    },
    AUDIO: {
        id: 'audio',
        label: 'Audio',
        icon: faVolumeUp,
        description: 'Voice & feedback',
    },
    TRAINING: {
        id: 'training',
        label: 'Training Level',
        icon: faBrain,
        description: 'N-Back level',
    },
    TIMEZONE: {
        id: 'timezone',
        label: 'Timezone',
        icon: faGlobe,
        description: 'Date & time',
    },
    EXPERIMENTAL: {
        id: 'experimental',
        label: 'Lab',
        icon: faFlask,
        description: 'Experimental',
    },
    NOTIFICATIONS: {
        id: 'notifications',
        label: 'Notifications',
        icon: faBell,
        description: 'Email notifications',
    },
    APPEARANCE: {
        id: 'appearance',
        label: 'Appearance',
        icon: faPalette,
        description: 'Theme & display',
    },
    BILLING: {
        id: 'billing',
        label: 'Billing',
        icon: faCreditCard,
        description: 'Subscription',
    },
    DELETE_ACCOUNT: {
        id: 'delete-account',
        label: 'Delete Account',
        icon: faTrash,
        description: 'Permanent deletion',
    },
    ABOUT: {
        id: 'about',
        label: 'About',
        icon: faInfoCircle,
        description: 'Mission & info',
    },
    LEGAL: {
        id: 'legal',
        label: 'Legal',
        icon: faShieldHalved,
        description: 'Health & safety notice',
    },
    SESSION: {
        id: 'session',
        label: 'Log Out',
        icon: faSignOutAlt,
        description: 'End session',
    },
};

const SECTION_GROUPS = [
    {
        title: 'Training',
        sections: [SETTINGS_SECTIONS.CONTROLS, SETTINGS_SECTIONS.AUDIO, SETTINGS_SECTIONS.TRAINING],
    },
    {
        title: 'Preferences',
        sections: [SETTINGS_SECTIONS.APPEARANCE, SETTINGS_SECTIONS.TIMEZONE, SETTINGS_SECTIONS.NOTIFICATIONS, SETTINGS_SECTIONS.EXPERIMENTAL],
    },
    {
        title: 'Account',
        // Delete Account is only surfaced in the native apps (Apple 5.1.1(v) / Play policy
        // require in-app deletion). Web users delete via the unlinked /delete-account route.
        sections: [
            SETTINGS_SECTIONS.PROFILE,
            SETTINGS_SECTIONS.BILLING,
            SETTINGS_SECTIONS.ABOUT,
            SETTINGS_SECTIONS.LEGAL,
            ...(isNative() ? [SETTINGS_SECTIONS.DELETE_ACCOUNT] : []),
            SETTINGS_SECTIONS.SESSION,
        ],
    },
];

// ============================================
// STYLED UI COMPONENTS
// ============================================

const LabInputField = ({ id, label, type = 'text', value, onChange, required = false, placeholder = '', disabled = false, error = null }) => (
    <div className="mb-4">
        <label htmlFor={id} className="block text-xs font-mono uppercase tracking-wider text-theme-text-muted mb-2">
            {label}{required && <span className="text-neural-synapse ml-1">*</span>}
        </label>
        <input
            type={type} id={id} name={id} value={value} onChange={onChange} required={required} placeholder={placeholder} disabled={disabled}
            className={`w-full px-4 py-3 bg-theme-bg-secondary border rounded-lab text-theme-text placeholder-warm-muted/50
                font-mono text-sm transition-all duration-200
                ${error ? 'border-neural-synapse focus:ring-neural-synapse focus:border-neural-synapse' : 'border-theme-line focus:ring-theme-accent focus:border-theme-accent'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-theme-border'}
                focus:outline-none focus:ring-1`}
            aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
        />
        {error && (
            <p id={`${id}-error`} className="mt-2 text-xs text-neural-synapse flex items-center font-mono" role="alert">
                <FontAwesomeIcon icon={faExclamationCircle} className="mr-1.5 h-3 w-3" />{error}
            </p>
        )}
    </div>
);

const LabStatusBadge = ({ type, text }) => {
    const types = {
        success: "bg-neural-dendrite/20 text-neural-dendrite border-neural-dendrite/30",
        warning: "bg-theme-accent/20 text-theme-accent border-theme-accent/30",
        error: "bg-neural-synapse/20 text-neural-synapse border-neural-synapse/30",
        info: "bg-neural-pulse/20 text-neural-pulse border-neural-pulse/30",
        neutral: "bg-theme-bg-elevated text-theme-text-muted border-theme-line"
    };
    return <span className={`inline-flex items-center px-2.5 py-1 rounded-lab text-xs font-mono uppercase tracking-wider border ${types[type]}`}>{text}</span>;
};

// ============================================
// NAVIGATION SIDEBAR COMPONENT
// ============================================
const SettingsNav = ({ activeSection, onSectionChange, onLogoutClick, isMobileMenuOpen, setIsMobileMenuOpen }) => {
    return (
        <>
            {/* Mobile Menu Button */}
            <div className="lg:hidden mb-4">
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-theme-bg-secondary border border-theme-line rounded-lab text-theme-text"
                >
                    <span className="flex items-center gap-3">
                        <FontAwesomeIcon
                            icon={Object.values(SETTINGS_SECTIONS).find(s => s.id === activeSection)?.icon || faKeyboard}
                            className="h-4 w-4 text-theme-accent"
                        />
                        <span className="font-mono text-sm uppercase tracking-wider">
                            {Object.values(SETTINGS_SECTIONS).find(s => s.id === activeSection)?.label || 'Settings'}
                        </span>
                    </span>
                    <FontAwesomeIcon
                        icon={faChevronRight}
                        className={`h-4 w-4 text-theme-text-muted transition-transform duration-200 ${isMobileMenuOpen ? 'rotate-90' : ''}`}
                    />
                </button>
            </div>

            {/* Navigation Menu */}
            <nav className={`
                lg:block lg:w-56 lg:flex-shrink-0
                ${isMobileMenuOpen ? 'block' : 'hidden'}
                lg:sticky lg:top-6 lg:self-start
            `}>
                <div className="bg-theme-bg-secondary border border-theme-line rounded-lab overflow-hidden">
                    {SECTION_GROUPS.map((group, groupIndex) => (
                        <div key={group.title} className={groupIndex > 0 ? 'border-t border-theme-line' : ''}>
                            <div className="px-4 py-2 bg-theme-bg-elevated">
                                <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.2em] text-theme-text-muted">
                                    {group.title}
                                </span>
                            </div>
                            <div className="py-1">
                                {group.sections.map((section) => {
                                    const isActive = activeSection === section.id;
                                    return (
                                        <button
                                            key={section.id}
                                            onClick={() => {
                                                if (section.id === 'session') {
                                                    onLogoutClick();
                                                } else {
                                                    onSectionChange(section.id);
                                                }
                                                setIsMobileMenuOpen(false);
                                            }}
                                            className={`
                                                w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-150
                                                ${isActive
                                                    ? 'bg-theme-accent/10 text-theme-accent border-l-2 border-theme-accent'
                                                    : 'text-theme-text-secondary hover:bg-theme-bg-surface hover:text-theme-text border-l-2 border-transparent'
                                                }
                                            `}
                                        >
                                            <FontAwesomeIcon
                                                icon={section.icon}
                                                className={`h-4 w-4 ${isActive ? 'text-theme-accent' : 'text-theme-text-muted'}`}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-mono truncate">{section.label}</div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </nav>
        </>
    );
};

// ============================================
// SECTION CONTENT WRAPPER
// ============================================
const SectionContent = ({ title, description, children }) => (
    <div className="animate-fadeIn">
        <div className="mb-6 pb-4 border-b border-theme-line">
            <h2 className="text-xl font-serif text-theme-text mb-1">{title}</h2>
            {description && <p className="text-sm text-theme-text-muted font-mono">{description}</p>}
        </div>
        <div className="space-y-6">
            {children}
        </div>
    </div>
);

// ============================================
// MAIN SETTINGS PAGE COMPONENT
// ============================================
const SettingsPage = () => {
    // --- Contexts ---
    const { settings, updateSetting, isLoading: isLoadingAppSettings, error: appSettingsError, availableVoices } = useSettings();
    const { userId, userData, isDataReady, getCurrentModeProgression, activeGameMode, authUser, updateProfileProgress, isLoading: isLoadingProfile, error: profileError,
            userSubscriptionStatus, userSubscriptionEndDate, userSubscriptionPriceId, userSubscriptionCancelAtPeriodEnd, subscriptionPlatform, updateDisplayNameLocally, updateCohortDisplayNameLocally, updateMarketingConsentLocally,
            coachId, coachGrantedPremium, subscriptionTier, preMonetizationChange,
            isFullAdaptive, freeTier, hasClassicAccess,
            isInFreeTrial, freeTrialDaysRemaining, subscriptionType,
            isInLifetimeTrial, lifetimeTrialEndsAt, lifetimeTrialDaysRemaining, refreshUserData,
            setUserSubscriptionCancelAtPeriodEnd, setUserSubscriptionStatus, setSubscriptionTier,
            setSubscriptionPlatform, setLifetimeTrialStatus } = useUser();
    const navigate = useNavigate();
    const location = useLocation();
    const auth = getAuth();

    // --- Navigation State ---
    const [activeSection, setActiveSection] = useState(SETTINGS_SECTIONS.CONTROLS.id);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Handle section navigation from location state or query params
    useEffect(() => {
        // Check location state first (e.g., from dashboard "Add Name" button)
        if (location.state?.section) {
            setActiveSection(location.state.section);
            return;
        }
        // Check query params (e.g., /settings?section=audio from changelog link)
        const params = new URLSearchParams(location.search);
        const sectionParam = params.get('section');
        if (sectionParam && Object.values(SETTINGS_SECTIONS).some(s => s.id === sectionParam)) {
            setActiveSection(sectionParam);
        }
    }, [location.state?.section, location.search]);

    // --- Local State for UI ---
    const [settingKey, setSettingKey] = useState(null);
    const [localKeyBindings, setLocalKeyBindings] = useState({ visual: 'ArrowLeft', audio: 'ArrowRight', color: 'ArrowDown', shape: 'ArrowUp' });
    const [localInstantFeedbackPositive, setLocalInstantFeedbackPositive] = useState(true);
    const [localInstantFeedbackErrors, setLocalInstantFeedbackErrors] = useState(true);
    const [localInstantFeedbackMisses, setLocalInstantFeedbackMisses] = useState(true);
    const [localSelectedVoiceId, setLocalSelectedVoiceId] = useState('');
    const [localEnableExperimentalFeatures, setLocalEnableExperimentalFeatures] = useState(false);
    const [localTimezone, setLocalTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
    const [localTheme, setLocalTheme] = useState('dark');
    const [localAutoHideCursor, setLocalAutoHideCursor] = useState(false);
    const [localTextScale, setLocalTextScale] = useState('default');
    // The last SAVED text size. The picker previews live (a 71-year-old choosing a
    // size needs to see it before pressing Save), so leaving the page without saving
    // has to put the root attribute back to what is actually persisted.
    const savedTextScaleRef = useRef('default');
    const [isSavingAppSettings, setIsSavingAppSettings] = useState(false);
    const [appSaveStatus, setAppSaveStatus] = useState({ message: '', type: null, section: null });
    const [audioReady, setAudioReady] = useState(false);
    const [activeButton, setActiveButton] = useState(null);

    // Profile Level Settings
    const [localNBack, setLocalNBack] = useState('2');
    const [localDifficultySliderValue, setLocalDifficultySliderValue] = useState(0);
    const [isSavingLevel, setIsSavingLevel] = useState(false);
    const [levelSaveStatus, setLevelSaveStatus] = useState({ message: '', type: null });
    const [showLevelConfirmModal, setShowLevelConfirmModal] = useState(false);
    const [levelValidationError, setLevelValidationError] = useState('');
    const [settingsGameMode, setSettingsGameMode] = useState('dual'); // Mode being edited in training level settings
    const [settingsDynamicSubMode, setSettingsDynamicSubMode] = useState('dual'); // Sub-mode when editing Dynamic

    // --- Account Section State ---
    const [newEmail, setNewEmail] = useState('');
    const [currentPasswordForEmail, setCurrentPasswordForEmail] = useState('');
    const [emailUpdateLoading, setEmailUpdateLoading] = useState(false);
    const [emailUpdateError, setEmailUpdateError] = useState(null);
    const [emailUpdateSuccess, setEmailUpdateSuccess] = useState(false);

    const [currentPasswordForPassword, setCurrentPasswordForPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [passwordUpdateLoading, setPasswordUpdateLoading] = useState(false);
    const [passwordUpdateError, setPasswordUpdateError] = useState(null);
    const [passwordUpdateSuccess, setPasswordUpdateSuccess] = useState(false);

    const [isPortalLoading, setIsPortalLoading] = useState(false);
    const [portalError, setPortalError] = useState(null);
    const [isRestoringPurchases, setIsRestoringPurchases] = useState(false);
    const [restoreMessage, setRestoreMessage] = useState(null);
    const [restoreMessageType, setRestoreMessageType] = useState(null);
    const [isCancellingLifetimeTrial, setIsCancellingLifetimeTrial] = useState(false);
    const [cancelLifetimeTrialError, setCancelLifetimeTrialError] = useState(null);
    const [showCancelLifetimeTrialModal, setShowCancelLifetimeTrialModal] = useState(false);
    const [cancelLifetimeTrialSuccess, setCancelLifetimeTrialSuccess] = useState(null);
    const [isResumingSubscription, setIsResumingSubscription] = useState(false);
    const [resumeError, setResumeError] = useState(null);

    // Logout Modal State
    const [showLogoutModal, setShowLogoutModal] = useState(false);

    const [isSendingVerification, setIsSendingVerification] = useState(false);
    const [verificationMessage, setVerificationMessage] = useState(null);
    const [verificationMessageType, setVerificationMessageType] = useState(null);

    // Profile Name Settings
    const [localName, setLocalName] = useState('');
    const [isSavingName, setIsSavingName] = useState(false);
    const [nameSaveStatus, setNameSaveStatus] = useState({ message: '', type: null, section: null });

    // Cohort Display Name Settings
    const [localCohortDisplayName, setLocalCohortDisplayName] = useState('');
    const [isSavingCohortDisplayName, setIsSavingCohortDisplayName] = useState(false);
    const [cohortDisplayNameSaveStatus, setCohortDisplayNameSaveStatus] = useState({ message: '', type: null, section: null });

    // Timezone Change Limit State
    const [timezoneChangeStatus, setTimezoneChangeStatus] = useState({
        canChange: true,
        freeChangesRemaining: 3,
        hoursUntilNextChange: 0,
        isLoading: true
    });

    // Notification Preferences State
    const [localRemindersEnabled, setLocalRemindersEnabled] = useState(false);
    const [localTimeBlock, setLocalTimeBlock] = useState('morning');
    const [localDaysOfWeek, setLocalDaysOfWeek] = useState([1, 2, 3, 4, 5]); // Mon-Fri
    const [isSavingNotifications, setIsSavingNotifications] = useState(false);
    const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);

    // Marketing Consent State
    const [localMarketingOptIn, setLocalMarketingOptIn] = useState(false);
    const [isSavingMarketing, setIsSavingMarketing] = useState(false);

    // --- Effects ---

    // Initialize local App settings state from context or defaults
    useEffect(() => {
        const defaultSettings = getDefaultSettings();
        if (!isLoadingAppSettings && settings) {
            const bindings = (settings.keyBindings && typeof settings.keyBindings.visual === 'string' && typeof settings.keyBindings.audio === 'string')
                             ? { ...defaultSettings.keyBindings, ...settings.keyBindings } : defaultSettings.keyBindings;
            setLocalKeyBindings(bindings);

            const feedbackPositive = typeof settings.instantFeedbackPositive === 'boolean'
                             ? settings.instantFeedbackPositive : true;
            setLocalInstantFeedbackPositive(feedbackPositive);
            // Per-type keys preferred; fall back to the legacy `instantFeedbackNegative`
            // shadow when migration hasn't run yet (e.g., first load on a fresh tab).
            const negativeFallback = typeof settings.instantFeedbackNegative === 'boolean'
                             ? settings.instantFeedbackNegative : true;
            const feedbackErrors = typeof settings.instantFeedbackErrors === 'boolean'
                             ? settings.instantFeedbackErrors : negativeFallback;
            setLocalInstantFeedbackErrors(feedbackErrors);
            const feedbackMisses = typeof settings.instantFeedbackMisses === 'boolean'
                             ? settings.instantFeedbackMisses : negativeFallback;
            setLocalInstantFeedbackMisses(feedbackMisses);

            const currentVoice = settings.selectedVoiceId;
            const firstAvailableVoice = Object.keys(availableVoices || {})[0];
            const effectiveVoiceId = (currentVoice && availableVoices && availableVoices[currentVoice])
                                    ? currentVoice
                                    : (firstAvailableVoice || '');
            setLocalSelectedVoiceId(effectiveVoiceId);

            const timezone = settings.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
            setLocalTimezone(timezone);

            const experimental = typeof settings.enableExperimentalFeatures === 'boolean'
                                ? settings.enableExperimentalFeatures : defaultSettings.enableExperimentalFeatures;
            setLocalEnableExperimentalFeatures(experimental);

            const theme = ['light', 'dark', 'system'].includes(settings.theme)
                          ? settings.theme : 'dark';
            setLocalTheme(theme);

            const autoHideCursor = typeof settings.autoHideCursor === 'boolean'
                                   ? settings.autoHideCursor : false;
            setLocalAutoHideCursor(autoHideCursor);

        } else if (!isLoadingAppSettings && !settings) {
             setLocalKeyBindings(defaultSettings.keyBindings);
             setLocalInstantFeedbackPositive(true);
             setLocalInstantFeedbackErrors(true);
             setLocalInstantFeedbackMisses(true);
             const firstAvailableVoice = Object.keys(availableVoices || {})[0];
             setLocalSelectedVoiceId(firstAvailableVoice || '');
             setLocalTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
             setLocalEnableExperimentalFeatures(defaultSettings.enableExperimentalFeatures);
             setLocalTheme('dark');
        }
    }, [isLoadingAppSettings, settings, availableVoices]);

    // Text Size hydrates on its OWN effect, keyed on the value rather than on the whole
    // `settings` object. The big effect above re-runs on every settings identity change,
    // so saving any other section would snap the picker back to the persisted value while
    // the root attribute still carried the live preview — and the provider effect could
    // not correct it, because settings.textScale had not actually changed.
    // normalizeTextScale(undefined) is 'default', so this also covers the no-settings case.
    useEffect(() => {
        if (isLoadingAppSettings) return;
        setLocalTextScale(normalizeTextScale(settings?.textScale));
    }, [isLoadingAppSettings, settings?.textScale]);

    // Keep the "last saved" text size current, and restore it if the user leaves the
    // page mid-preview. After a successful Save the context effect applies the same
    // value, so there is never a visible double-apply.
    useEffect(() => {
        savedTextScaleRef.current = normalizeTextScale(settings?.textScale);
    }, [settings?.textScale]);

    useEffect(() => () => { applyTextScale(savedTextScaleRef.current); }, []);

    // Initialize settingsGameMode to activeGameMode on mount
    useEffect(() => {
        if (activeGameMode) {
            setSettingsGameMode(activeGameMode);
            if (activeGameMode === 'dynamic' && userData?.modeProgression?.dynamic?.currentSubMode) {
                setSettingsDynamicSubMode(userData.modeProgression.dynamic.currentSubMode);
            }
        }
    }, [activeGameMode, userData?.modeProgression?.dynamic?.currentSubMode]);

    // Load level settings for the selected mode (settingsGameMode)
    useEffect(() => {
        if (isDataReady && userData?.modeProgression) {
            const modeProgress = userData.modeProgression[settingsGameMode] || { currentNBack: 2, currentDifficulty: 0 };
            const currentN = modeProgress.currentNBack ?? 2;
            const initialNBackClamped = Math.max(1, Math.min(20, currentN));
            setLocalNBack(String(initialNBackClamped));
            const initialDifficulty = modeProgress.currentDifficulty ?? 0.0;
            const clampedDifficulty = Math.max(0, Math.min(0.99, initialDifficulty));
            const sliderValue = Math.round(clampedDifficulty * 100);
            setLocalDifficultySliderValue(sliderValue);
            setLevelValidationError('');
        } else {
            setLocalNBack('2');
            setLocalDifficultySliderValue(0);
            setLevelValidationError('');
        }
    }, [isDataReady, userData?.modeProgression, settingsGameMode]);

    // Initialize local name from userData
    useEffect(() => {
        if (isDataReady && userData) {
            setLocalName(userData.displayName || '');
            setLocalCohortDisplayName(userData.cohortDisplayName || '');
        } else {
            setLocalName('');
            setLocalCohortDisplayName('');
        }
    }, [isDataReady, userData]);

    // Effect for capturing the key press
    useEffect(() => {
        if (!settingKey) return;
        const handleKeyDown = (e) => {
            e.preventDefault();
            const newKey = e.key;
             if (newKey === 'Escape' || newKey === 'Tab') {
                 setSettingKey(null);
                 return;
             }
            setLocalKeyBindings(prev => ({ ...prev, [settingKey]: newKey }));
            setSettingKey(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [settingKey]);

    // Effect to initialize AudioManager
    useEffect(() => {
        const ready = audioManager.init();
        setAudioReady(ready);
        if (!ready) {
            console.error("SettingsPage: AudioManager initialization failed.");
        }
    }, []);

    // Effect to fetch timezone change status
    useEffect(() => {
        const fetchTimezoneStatus = async () => {
            if (!getTimezoneChangeStatusFn || !authUser) {
                setTimezoneChangeStatus(prev => ({ ...prev, isLoading: false }));
                return;
            }
            try {
                const result = await getTimezoneChangeStatusFn();
                if (result.data?.success) {
                    setTimezoneChangeStatus({
                        canChange: result.data.canChange,
                        freeChangesRemaining: result.data.freeChangesRemaining,
                        hoursUntilNextChange: result.data.hoursUntilNextChange,
                        isLoading: false
                    });
                }
            } catch (error) {
                console.error("Error fetching timezone status:", error);
                setTimezoneChangeStatus(prev => ({ ...prev, isLoading: false }));
            }
        };
        fetchTimezoneStatus();
    }, [authUser]);

    // Effect to fetch notification preferences
    useEffect(() => {
        const fetchNotificationPreferences = async () => {
            if (!getNotificationPreferencesFn || !authUser) {
                setIsLoadingNotifications(false);
                return;
            }
            try {
                const result = await getNotificationPreferencesFn();
                if (result.data) {
                    setLocalRemindersEnabled(result.data.enabled ?? false);
                    setLocalTimeBlock(result.data.timeBlock ?? 'morning');
                    setLocalDaysOfWeek(result.data.daysOfWeek ?? [1, 2, 3, 4, 5]);
                }
            } catch (error) {
                console.error("Error fetching notification preferences:", error);
            } finally {
                setIsLoadingNotifications(false);
            }
        };
        fetchNotificationPreferences();
    }, [authUser]);

    // Load marketing consent from userData (already fetched via getUserDataOnLogin)
    useEffect(() => {
        if (userData?.marketingConsent) {
            setLocalMarketingOptIn(userData.marketingConsent.emailOptIn ?? false);
        }
    }, [userData?.marketingConsent]);

    // --- Handlers ---

    const handleStartSettingKey = useCallback((keyType) => {
        if (isSavingAppSettings || isSavingLevel) return;
        if (settingKey === keyType) {
            setSettingKey(null);
            return;
        }
        setSettingKey(keyType);
        setAppSaveStatus({ message: '', type: null });
    }, [settingKey, isSavingAppSettings, isSavingLevel]);

    const handleResumeAudio = useCallback(async () => {
        const resumed = await audioManager.resume();
        if (resumed) {
            setAudioReady(true);
        }
    }, []);

    const isAnySaving = isSavingAppSettings || isSavingLevel || isSavingName || isSavingCohortDisplayName;
    const isKeySettingInProgress = !!settingKey;
    const isGeneralSectionDisabled = isAnySaving || isKeySettingInProgress;

    const handleTestLetter = useCallback(async (letter) => {
        if (isGeneralSectionDisabled) return;
        setActiveButton(`letter-${letter}`);
        const resumed = await audioManager.resume();
        setAudioReady(audioManager.getAudioContext()?.state === 'running');
        if (resumed) {
            audioManager.playItem(letter, 0.5, { voiceId: localSelectedVoiceId });
        }
        setTimeout(() => setActiveButton(null), 300);
    }, [localSelectedVoiceId, isGeneralSectionDisabled]);

    const handleSaveAppSettings = useCallback(async (settingsToSave, sectionIdentifier) => {
        if (settingKey) {
            setAppSaveStatus({ message: 'Finish setting key before saving.', type: 'error', section: sectionIdentifier });
            return;
        }

        let validationError = null;
        if (settingsToSave.hasOwnProperty('keyBindings')) {
            const { visual, audio, color, shape } = settingsToSave.keyBindings;
            const keys = [visual, audio, color, shape].filter(Boolean);
            const uniqueKeys = new Set(keys);
            if (keys.length !== 4) {
                validationError = 'All four match keys must be set.';
            } else if (uniqueKeys.size !== 4) {
                validationError = 'All match keys must be different from each other.';
            }
        }
        if (settingsToSave.hasOwnProperty('selectedVoiceId') && !settingsToSave.selectedVoiceId) {
             if (availableVoices && Object.keys(availableVoices).length > 0) {
                 validationError = 'Please select an audio voice.';
             }
        }
        if (settingsToSave.hasOwnProperty('timezone') && !settingsToSave.timezone) {
            validationError = 'Please select a time zone.';
        }
        if (settingsToSave.hasOwnProperty('enableExperimentalFeatures') && typeof settingsToSave.enableExperimentalFeatures !== 'boolean') {
            validationError = 'Invalid value for experimental features setting.';
        }

        if (validationError) {
            setAppSaveStatus({ message: validationError, type: 'error', section: sectionIdentifier });
            return;
        }

        setIsSavingAppSettings(true);
        setAppSaveStatus({ message: '', type: null, section: null });

        try {
            const updatePromises = Object.entries(settingsToSave).map(([key, value]) =>
                updateSetting(key, value)
            );
            await Promise.all(updatePromises);

            let successMessage = 'Settings saved!';
            if (sectionIdentifier === 'keyBindings') successMessage = 'Key bindings saved!';
            else if (sectionIdentifier === 'gameplay') successMessage = 'Audio settings saved!';
            else if (sectionIdentifier === 'timezone') successMessage = 'Time zone saved!';
            else if (sectionIdentifier === 'advanced') successMessage = 'Lab settings saved!';

            setAppSaveStatus({ message: successMessage, type: 'success', section: sectionIdentifier });

            setTimeout(() => setAppSaveStatus(prev =>
                prev.type === 'success' && prev.section === sectionIdentifier
                ? { message: '', type: null, section: null }
                : prev
            ), 3000);

        } catch (err) {
            console.error(`Error saving app settings for section ${sectionIdentifier}:`, err);
            setAppSaveStatus({
                message: appSettingsError || `Failed to save settings. Error: ${err.message}`,
                type: 'error',
                section: sectionIdentifier
            });
        } finally {
            setIsSavingAppSettings(false);
        }
    }, [settingKey, updateSetting, appSettingsError, availableVoices]);

    const handleSaveKeyBindings = useCallback(() => {
        handleSaveAppSettings({ keyBindings: localKeyBindings }, 'keyBindings');
    }, [handleSaveAppSettings, localKeyBindings]);

    const handleSaveGameplayAudio = useCallback(() => {
        handleSaveAppSettings({
            instantFeedbackPositive: localInstantFeedbackPositive,
            instantFeedbackErrors: localInstantFeedbackErrors,
            instantFeedbackMisses: localInstantFeedbackMisses,
            selectedVoiceId: localSelectedVoiceId
        }, 'gameplay');
    }, [handleSaveAppSettings, localInstantFeedbackPositive, localInstantFeedbackErrors, localInstantFeedbackMisses, localSelectedVoiceId]);

    // Live preview: apply the size to the root immediately so the choice is visible
    // before Save. The persisted value is only written by handleSaveAppearance below.
    const handleTextScaleChange = useCallback((value) => {
        const next = normalizeTextScale(value);
        setLocalTextScale(next);
        applyTextScale(next);
    }, []);

    const handleSaveAppearance = useCallback(() => {
        handleSaveAppSettings({ theme: localTheme, autoHideCursor: localAutoHideCursor, textScale: localTextScale }, 'appearance');
    }, [handleSaveAppSettings, localTheme, localAutoHideCursor, localTextScale]);

    const handleSaveTimeZone = useCallback(async () => {
        if (!updateUserTimezoneFn) {
            setAppSaveStatus({ message: 'Timezone update service unavailable.', type: 'error', section: 'timezone' });
            return;
        }

        // Check if change is allowed
        if (!timezoneChangeStatus.canChange) {
            setAppSaveStatus({
                message: `You can only change your timezone once per day. Please wait ${timezoneChangeStatus.hoursUntilNextChange} hour${timezoneChangeStatus.hoursUntilNextChange !== 1 ? 's' : ''}.`,
                type: 'error',
                section: 'timezone'
            });
            return;
        }

        // Check if timezone actually changed
        if (localTimezone === settings?.timezone) {
            setAppSaveStatus({ message: 'Timezone is already set to this value.', type: 'info', section: 'timezone' });
            return;
        }

        setIsSavingAppSettings(true);
        setAppSaveStatus({ message: '', type: null, section: null });

        try {
            const result = await updateUserTimezoneFn({ timezone: localTimezone });
            if (result.data?.success) {
                // Also update local context
                await updateSetting('timezone', localTimezone);

                // Update timezone change status
                setTimezoneChangeStatus({
                    canChange: result.data.freeChangesRemaining > 0 || !result.data.canChangeAgainAfter,
                    freeChangesRemaining: result.data.freeChangesRemaining,
                    hoursUntilNextChange: result.data.freeChangesRemaining > 0 ? 0 : 24,
                    isLoading: false
                });

                setAppSaveStatus({ message: 'Timezone updated successfully!', type: 'success', section: 'timezone' });
                setTimeout(() => setAppSaveStatus(prev =>
                    prev.type === 'success' && prev.section === 'timezone'
                    ? { message: '', type: null, section: null }
                    : prev
                ), 3000);
            } else {
                throw new Error('Unexpected response from server.');
            }
        } catch (error) {
            console.error('Error updating timezone:', error);
            const errorMessage = error.message || 'Failed to update timezone.';
            setAppSaveStatus({ message: errorMessage, type: 'error', section: 'timezone' });
        } finally {
            setIsSavingAppSettings(false);
        }
    }, [localTimezone, settings?.timezone, timezoneChangeStatus, updateSetting]);

    const handleSaveAdvancedSettings = useCallback(() => {
        handleSaveAppSettings({ enableExperimentalFeatures: localEnableExperimentalFeatures }, 'advanced');
    }, [handleSaveAppSettings, localEnableExperimentalFeatures]);

    // --- Handler for Notification Preferences Update ---
    const handleSaveNotificationPreferences = useCallback(async () => {
        if (!updateNotificationPreferencesFn) {
            setAppSaveStatus({ message: 'Notification service unavailable.', type: 'error', section: 'notifications' });
            return;
        }

        // Validate days of week when enabled
        if (localRemindersEnabled && localDaysOfWeek.length === 0) {
            setAppSaveStatus({ message: 'Please select at least one day.', type: 'error', section: 'notifications' });
            return;
        }

        setIsSavingNotifications(true);
        setAppSaveStatus({ message: '', type: null, section: null });

        try {
            await updateNotificationPreferencesFn({
                enabled: localRemindersEnabled,
                timeBlock: localTimeBlock,
                daysOfWeek: localDaysOfWeek,
                optInSource: 'settings_page'
            });
            primeReminderPreferenceCache(localRemindersEnabled);
            setAppSaveStatus({ message: 'Preferences saved!', type: 'success', section: 'notifications' });
            setTimeout(() => setAppSaveStatus({ message: '', type: null, section: null }), 3000);
        } catch (error) {
            console.error("Error saving notification preferences:", error);
            setAppSaveStatus({ message: 'Failed to save preferences.', type: 'error', section: 'notifications' });
        } finally {
            setIsSavingNotifications(false);
        }
    }, [localRemindersEnabled, localTimeBlock, localDaysOfWeek]);

    // --- Handler for Marketing Consent Update ---
    const handleSaveMarketingConsent = useCallback(async () => {
        if (!updateMarketingConsentFn) {
            setAppSaveStatus({ message: 'Service unavailable.', type: 'error', section: 'marketing' });
            return;
        }
        setIsSavingMarketing(true);
        setAppSaveStatus({ message: '', type: null, section: null });
        try {
            await updateMarketingConsentFn({ emailOptIn: localMarketingOptIn });
            updateMarketingConsentLocally(localMarketingOptIn);
            setAppSaveStatus({ message: 'Preferences saved!', type: 'success', section: 'marketing' });
            setTimeout(() => setAppSaveStatus({ message: '', type: null, section: null }), 3000);
        } catch (error) {
            console.error("Error saving marketing consent:", error);
            setAppSaveStatus({ message: 'Failed to save preferences.', type: 'error', section: 'marketing' });
        } finally {
            setIsSavingMarketing(false);
        }
    }, [localMarketingOptIn, updateMarketingConsentLocally]);

    // --- Handler for Profile Name Update ---
    const handleSaveProfileName = useCallback(async () => {
        if (!updateDisplayNameFn) {
            setNameSaveStatus({ message: 'Name update service unavailable.', type: 'error', section: 'profile' });
            return;
        }

        const trimmedName = localName.trim();
        if (!trimmedName) {
            setNameSaveStatus({ message: 'Name cannot be empty.', type: 'error', section: 'profile' });
            return;
        }

        setIsSavingName(true);
        setNameSaveStatus({ message: '', type: null, section: null });

        try {
            const result = await updateDisplayNameFn({ displayName: trimmedName });
            if (result.data?.success) {
                // Update local context state to reflect the change immediately
                if (updateDisplayNameLocally) {
                    updateDisplayNameLocally(result.data.displayName || trimmedName);
                }
                setNameSaveStatus({ message: 'Name updated successfully!', type: 'success', section: 'profile' });
                setTimeout(() => setNameSaveStatus(prev =>
                    prev.type === 'success' && prev.section === 'profile'
                    ? { message: '', type: null, section: null }
                    : prev
                ), 3000);
            } else {
                throw new Error('Unexpected response from server.');
            }
        } catch (err) {
            console.error('Error saving profile name:', err);
            setNameSaveStatus({
                message: err.message || 'Failed to update name.',
                type: 'error',
                section: 'profile'
            });
        } finally {
            setIsSavingName(false);
        }
    }, [localName, updateDisplayNameLocally]);

    // --- Handler for Cohort Display Name Update ---
    const handleSaveCohortDisplayName = useCallback(async () => {
        if (!updateCohortDisplayNameFn) {
            setCohortDisplayNameSaveStatus({ message: 'Service unavailable.', type: 'error', section: 'cohortDisplayName' });
            return;
        }

        const trimmedName = localCohortDisplayName.trim();
        if (!trimmedName || trimmedName.length < 3) {
            setCohortDisplayNameSaveStatus({ message: 'Name must be at least 3 characters.', type: 'error', section: 'cohortDisplayName' });
            return;
        }

        setIsSavingCohortDisplayName(true);
        setCohortDisplayNameSaveStatus({ message: '', type: null, section: null });

        try {
            const result = await updateCohortDisplayNameFn({ displayName: trimmedName });
            if (result.data?.success) {
                if (updateCohortDisplayNameLocally) {
                    updateCohortDisplayNameLocally(result.data.displayName || trimmedName);
                }
                setCohortDisplayNameSaveStatus({ message: 'Display name updated!', type: 'success', section: 'cohortDisplayName' });
                setTimeout(() => setCohortDisplayNameSaveStatus(prev =>
                    prev.type === 'success' && prev.section === 'cohortDisplayName'
                    ? { message: '', type: null, section: null }
                    : prev
                ), 3000);
            } else {
                throw new Error('Unexpected response from server.');
            }
        } catch (err) {
            console.error('Error saving cohort display name:', err);
            const message = err?.message || 'Failed to update display name.';
            const cleanMessage = message.includes('HttpsError') ? message.split(': ').pop() : message;
            setCohortDisplayNameSaveStatus({
                message: cleanMessage,
                type: 'error',
                section: 'cohortDisplayName'
            });
        } finally {
            setIsSavingCohortDisplayName(false);
        }
    }, [localCohortDisplayName, updateCohortDisplayNameLocally]);

    // --- Handlers for Manual Level Change ---
    const validateLevelInputs = useCallback(() => {
        if (!isDataReady) {
            setLevelValidationError('Profile data not loaded.');
            return false;
        }
        setLevelValidationError('');
        return true;
    }, [isDataReady]);

    const handleRequestLevelChange = useCallback(() => {
        setLevelSaveStatus({ message: '', type: null });
        if (validateLevelInputs()) {
            setShowLevelConfirmModal(true);
        }
    }, [validateLevelInputs]);

    const handleConfirmLevelChange = useCallback(async () => {
        if (!validateLevelInputs()) {
            setShowLevelConfirmModal(false);
            return;
        }
        setIsSavingLevel(true);
        setLevelSaveStatus({ message: '', type: null });
        setShowLevelConfirmModal(false);
        const nBackToSave = parseInt(localNBack, 10);
        const difficultyToSave = localDifficultySliderValue / 100.0;

        try {
            if (!userId) {
                throw new Error("User ID is missing.");
            }
            const payload = {
                currentNBack: nBackToSave,
                currentDifficulty: difficultyToSave,
                gameMode: settingsGameMode,
                // Settings page only edits Adaptive state (reads from userData.modeProgression)
                trainingMode: 'adaptive',
            };
            // Dynamic mode: also save the sub-mode
            if (settingsGameMode === 'dynamic') {
                payload.currentSubMode = settingsDynamicSubMode;
            }
            const success = await updateProfileProgress(userId, payload);

            if (success) {
                setLevelSaveStatus({ message: 'Training level updated!', type: 'success' });
                setTimeout(() => setLevelSaveStatus(prev => prev.type === 'success' ? { message: '', type: null } : prev), 3500);
            } else {
                setLevelSaveStatus({ message: profileError || 'Failed to save level. Please try again.', type: 'error' });
            }
        } catch (err) {
            console.error("Error directly calling updateProfileProgress:", err);
            setLevelSaveStatus({ message: `Error updating level: ${err.message}`, type: 'error' });
        } finally {
            setIsSavingLevel(false);
        }
    }, [userId, localNBack, localDifficultySliderValue, updateProfileProgress, validateLevelInputs, profileError, settingsGameMode, settingsDynamicSubMode]);

    const handleCancelLevelChange = useCallback(() => {
        setShowLevelConfirmModal(false);
        setLevelSaveStatus({ message: '', type: null });
    }, []);

    // --- Account Section Handlers ---
    const reauthenticateUser = useCallback(async (currentPassword) => {
        const user = auth.currentUser;
        if (!user || !user.email) throw new Error("Cannot re-authenticate: User or user email is missing.");
        if (!currentPassword) throw new Error("Current password is required.");
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        try {
            await reauthenticateWithCredential(user, credential);
            return true;
        } catch (error) {
            if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') throw new Error("Incorrect current password.");
            if (error.code === 'auth/too-many-requests') throw new Error("Too many attempts. Try again later or reset password.");
            throw new Error("Re-authentication failed. Please try again.");
        }
    }, [auth]);

    const handleEmailUpdate = useCallback(async (e) => {
        e.preventDefault();
        const trimmedNewEmail = newEmail.trim();
        if (!trimmedNewEmail || !currentPasswordForEmail) { setEmailUpdateError("Please fill in all fields."); return; }
        if (trimmedNewEmail === authUser?.email) { setEmailUpdateError("New email cannot be the same as the current email."); return; }
        setEmailUpdateLoading(true); setEmailUpdateError(null); setEmailUpdateSuccess(false);
        try {
            await reauthenticateUser(currentPasswordForEmail);
            const user = auth.currentUser;
            if (!user) throw new Error("User not found after re-authentication.");
            await updateEmail(user, trimmedNewEmail);
            setEmailUpdateSuccess(true); setNewEmail(''); setCurrentPasswordForEmail('');
            setVerificationMessage(null); setVerificationMessageType(null);
            setTimeout(() => setEmailUpdateSuccess(false), 3500);
        } catch (error) {
            let message = error.message || "Failed to update email. Please try again.";
            if (error.code === 'auth/email-already-in-use') message = "This email address is already registered to another account.";
            if (error.code === 'auth/invalid-email') message = "The new email address format is invalid.";
            setEmailUpdateError(message);
        } finally { setEmailUpdateLoading(false); }
    }, [newEmail, currentPasswordForEmail, authUser?.email, reauthenticateUser, auth]);

    const handlePasswordUpdate = useCallback(async (e) => {
        e.preventDefault();
        if (!currentPasswordForPassword || !newPassword || !confirmNewPassword) { setPasswordUpdateError("Please fill in all fields."); return; }
        if (newPassword.length < 6) { setPasswordUpdateError("New password must be at least 6 characters long."); return; }
        if (newPassword !== confirmNewPassword) { setPasswordUpdateError("New passwords do not match."); return; }
        setPasswordUpdateLoading(true); setPasswordUpdateError(null); setPasswordUpdateSuccess(false);
        try {
            await reauthenticateUser(currentPasswordForPassword);
            const user = auth.currentUser;
            if (!user) throw new Error("User not found after re-authentication.");
            await updatePassword(user, newPassword);
            setPasswordUpdateSuccess(true); setCurrentPasswordForPassword(''); setNewPassword(''); setConfirmNewPassword('');
            setTimeout(() => setPasswordUpdateSuccess(false), 3500);
        } catch (error) { setPasswordUpdateError(error.message || "Failed to update password. Please try again."); }
        finally { setPasswordUpdateLoading(false); }
    }, [currentPasswordForPassword, newPassword, confirmNewPassword, reauthenticateUser, auth]);

    const handleLogout = useCallback(async () => {
        try { await signOut(auth); navigate('/login', { replace: true }); }
        catch (error) { console.error("Logout failed:", error); alert("Logout failed. Please try again."); }
    }, [auth, navigate]);

    const handleManageBilling = useCallback(async () => {
        // Route based on subscription platform (not current device)
        // This ensures cross-platform consistency: Android subscriber on web sees "Manage in Google Play"
        if (subscriptionPlatform === 'ios_iap') {
            setIsPortalLoading(true);
            try {
                const { Browser } = await import('@capacitor/browser');
                await Browser.open({ url: 'https://apps.apple.com/account/subscriptions' });
            } catch {
                // Fallback for web: open in new tab
                window.open('https://apps.apple.com/account/subscriptions', '_blank');
            }
            setIsPortalLoading(false);
            return;
        }

        if (subscriptionPlatform === 'android_iap') {
            setIsPortalLoading(true);
            try {
                const { Browser } = await import('@capacitor/browser');
                await Browser.open({ url: 'https://play.google.com/store/account/subscriptions' });
            } catch {
                // Fallback for web: open in new tab
                window.open('https://play.google.com/store/account/subscriptions', '_blank');
            }
            setIsPortalLoading(false);
            return;
        }

        // Default: Stripe Customer Portal (web subscribers or unknown platform)
        if (!createCustomerPortalSession) { setPortalError("Billing management feature is currently unavailable."); return; }
        setIsPortalLoading(true); setPortalError(null);
        try {
            const result = await createCustomerPortalSession();
            const portalUrl = result?.data?.url;
            if (portalUrl) {
                await openBillingPortal(portalUrl);
            }
            else { throw new Error("Could not retrieve the billing portal URL."); }
        } catch (err) {
            let message = "Failed to open the billing portal. Please try again later.";
            if (err?.code === 'unauthenticated') message = "Authentication error. Please log out and log back in.";
            else if (err?.code === 'not-found') message = "Billing information not found for your account.";
            else if (err?.message) message = err.message;
            setPortalError(message);
        } finally { if (!isNative() && !window.location.href.includes('stripe.com')) setIsPortalLoading(false); else setIsPortalLoading(false); }
    }, [subscriptionPlatform]);

    const handleRestorePurchases = useCallback(async () => {
        if (isRestoringPurchases) return;
        setIsRestoringPurchases(true);
        setRestoreMessage(null);
        setRestoreMessageType(null);

        const result = await restorePurchases();
        if (result.success && result.isActive) {
            setRestoreMessage("Purchases restored successfully. Your Pro access is now active.");
            setRestoreMessageType('success');
            // Mirror the entitlement into context instead of calling refreshUserData():
            // that drops isInitialLoadComplete, which unmounts this page behind the
            // AuthGuard loading screen and discards the message set above — the user
            // is bounced back to the settings root with no feedback at all. Same
            // reason the resume and cancel handlers below mirror rather than refresh.
            // The RevenueCat webhook writes the authoritative state to Firestore
            // (including the TRANSFER case when restoring onto a different account);
            // this only keeps the UI truthful until the next load.
            setSubscriptionTier('premium');
            setUserSubscriptionStatus('active');
            setSubscriptionPlatform(isIOS() ? 'ios_iap' : 'android_iap');
        } else if (result.success) {
            setRestoreMessage("No previous purchases found.");
            setRestoreMessageType('info');
        } else {
            setRestoreMessage(result.error || "Failed to restore purchases.");
            setRestoreMessageType('error');
        }
        setIsRestoringPurchases(false);
    }, [isRestoringPurchases, setSubscriptionTier, setUserSubscriptionStatus, setSubscriptionPlatform]);

    const handleResumeSubscription = useCallback(async () => {
        if (!resumeSubscriptionFn) {
            setResumeError("Resuming a subscription is currently unavailable.");
            return;
        }
        setIsResumingSubscription(true);
        setResumeError(null);
        try {
            const result = await resumeSubscriptionFn();
            if (!result?.data?.success) {
                throw new Error("The subscription could not be resumed.");
            }
            // Mirror the backend write in context. refreshUserData() would drop
            // isInitialLoadComplete, which unmounts this page behind the AuthGuard
            // loading screen and discards the section the user is standing in.
            setUserSubscriptionCancelAtPeriodEnd(false);
        } catch (err) {
            const message = err?.message || "Could not resume the subscription. Please try again.";
            setResumeError(message);
        } finally {
            setIsResumingSubscription(false);
        }
    }, [setUserSubscriptionCancelAtPeriodEnd]);

    const handleCancelLifetimeTrial = useCallback(() => {
        setCancelLifetimeTrialError(null);
        setCancelLifetimeTrialSuccess(null);
        if (!cancelLifetimeTrialFn) {
            setCancelLifetimeTrialError("Cancellation feature is currently unavailable.");
            return;
        }
        setShowCancelLifetimeTrialModal(true);
    }, []);

    const handleConfirmCancelLifetimeTrial = useCallback(async () => {
        setShowCancelLifetimeTrialModal(false);
        if (!cancelLifetimeTrialFn) {
            setCancelLifetimeTrialError("Cancellation feature is currently unavailable.");
            return;
        }
        setIsCancellingLifetimeTrial(true);
        setCancelLifetimeTrialError(null);
        try {
            const result = await cancelLifetimeTrialFn();
            if (!result?.data?.success) {
                throw new Error("Cancellation did not complete.");
            }
            setCancelLifetimeTrialSuccess("Lifetime Trial cancelled. No charge will be applied.");
            // Mirror the backend write in context (lifetimeTrialStatus + tier/status)
            // rather than refreshUserData(), which unmounts this page mid-flow.
            setLifetimeTrialStatus('cancelled');
            setUserSubscriptionStatus('free');
            setSubscriptionTier('free');
        } catch (err) {
            const message = err?.message || "Could not cancel the trial. Please try again.";
            setCancelLifetimeTrialError(message);
        } finally {
            setIsCancellingLifetimeTrial(false);
        }
    }, [setLifetimeTrialStatus, setUserSubscriptionStatus, setSubscriptionTier]);

    const handleSendVerificationEmail = useCallback(async () => {
        if (!authUser || !auth.currentUser) { setVerificationMessage("Error: Could not find user information."); setVerificationMessageType('error'); return; }
        setIsSendingVerification(true); setVerificationMessage(null); setVerificationMessageType(null);
        try {
            await sendEmailVerification(auth.currentUser);
            setVerificationMessage(`Verification email sent to ${authUser.email}. Please check your inbox.`);
            setVerificationMessageType('success');
        } catch (error) {
            let message = "Failed to send verification email. Please try again later.";
            if (error.code === 'auth/too-many-requests') message = "Too many verification emails sent recently. Please wait.";
            setVerificationMessage(message); setVerificationMessageType('error');
        } finally { setIsSendingVerification(false); }
    }, [auth, authUser]);

    // --- Derived Values ---
    const nBackOptions = useMemo(() => {
        const options = [];
        for (let i = 1; i <= 20; i++) {
            options.push({ value: String(i), label: String(i) });
        }
        return options;
    }, []);

    const displayedCombinedLevel = useMemo(() => {
        const nBackNum = parseInt(localNBack, 10) || 0;
        const difficulty = Math.max(0, Math.min(99, localDifficultySliderValue)) / 100.0;
        return (nBackNum + difficulty).toFixed(2);
    }, [localNBack, localDifficultySliderValue]);

    const voiceOptions = useMemo(() => {
        if (!availableVoices || Object.keys(availableVoices).length === 0) return [];
        return Object.entries(availableVoices).map(([id, voice]) => ({
            value: id,
            label: voice.name || id
        }));
    }, [availableVoices]);

    const currentLocalTime = useMemo(() => {
        try {
            return new Date().toLocaleTimeString([], {
                timeZone: localTimezone,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
        } catch (e) {
            try {
                 return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
            } catch { return "Invalid Time"; }
        }
    }, [localTimezone]);

    const currentLocalDate = useMemo(() => {
        try {
            return new Date().toLocaleDateString([], {
                timeZone: localTimezone,
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
            });
        } catch (e) {
            try {
                return new Date().toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
            } catch { return "Invalid Date"; }
        }
    }, [localTimezone]);

    const dynamicSampleLetters = useMemo(() => {
        const availableLangKeys = Object.keys(LANGUAGE_AUDIO_LETTERS);
        let langCode = 'en';

        if (localSelectedVoiceId) {
            const parts = localSelectedVoiceId.split('-');
            let foundCode = null;

            if (parts.length >= 2) {
                const testCode = `${parts[0]}-${parts[1]}`;
                if (availableLangKeys.includes(testCode)) foundCode = testCode;
            }
            if (!foundCode && parts.length >= 1) {
                const testCode = parts[0];
                if (availableLangKeys.includes(testCode)) foundCode = testCode;
            }
            if (!foundCode && parts[0] === 'google') {
                if (parts.length >= 3) {
                    const testCode = `${parts[1]}-${parts[2]}`;
                    if (availableLangKeys.includes(testCode)) foundCode = testCode;
                }
                if (!foundCode && parts.length >= 2) {
                    const testCode = parts[1];
                    if (availableLangKeys.includes(testCode)) foundCode = testCode;
                }
            }
            if (foundCode) langCode = foundCode;
        }

        if (!LANGUAGE_AUDIO_LETTERS[langCode] && availableLangKeys.includes('en')) {
            langCode = 'en';
        } else if (!LANGUAGE_AUDIO_LETTERS[langCode]) {
            return DEFAULT_ENGLISH_SAMPLE_LETTERS;
        }

        const letterData = LANGUAGE_AUDIO_LETTERS[langCode];
        if (!letterData || !letterData.letters || !Array.isArray(letterData.letters) || letterData.letters.length === 0) {
            return DEFAULT_ENGLISH_SAMPLE_LETTERS;
        }

        const allUniqueLettersForLang = [...new Set(letterData.letters.flat())];
        const maxSamples = 6;
        const samples = allUniqueLettersForLang.slice(0, maxSamples);

        return samples.length > 0 ? samples : DEFAULT_ENGLISH_SAMPLE_LETTERS;
    }, [localSelectedVoiceId]);

    // --- Render Logic ---
    const isLoading = isLoadingAppSettings || isLoadingProfile;
    const isLevelSectionDisabled = isAnySaving || isKeySettingInProgress || !isDataReady;

    if (isLoading) {
        return (
            <div className="min-h-screen bg-theme-bg lab-grid flex items-center justify-center">
                <div className="text-center">
                    <div className="relative inline-block">
                        <div className="h-16 w-16 rounded-full border-2 border-theme-line"></div>
                        <div className="absolute inset-0 h-16 w-16 rounded-full border-2 border-transparent border-t-amber-accent animate-spin"></div>
                    </div>
                    <p className="mt-4 text-theme-text-muted font-mono text-sm uppercase tracking-wider">Loading settings...</p>
                </div>
            </div>
        );
    }

    // --- Render Section Content Based on Active Section ---
    const renderSectionContent = () => {
        switch (activeSection) {
            case SETTINGS_SECTIONS.PROFILE.id:
                return (
                    <SectionContent title="Profile" description="Manage your account details">
                        <div className="space-y-6">
                            {/* Display Name */}
                            <DisplayNameSettings
                                localName={localName}
                                onNameChange={setLocalName}
                                currentName={userData?.displayName}
                                isDisabled={isAnySaving || !isDataReady}
                                isSaving={isSavingName}
                                saveStatus={nameSaveStatus}
                                onSaveName={handleSaveProfileName}
                            />

                            {/* Divider */}
                            <div className="border-t border-theme-line"></div>

                            {/* Cohort Display Name */}
                            <CohortDisplayNameSettings
                                localCohortDisplayName={localCohortDisplayName}
                                onNameChange={setLocalCohortDisplayName}
                                currentName={userData?.cohortDisplayName}
                                isDisabled={isAnySaving || !isDataReady}
                                isSaving={isSavingCohortDisplayName}
                                saveStatus={cohortDisplayNameSaveStatus}
                                onSave={handleSaveCohortDisplayName}
                            />

                            {/* Divider */}
                            <div className="border-t border-theme-line"></div>

                            {/* Email */}
                            <AccountEmailSection
                                authUser={authUser}
                                newEmail={newEmail}
                                setNewEmail={setNewEmail}
                                currentPasswordForEmail={currentPasswordForEmail}
                                setCurrentPasswordForEmail={setCurrentPasswordForEmail}
                                emailUpdateLoading={emailUpdateLoading}
                                emailUpdateError={emailUpdateError}
                                emailUpdateSuccess={emailUpdateSuccess}
                                handleEmailUpdate={handleEmailUpdate}
                                isSendingVerification={isSendingVerification}
                                verificationMessage={verificationMessage}
                                verificationMessageType={verificationMessageType}
                                handleSendVerificationEmail={handleSendVerificationEmail}
                                InputFieldComponent={LabInputField}
                                ButtonComponent={LabButton}
                                AlertComponent={LabAlert}
                                StatusBadgeComponent={LabStatusBadge}
                            />

                            {/* Divider */}
                            <div className="border-t border-theme-line"></div>

                            {/* Password */}
                            <AccountPasswordSection
                                currentPasswordForPassword={currentPasswordForPassword}
                                setCurrentPasswordForPassword={setCurrentPasswordForPassword}
                                newPassword={newPassword}
                                setNewPassword={setNewPassword}
                                confirmNewPassword={confirmNewPassword}
                                setConfirmNewPassword={setConfirmNewPassword}
                                passwordUpdateLoading={passwordUpdateLoading}
                                passwordUpdateError={passwordUpdateError}
                                passwordUpdateSuccess={passwordUpdateSuccess}
                                handlePasswordUpdate={handlePasswordUpdate}
                                InputFieldComponent={LabInputField}
                                ButtonComponent={LabButton}
                                AlertComponent={LabAlert}
                            />

                            {/* Coach Access (only shown if connected to a coach) */}
                            {coachId && (
                                <>
                                    <div className="border-t border-theme-line"></div>
                                    <CoachAccessSettings
                                        coachId={coachId}
                                        coachGrantedPremium={coachGrantedPremium}
                                    />
                                </>
                            )}
                        </div>
                    </SectionContent>
                );
            case SETTINGS_SECTIONS.CONTROLS.id:
                return (
                    <SectionContent title="Controls" description="Configure your keyboard inputs for the training exercise">
                        <KeyBindingsSettings
                            localKeyBindings={localKeyBindings}
                            settingKey={settingKey}
                            onStartSettingKey={handleStartSettingKey}
                            isGeneralSectionDisabled={isGeneralSectionDisabled}
                            isSavingAppSettings={isSavingAppSettings}
                            appSaveStatus={appSaveStatus}
                            onSaveKeyBindings={handleSaveKeyBindings}
                            activeGameMode={activeGameMode}
                        />
                    </SectionContent>
                );
            case SETTINGS_SECTIONS.AUDIO.id:
                return (
                    <SectionContent title="Audio" description="Voice selection and feedback options">
                        <GameplayAudioSettings
                            localInstantFeedbackPositive={localInstantFeedbackPositive}
                            onInstantFeedbackPositiveChange={setLocalInstantFeedbackPositive}
                            localInstantFeedbackErrors={localInstantFeedbackErrors}
                            onInstantFeedbackErrorsChange={setLocalInstantFeedbackErrors}
                            localInstantFeedbackMisses={localInstantFeedbackMisses}
                            onInstantFeedbackMissesChange={setLocalInstantFeedbackMisses}
                            localSelectedVoiceId={localSelectedVoiceId}
                            onSelectedVoiceIdChange={(e) => setLocalSelectedVoiceId(e.target.value)}
                            voiceOptions={voiceOptions}
                            isGeneralSectionDisabled={isGeneralSectionDisabled}
                            audioReady={audioReady}
                            onResumeAudio={handleResumeAudio}
                            sampleLetters={dynamicSampleLetters}
                            onTestLetter={handleTestLetter}
                            activeButton={activeButton}
                            isSavingAppSettings={isSavingAppSettings}
                            appSaveStatus={appSaveStatus}
                            onSaveGameplayAudio={handleSaveGameplayAudio}
                        />
                    </SectionContent>
                );
            case SETTINGS_SECTIONS.TRAINING.id:
                return (
                    <SectionContent title="Training Level" description="Manually adjust your N-Back level">
                        <TrainingLevelSettings
                            hasProfile={isDataReady}
                            selectedMode={settingsGameMode}
                            onModeChange={setSettingsGameMode}
                            localNBack={localNBack}
                            onNBackChange={(e) => setLocalNBack(e.target.value)}
                            nBackOptions={nBackOptions}
                            localDifficultySliderValue={localDifficultySliderValue}
                            onDifficultySliderChange={(e) => setLocalDifficultySliderValue(parseInt(e.target.value, 10))}
                            displayedCombinedLevel={displayedCombinedLevel}
                            isLevelSectionDisabled={isLevelSectionDisabled}
                            levelValidationError={levelValidationError}
                            isSavingLevel={isSavingLevel}
                            levelSaveStatus={levelSaveStatus}
                            onRequestLevelChange={handleRequestLevelChange}
                            // Mirror backend isFreeTierForSnapping: Pro, grandfather-active, and
                            // limited_modern all get full-precision difficulty (only classic_legacy
                            // is coarse-snapped). See functions/game.js + ProfileDashboard.js.
                            isFreeTier={!isFullAdaptive && freeTier !== 'limited_modern'}
                            isGrandfathered={preMonetizationChange === true}
                            difficultyAdjustmentRange={settings.difficultyAdjustmentRange || 'standard'}
                            onDifficultyAdjustmentRangeChange={(range) => updateSetting('difficultyAdjustmentRange', range)}
                            isPro={subscriptionTier === 'premium' || coachGrantedPremium}
                            dynamicSubMode={settingsDynamicSubMode}
                            onDynamicSubModeChange={setSettingsDynamicSubMode}
                            hasClassicAccess={hasClassicAccess}
                            classicAutoLevel={settings.classicAutoLevel !== false}
                            onClassicAutoLevelChange={(val) => updateSetting('classicAutoLevel', val)}
                            adaptiveAutoLevel={settings.adaptiveAutoLevel !== false}
                            onAdaptiveAutoLevelChange={(val) => updateSetting('adaptiveAutoLevel', val)}
                        />
                        {activeGameMode === 'singleColor' && (
                            <ResponseModeSettings
                                responseMode={settings?.responseModes?.singleColor || 'match'}
                                onChange={(mode) => updateSetting('responseModes', { ...(settings?.responseModes || {}), singleColor: mode })}
                            />
                        )}
                    </SectionContent>
                );
            case SETTINGS_SECTIONS.APPEARANCE.id:
                return (
                    <SectionContent title="Appearance" description="Customize your visual experience">
                        <AppearanceSettings
                            localTheme={localTheme}
                            onThemeChange={setLocalTheme}
                            localAutoHideCursor={localAutoHideCursor}
                            onAutoHideCursorChange={setLocalAutoHideCursor}
                            localTextScale={localTextScale}
                            onTextScaleChange={handleTextScaleChange}
                            isDisabled={isGeneralSectionDisabled}
                            isSaving={isSavingAppSettings}
                            saveStatus={appSaveStatus}
                            onSave={handleSaveAppearance}
                        />
                        <div className="mt-6 pt-6 border-t border-theme-line">
                            <ColorPreferencesSection />
                        </div>
                    </SectionContent>
                );
            case SETTINGS_SECTIONS.TIMEZONE.id:
                return (
                    <SectionContent title="Timezone" description="Set your local time zone for session quota tracking">
                        <TimeZoneSettings
                            localTimezone={localTimezone}
                            onTimezoneChange={(e) => setLocalTimezone(e.target.value)}
                            timezoneOptions={TIMEZONE_OPTIONS}
                            currentLocalTime={currentLocalTime}
                            currentLocalDate={currentLocalDate}
                            isGeneralSectionDisabled={isGeneralSectionDisabled || !timezoneChangeStatus.canChange}
                            isSavingAppSettings={isSavingAppSettings}
                            appSaveStatus={appSaveStatus}
                            onSaveTimeZone={handleSaveTimeZone}
                            timezoneChangeStatus={timezoneChangeStatus}
                        />
                    </SectionContent>
                );
            case SETTINGS_SECTIONS.EXPERIMENTAL.id:
                return (
                    <SectionContent title="Lab Features" description="Enable experimental and beta features">
                        <AdvancedSettingsSection
                            localEnableExperimentalFeatures={localEnableExperimentalFeatures}
                            onEnableExperimentalFeaturesChange={setLocalEnableExperimentalFeatures}
                            isGeneralSectionDisabled={isGeneralSectionDisabled}
                            isSavingAppSettings={isSavingAppSettings}
                            appSaveStatus={appSaveStatus}
                            onSaveAdvancedSettings={handleSaveAdvancedSettings}
                        />
                    </SectionContent>
                );
            case SETTINGS_SECTIONS.NOTIFICATIONS.id:
                return (
                    <SectionContent title="Notifications" description="Email reminders and marketing preferences">
                        <NotificationSettings
                            localRemindersEnabled={localRemindersEnabled}
                            onRemindersEnabledChange={setLocalRemindersEnabled}
                            localTimeBlock={localTimeBlock}
                            onTimeBlockChange={setLocalTimeBlock}
                            localDaysOfWeek={localDaysOfWeek}
                            onDaysOfWeekChange={setLocalDaysOfWeek}
                            userTimezone={settings?.timezone || localTimezone}
                            isDisabled={isGeneralSectionDisabled || isLoadingNotifications}
                            isSaving={isSavingNotifications}
                            saveStatus={appSaveStatus}
                            onSave={handleSaveNotificationPreferences}
                            localMarketingOptIn={localMarketingOptIn}
                            onMarketingOptInChange={setLocalMarketingOptIn}
                            isSavingMarketing={isSavingMarketing}
                            onSaveMarketing={handleSaveMarketingConsent}
                        />
                    </SectionContent>
                );
            case SETTINGS_SECTIONS.ABOUT.id:
                return (
                    <SectionContent title="About" description="Our mission and what we're building">
                        <AboutContent />
                    </SectionContent>
                );
            case SETTINGS_SECTIONS.LEGAL.id:
                return (
                    <SectionContent title="Legal" description="Health & Safety Notice, Terms, and Privacy Policy">
                        <LegalSection />
                    </SectionContent>
                );
            case SETTINGS_SECTIONS.BILLING.id:
                return (
                    <SectionContent title="Subscription" description="Manage your billing and subscription">
                        <LabAlert type="success" message={cancelLifetimeTrialSuccess} />
                        <AccountSubscriptionSection
                            isContextLoading={isLoadingProfile}
                            userSubscriptionStatus={userSubscriptionStatus}
                            userSubscriptionEndDate={userSubscriptionEndDate}
                            userSubscriptionPriceId={userSubscriptionPriceId}
                            userSubscriptionCancelAtPeriodEnd={userSubscriptionCancelAtPeriodEnd}
                            subscriptionPlatform={subscriptionPlatform}
                            subscriptionType={subscriptionType}
                            isPortalLoading={isPortalLoading}
                            portalError={portalError}
                            handleManageBilling={handleManageBilling}
                            createCustomerPortalSession={createCustomerPortalSession}
                            handleResumeSubscription={handleResumeSubscription}
                            isResumingSubscription={isResumingSubscription}
                            resumeError={resumeError}
                            isRestoringPurchases={isRestoringPurchases}
                            restoreMessage={restoreMessage}
                            restoreMessageType={restoreMessageType}
                            handleRestorePurchases={handleRestorePurchases}
                            isAppManagedTrial={isInFreeTrial}
                            freeTrialDaysRemaining={freeTrialDaysRemaining}
                            isInLifetimeTrial={isInLifetimeTrial}
                            lifetimeTrialEndsAt={lifetimeTrialEndsAt}
                            lifetimeTrialDaysRemaining={lifetimeTrialDaysRemaining}
                            handleCancelLifetimeTrial={handleCancelLifetimeTrial}
                            isCancellingLifetimeTrial={isCancellingLifetimeTrial}
                            cancelLifetimeTrialError={cancelLifetimeTrialError}
                            ButtonComponent={LabButton}
                            AlertComponent={LabAlert}
                            StatusBadgeComponent={LabStatusBadge}
                            LoadingSpinnerComponent={LoadingSpinner}
                        />
                    </SectionContent>
                );
            case SETTINGS_SECTIONS.DELETE_ACCOUNT.id:
                // Native-only section; web deep-links (?section=delete-account) render nothing —
                // the /delete-account route is the web deletion path.
                if (!isNative()) return null;
                return (
                    <SectionContent title="Delete Account" description="Permanently delete this account and its data">
                        <AccountDeleteFlow
                            ButtonComponent={LabButton}
                            AlertComponent={LabAlert}
                        />
                    </SectionContent>
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-theme-bg lab-grid">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
                {/* Header - Lab notebook style */}
                <header className="mb-8 sm:mb-10">
                    {/* Back navigation */}
                    <div className="mb-6">
                        <Link
                            to="/dashboard"
                            className="group inline-flex items-center gap-2 text-theme-text-muted hover:text-theme-accent transition-colors"
                        >
                            <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3 transition-transform group-hover:-translate-x-1" />
                            <span className="text-xs font-mono uppercase tracking-wider">Return to Dashboard</span>
                        </Link>
                    </div>

                    {/* Title section */}
                    <div className="flex items-center gap-4">
                        {/* Icon badge */}
                        <div className="h-12 w-12 sm:h-14 sm:w-14 relative flex-shrink-0 hidden sm:block">
                            <div className="absolute inset-0 bg-theme-accent/20 rounded-sm rotate-3"></div>
                            <div className="absolute inset-0 bg-theme-bg-secondary border border-theme-accent flex items-center justify-center text-theme-accent">
                                <FontAwesomeIcon icon={faCog} className="h-5 w-5 sm:h-6 sm:w-6" />
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono">Configuration</p>
                            <h1 className="text-xl sm:text-2xl lg:text-3xl text-theme-text font-serif italic">
                                Settings
                            </h1>
                        </div>
                    </div>
                </header>

                {/* Global Errors */}
                {appSettingsError && <LabAlert type="error" message={appSettingsError} />}
                {profileError && <LabAlert type="error" message={profileError} />}

                {/* Main Layout */}
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Sidebar Navigation */}
                    <SettingsNav
                        activeSection={activeSection}
                        onSectionChange={setActiveSection}
                        onLogoutClick={() => setShowLogoutModal(true)}
                        isMobileMenuOpen={isMobileMenuOpen}
                        setIsMobileMenuOpen={setIsMobileMenuOpen}
                    />

                    {/* Content Area */}
                    <main className="flex-1 min-w-0">
                        <div className="specimen-card rounded-lab p-6">
                            {renderSectionContent()}
                        </div>
                    </main>
                </div>

                {/* Level Change Confirmation Modal */}
                <ConfirmationModal
                    isOpen={showLevelConfirmModal}
                    title="Confirm Level Change"
                    onConfirm={handleConfirmLevelChange}
                    onClose={handleCancelLevelChange}
                    confirmText="Update Level"
                    cancelText="Cancel"
                    isDestructive={false}
                >
                    <p className="text-sm text-theme-text-secondary font-mono">
                        Your training level will be updated. The system will continue adapting based on your performance from this new starting point.
                    </p>
                    <p className="text-sm text-theme-text font-mono mt-3">Proceed with update?</p>
                </ConfirmationModal>

                {/* Lifetime Trial Cancellation Confirmation Modal */}
                <ConfirmationModal
                    isOpen={showCancelLifetimeTrialModal}
                    title="Cancel Lifetime Trial"
                    onConfirm={handleConfirmCancelLifetimeTrial}
                    onClose={() => setShowCancelLifetimeTrialModal(false)}
                    confirmText="Cancel Trial"
                    cancelText="Keep Trial"
                    isDestructive={false}
                >
                    <p className="text-sm text-theme-text-secondary font-mono">
                        Cancelling the 14-day Lifetime Trial ends Pro access immediately, and the saved card will not be charged.
                    </p>
                </ConfirmationModal>

                {/* Logout Confirmation Modal */}
                <ConfirmationModal
                    isOpen={showLogoutModal}
                    title="Log Out"
                    onConfirm={() => {
                        setShowLogoutModal(false);
                        handleLogout();
                    }}
                    onClose={() => setShowLogoutModal(false)}
                    confirmText="Log Out"
                    cancelText="Cancel"
                    isDestructive={true}
                >
                    <p className="text-sm text-theme-text-secondary font-mono">
                        Are you sure you want to log out? Your training data will be preserved.
                    </p>
                </ConfirmationModal>
            </div>
        </div>
    );
};

export default SettingsPage;
