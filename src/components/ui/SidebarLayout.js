/* File: src/components/ui/SidebarLayout.js */
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Outlet, useLocation, Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faHouse, faSliders,
    faBars, faTimes,
    faChevronLeft, faChevronRight, faClipboardList,
    faCommentDots,
    faFlask, // <-- Icon FOR PLAYGROUND (used for Experimental)
    faRocket, // <-- Icon for What's New / Changelog
    faSun, faMoon, // <-- Theme toggle icons
    faUsers, // <-- Icon for Program
    faLightbulb, // <-- Icon for Insights (beta, allen-only)
} from '@fortawesome/free-solid-svg-icons';
import { useUser } from '../../contexts/UserContext';
import { useCohort } from '../../contexts/CohortContext';
import FeedbackButton from '../feedback/FeedbackButton'; // Floating feedback button component
import { useSettings } from '../../contexts/SettingsContext'; // For Experimental feature toggle
import { isNative } from '../../utils/platform';
import { SAFE_AREA_TOP, SAFE_AREA_BOTTOM } from '../../utils/safeArea';
import { isEmulatorEnv, functions } from '../../firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import DailyCapCounterSidebar from '../upsell/DailyCapCounterSidebar';
import ProTrialUpgradeModal from './ProTrialUpgradeModal';


// **** RENAMED: Define the target email for EXPERIMENTAL features access ****
const TARGET_EMAIL_FOR_EXPERIMENTAL = "allen@dualnback.com";

// localStorage key for changelog last viewed timestamp
const CHANGELOG_LAST_VIEWED_KEY = 'changelog_last_viewed';

// localStorage key for assessment dot dismissal timestamp
const CST_DOT_DISMISSED_KEY = 'cst_assessment_dot_dismissed_at';
const CST_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

// Polling interval for checking new changelogs (2 minutes)
const CHANGELOG_POLL_INTERVAL = 2 * 60 * 1000;

const SidebarLayout = () => {
    // ... (keep existing state variables: isMobileMenuOpen, etc.) ...
    const location = useLocation();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
    const {
        authUser, userData, userSubscriptionStatus, coachGrantedPremium,
        // ProTrialUpgradeModal state — mount lives here so the modal can be
        // opened from any layout-wrapped route (sidebar widget, dashboard, etc).
        showProTrialUpgradeModal, setShowProTrialUpgradeModal,
        proTrialUpgradeModalTrigger, setProTrialUpgradeModalTrigger,
    } = useUser();
    const { settings, updateSetting } = useSettings(); // Get settings for experimental feature toggle + theme

    const handleProTrialModalClose = useCallback(() => {
        setShowProTrialUpgradeModal(false);
        setProTrialUpgradeModalTrigger(null);
    }, [setShowProTrialUpgradeModal, setProTrialUpgradeModalTrigger]);

    // --- Changelog Badge State ---
    const [newestChangelogAt, setNewestChangelogAt] = useState(null);
    const [lastViewedAt, setLastViewedAt] = useState(() => localStorage.getItem(CHANGELOG_LAST_VIEWED_KEY));

    // Remote changelog polling is disabled in the offline build.

    // Listen for changelog viewed event (dispatched by ChangelogPage)
    useEffect(() => {
        const handleChangelogViewed = () => {
            const newLastViewed = localStorage.getItem(CHANGELOG_LAST_VIEWED_KEY);
            setLastViewedAt(newLastViewed);
        };

        window.addEventListener('changelog-viewed', handleChangelogViewed);
        return () => window.removeEventListener('changelog-viewed', handleChangelogViewed);
    }, []);

    // Calculate if there's new changelog content
    // Only show badge if user has viewed changelog before AND there's newer content
    // New users (never viewed) won't see the badge - prevents "new" indicator on first visit
    const hasNewChangelog = useMemo(() => {
        if (!newestChangelogAt) return false;
        if (!lastViewedAt) return false; // Never viewed = don't show (new users)
        return new Date(newestChangelogAt) > new Date(lastViewedAt);
    }, [newestChangelogAt, lastViewedAt]);

    // --- Program Badge State (hybrid: localStorage for instant UI + Firestore for cross-device) ---
    const { activeCohort, unreadChatCount } = useCohort();
    const [programDismissedLocally, setProgramDismissedLocally] = useState(false);

    const hasNewProgram = useMemo(() => {
        if (!activeCohort || activeCohort.status !== 'active') return false;
        // Check local dismissal (instant, triggers re-render)
        if (programDismissedLocally) return false;
        // Check server-side dismissal (cross-device)
        if (userData?.programCohortSeen === activeCohort.id) return false;
        // Check localStorage (survives refresh before server round-trip)
        if (localStorage.getItem(`program_cohort_seen_${activeCohort.id}`)) return false;
        return true;
    }, [activeCohort, userData?.programCohortSeen, programDismissedLocally]);

    // Remote cohort synchronization is disabled in the offline build.

    // --- Assessment "New" Dot State ---
    const hasNewAssessment = useMemo(() => {
        const lastAssessmentTs = userData?.lastCstAssessmentTimestamp;
        if (!lastAssessmentTs) return false;

        const lastAssessmentDate = new Date(lastAssessmentTs);
        if (isNaN(lastAssessmentDate.getTime())) return false;

        const availableSinceDate = new Date(lastAssessmentDate.getTime() + CST_COOLDOWN_MS);
        if (new Date() < availableSinceDate) return false;

        const dismissedAt = localStorage.getItem(CST_DOT_DISMISSED_KEY);
        if (!dismissedAt) return false;

        return availableSinceDate > new Date(dismissedAt);
    }, [userData?.lastCstAssessmentTimestamp]);

    // Dismiss assessment dot when user navigates to /testing
    useEffect(() => {
        if (location.pathname.startsWith('/testing')) {
            localStorage.setItem(CST_DOT_DISMISSED_KEY, new Date().toISOString());
        }
    }, [location.pathname]);

    // --- Callback Functions (Memoized for performance) ---

    // Determines if the sidebar should be shown based on the current route
    const shouldShowSidebar = useCallback(() => {
        const noSidebarRoutes = [
            '/game', '/profile-setup', '/challenge-start', '/welcome-setup',
            '/share/replay', '/replay', '/experimental/audio-n-back' // Audio N-Back game is full screen
        ];
        return !noSidebarRoutes.some(route => location.pathname.startsWith(route));
    }, [location.pathname]);

    // Checks if a navigation link path is the currently active route
    const isActive = useCallback((path) => {
        if (path === '/dashboard' && location.pathname === '/') return true;
        return location.pathname === path || location.pathname.startsWith(path + '/');
    }, [location.pathname]);

    // Handles clicks on navigation links, navigates, and closes mobile menu
    const handleLinkClick = useCallback((path) => {
        navigate(path);
        setIsMobileMenuOpen(false);
    }, [navigate]);

    // Toggles the visibility of the mobile menu
    const toggleMobileMenu = useCallback(() => {
        setIsMobileMenuOpen(prev => !prev);
    }, []);

    // Toggles the collapsed state of the desktop sidebar
    const toggleSidebar = useCallback(() => {
        setSidebarCollapsed(prev => !prev);
    }, []);

    // Toggles the theme between light and dark
    const toggleTheme = useCallback(() => {
        const currentTheme = settings?.theme || 'dark';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        updateSetting('theme', newTheme);
    }, [settings?.theme, updateSetting]);

    // Get current theme icon
    const currentTheme = settings?.theme || 'dark';
    const themeIcon = currentTheme === 'light' ? faMoon : faSun;
    const themeTooltip = currentTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';

    // --- Effects ---
    // Effect to close the mobile menu if the window resizes to a larger screen
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 1024 && isMobileMenuOpen) {
                setIsMobileMenuOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isMobileMenuOpen]);

    // --- Reusable UI Sub-Components --- (Keep Logo, ProfileSection, NavLink as they are)
    // ... (Logo component definition) ...
     const Logo = ({ collapsed = false }) => (
        <Link
            to="/dashboard"
            className={`flex items-center text-theme-text flex-shrink-0 ${collapsed ? 'justify-center' : ''} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-theme-bg-secondary focus:ring-theme-accent rounded-md`}
            title="Dual N-Back Training Home"
        >
            {/* Echo Mark Logo */}
            <div className="h-9 w-9 flex-shrink-0 select-none">
                <svg width="36" height="36" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Echo/shadow square - the memory trace */}
                    <rect
                        x="44" y="44"
                        width="48" height="48"
                        rx="8"
                        fill="none"
                        stroke="#D4A855"
                        strokeWidth="3"
                        opacity="0.4"
                    />
                    {/* Primary square - the current moment */}
                    <rect
                        x="28" y="28"
                        width="48" height="48"
                        rx="8"
                        fill="#D4A855"
                    />
                </svg>
            </div>
            {/* Text Label (only when not collapsed) */}
            {!collapsed && (
                <span className="ml-3 font-bold text-lg whitespace-nowrap font-sans">Dual N-Back</span>
            )}
        </Link>
    );
    // ... (ProfileSection component definition) ...
     const ProfileSection = ({ collapsed = false }) => {
        const isSubPremium = ['active', 'trialing'].includes(userSubscriptionStatus);
        const isPremium = isSubPremium || coachGrantedPremium;

        // Get display name with fallback to email username, show only first name
        const fullName = userData?.displayName ||
                        authUser?.displayName ||
                        (authUser?.email ? authUser.email.split('@')[0] : 'User');
        const displayName = fullName.split(' ')[0]; // Only first name
        const initial = displayName.charAt(0).toUpperCase();

        return (
            // Only render if the user is authenticated
            authUser && (
                <div className={`px-3 py-3 border-t border-theme-border flex items-center ${collapsed ? 'justify-center' : ''} flex-shrink-0`}>
                     {/* Profile Avatar/Initial */}
                     <div className={`h-9 w-9 rounded-full flex items-center justify-center text-theme-bg shadow-sm flex-shrink-0 bg-theme-accent select-none`}>
                        <span className="font-medium">{initial}</span>
                    </div>
                    {/* Profile info (only when not collapsed) */}
                    {!collapsed && (
                        <div className="ml-3 overflow-hidden flex-1">
                            {/* Name row with Premium badge for subscribers */}
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-theme-text truncate flex items-center" title={displayName}>
                                    <span className="w-2 h-2 bg-status-success rounded-full mr-1.5 flex-shrink-0" aria-hidden="true"></span>
                                    {displayName}
                                </p>
                                {isPremium && (
                                    <span className="text-[0.6875rem] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 bg-theme-accent/20 text-theme-accent">
                                        {isSubPremium ? 'Premium' : 'Premium (Coach)'}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )
        );
    };
    // ... (NavLink component definition) ...
    const NavLink = ({ path, icon, label, collapsed = false }) => (
        <button
            onClick={() => handleLinkClick(path)}
            className={`flex items-center w-full text-left px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150 ease-in-out group focus:outline-none focus:ring-2 focus:ring-inset focus:ring-theme-accent ${
                isActive(path)
                    ? 'bg-theme-accent text-theme-bg font-semibold cursor-default' // Active state
                    : 'text-theme-text-secondary hover:bg-theme-bg-hover hover:text-theme-text' // Inactive state
            } ${collapsed ? 'justify-center' : ''}`}
            disabled={isActive(path)} // Prevent clicking if already on the page
            aria-current={isActive(path) ? 'page' : undefined} // Accessibility: current page
            title={collapsed ? label : undefined} // Show tooltip when collapsed
        >
            <FontAwesomeIcon icon={icon} className={`${collapsed ? '' : 'mr-3'} h-5 w-5 flex-shrink-0 ${isActive(path) ? 'text-theme-bg' : 'text-theme-text-muted group-hover:text-theme-text'} transition-colors duration-150 ease-in-out`} aria-hidden="true" />
            {!collapsed && <span className="whitespace-nowrap">{label}</span>}
        </button>
    );


    // --- Safe-area styles (status bar top, gesture/nav bar bottom) ---
    // Universal across Android (Capacitor 8 SystemBars), iOS PWA, and web — see
    // src/utils/safeArea.js. Fixed-position elements (mobile header, menu drawer,
    // floating button) are positioned relative to the viewport, so they need their
    // own insets in addition to the #root padding in index.css.
    const mobileHeaderStyle = {
        paddingTop: SAFE_AREA_TOP,
        minHeight: `calc(4rem + ${SAFE_AREA_TOP})`,
        boxSizing: 'border-box',
    };
    const mobileMenuStyle = { paddingTop: SAFE_AREA_TOP, paddingBottom: SAFE_AREA_BOTTOM };
    const noSidebarMainStyle = { paddingTop: SAFE_AREA_TOP, paddingBottom: SAFE_AREA_BOTTOM };

    // **** CALCULATE Experimental Link Visibility ****
    // Combines the new setting with the existing email check
    const showExperimentalFeaturesLink = settings?.enableExperimentalFeatures && authUser && authUser.email?.toLowerCase() === TARGET_EMAIL_FOR_EXPERIMENTAL.toLowerCase();

    // Insights is the sole stats surface (Apr 2026). Analytics + Charts pages
    // removed on web; Insights shown to all signed-in users.


    // --- Main Component Render ---

    // If sidebar should not be shown, handle safe area padding
    if (!shouldShowSidebar()) {
         // ... (no-sidebar return block remains the same) ...
          return (
            <div className="flex-1 flex flex-col min-h-screen bg-theme-bg overflow-y-auto">
                 <main
                    className="flex-1"
                    style={noSidebarMainStyle}
                >
                    <Outlet />
                 </main>
                 {authUser && <FeedbackButton baseBottomRem={isNative() && !['active', 'trialing'].includes(userSubscriptionStatus) && !coachGrantedPremium ? 5 : 1.25} />}
            </div>
        );
    }

    // Otherwise, render the full layout with Sidebar, Headers, etc.
    return (
        // Keep overflow-hidden on the outermost container
        <div className="flex h-screen bg-theme-bg"> {/* Main container */}

            {/* === Desktop Sidebar === */}
            <aside
                className={`hidden lg:flex flex-col bg-theme-bg-secondary border-r border-theme-border text-theme-text z-30 flex-shrink-0 transition-all duration-300 ease-in-out ${
                    isSidebarCollapsed ? 'w-16' : 'w-64'
                }`}
                aria-label="Main Navigation"
            >
                 {/* Sidebar Header */}
                 <div className={`flex items-center h-16 px-3 flex-shrink-0 ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
                    {!isSidebarCollapsed && <Logo collapsed={false} />}
                    <button
                        onClick={toggleSidebar}
                        className="text-theme-text-muted hover:text-theme-text p-2 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-theme-accent"
                        aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        <FontAwesomeIcon icon={isSidebarCollapsed ? faChevronRight : faChevronLeft} className="h-4 w-4"/>
                    </button>
                </div>
                {/* Main Flexible Content Area */}
                <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
                    {/* Navigation Section */}
                    <nav className="mt-4 px-2 space-y-1">
                         <NavLink path="/dashboard" icon={faHouse} label="Dashboard" collapsed={isSidebarCollapsed} />
                         {/* --- START: Conditional Experimental Link (Setting + Email Check) --- */}
                         {showExperimentalFeaturesLink && (
                             <NavLink path="/experimental" icon={faFlask} label="Experimental" collapsed={isSidebarCollapsed} />
                         )}
                         {/* --- END: Conditional Experimental Link --- */}
                         {/* Insights — sole stats surface (Apr 2026) */}
                         <NavLink path="/insights" icon={faLightbulb} label="Insights" collapsed={isSidebarCollapsed} />
                         {/* Program - with red dot for active cohort members + unread chat badge */}
                         <button
                             onClick={() => handleLinkClick('/program')}
                             className={`relative flex items-center w-full text-left px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150 ease-in-out group focus:outline-none focus:ring-2 focus:ring-inset focus:ring-theme-accent ${
                                 isActive('/program')
                                     ? 'bg-theme-accent text-theme-bg font-semibold cursor-default'
                                     : 'text-theme-text-secondary hover:bg-theme-bg-hover hover:text-theme-text'
                             } ${isSidebarCollapsed ? 'justify-center' : ''}`}
                             disabled={isActive('/program')}
                             title={isSidebarCollapsed ? "Program" : undefined}
                         >
                             <FontAwesomeIcon icon={faUsers} className={`${isSidebarCollapsed ? '' : 'mr-3'} h-5 w-5 flex-shrink-0 ${isActive('/program') ? 'text-theme-bg' : 'text-theme-text-muted group-hover:text-theme-text'} transition-colors duration-150 ease-in-out`} aria-hidden="true" />
                             {!isSidebarCollapsed && <span className="whitespace-nowrap">Program</span>}
                             {hasNewProgram && !isActive('/program') && (
                                 <span className={`relative flex-shrink-0 h-2 w-2 ${isSidebarCollapsed ? 'absolute top-0 right-0' : 'ml-auto'}`}>
                                     <span className="animate-ping absolute inset-0 rounded-full bg-theme-accent opacity-75"></span>
                                     <span className="absolute inset-0 rounded-full bg-theme-accent"></span>
                                 </span>
                             )}
                             {!hasNewProgram && unreadChatCount > 0 && !isActive('/program') && (
                                 <span
                                     className={`min-w-[1.25rem] h-5 flex items-center justify-center rounded-full bg-theme-accent text-theme-bg text-xs font-bold px-1 ${isSidebarCollapsed ? 'absolute -top-1 -right-1' : 'ml-auto'}`}
                                     aria-label={`${unreadChatCount} unread message${unreadChatCount !== 1 ? 's' : ''}`}
                                 >
                                     {unreadChatCount > 9 ? '9+' : unreadChatCount}
                                 </span>
                             )}
                         </button>
                         {/* Assessment */}
                         <button
                             onClick={() => handleLinkClick('/testing')}
                             className={`flex items-center w-full text-left px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150 ease-in-out group focus:outline-none focus:ring-2 focus:ring-inset focus:ring-theme-accent ${
                                 isActive('/testing')
                                     ? 'bg-theme-accent text-theme-bg font-semibold cursor-default'
                                     : 'text-theme-text-secondary hover:bg-theme-bg-hover hover:text-theme-text'
                             } ${isSidebarCollapsed ? 'justify-center' : ''}`}
                             disabled={isActive('/testing')}
                             title={isSidebarCollapsed ? "Assessment" : undefined}
                         >
                             <FontAwesomeIcon icon={faClipboardList} className={`${isSidebarCollapsed ? '' : 'mr-3'} h-5 w-5 flex-shrink-0 ${isActive('/testing') ? 'text-theme-bg' : 'text-theme-text-muted group-hover:text-theme-text'} transition-colors duration-150 ease-in-out`} aria-hidden="true" />
                             {!isSidebarCollapsed && <span className="whitespace-nowrap">Assessment</span>}
                             {hasNewAssessment && !isActive('/testing') && (
                                 <span className={`relative flex-shrink-0 h-2 w-2 ${isSidebarCollapsed ? 'absolute top-0 right-0' : 'ml-auto'}`}>
                                     <span className="animate-ping absolute inset-0 rounded-full bg-theme-accent opacity-75"></span>
                                     <span className="absolute inset-0 rounded-full bg-theme-accent"></span>
                                 </span>
                             )}
                         </button>
                         <NavLink path="/profiles" icon={faUsers} label="Perfis" collapsed={isSidebarCollapsed} />
                         <NavLink path="/settings" icon={faSliders} label="Settings" collapsed={isSidebarCollapsed} />
                    </nav>
                </div>
                {/* Daily-cap counter widget — ambient upsell for capped free cohorts */}
                <div className="flex-shrink-0">
                    <DailyCapCounterSidebar collapsed={isSidebarCollapsed} />
                </div>
                {/* Footer - What's New + Theme Toggle */}
                <div className="px-2 py-3 border-t border-theme-border flex-shrink-0">
                    <div className={`flex items-center ${isSidebarCollapsed ? 'flex-col gap-2' : 'justify-between'}`}>
                        {/* What's New */}
                        <button
                            onClick={() => handleLinkClick('/changelog')}
                            className={`flex items-center text-left px-3 py-1.5 rounded-md text-xs transition-colors duration-150 ease-in-out group focus:outline-none focus:ring-1 focus:ring-theme-accent/50 ${
                                isActive('/changelog')
                                    ? 'text-theme-accent cursor-default'
                                    : 'text-theme-text-muted hover:text-theme-text-secondary'
                            } ${isSidebarCollapsed ? 'justify-center' : ''}`}
                            disabled={isActive('/changelog')}
                            title={isSidebarCollapsed ? "What's New" : undefined}
                        >
                            <FontAwesomeIcon icon={faRocket} className={`${isSidebarCollapsed ? '' : 'mr-2'} h-3.5 w-3.5 flex-shrink-0 transition-colors duration-150 ease-in-out`} />
                            {!isSidebarCollapsed && <span className="whitespace-nowrap">What's New</span>}
                            {hasNewChangelog && !isActive('/changelog') && (
                                <span className={`relative flex-shrink-0 h-2 w-2 ${isSidebarCollapsed ? 'absolute top-0 right-0' : 'ml-2'}`}>
                                    <span className="animate-ping absolute inset-0 rounded-full bg-theme-accent opacity-75"></span>
                                    <span className="absolute inset-0 rounded-full bg-theme-accent"></span>
                                </span>
                            )}
                        </button>
                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className="text-theme-text-muted hover:text-theme-accent px-3 py-1.5 rounded-md transition-colors focus:outline-none focus:ring-1 focus:ring-theme-accent/50"
                            aria-label={themeTooltip}
                            title={themeTooltip}
                        >
                            <FontAwesomeIcon icon={themeIcon} className="h-3.5 w-3.5"/>
                        </button>
                    </div>
                </div>
            </aside>

            {/* === Content Area Wrapper (Includes Mobile Header) === */}
            {/* min-w-0 prevents intrinsic-wide children (e.g., 365-day calendar)
                from pushing this flex child past the viewport width. */}
            <div className="flex-1 flex flex-col relative min-h-0 min-w-0">

                {/* === Mobile Header Bar === */}
                <div
                    className={`lg:hidden bg-theme-bg-secondary border-b border-theme-border w-full flex items-center justify-between px-4 z-20 fixed top-0 left-0 right-0 h-16`} // KEEP h-16
                    style={mobileHeaderStyle} // Apply dynamic minHeight, paddingTop + boxSizing
                >
                     {/* Header Content (Logo, Buttons) should vertically center now */}
                     <Logo collapsed={true}/>
                     <div className="flex items-center space-x-1">
                          {/* Theme Toggle */}
                          <button
                              onClick={toggleTheme}
                              className="text-theme-text-muted hover:text-theme-accent p-2 focus:outline-none focus:ring-2 focus:ring-theme-accent rounded-md"
                              aria-label={themeTooltip}
                              title={themeTooltip}
                          >
                              <FontAwesomeIcon icon={themeIcon} className="h-5 w-5" />
                          </button>
                          {/* Menu Toggle */}
                          <button
                              onClick={toggleMobileMenu}
                              className="text-theme-text p-2 focus:outline-none focus:ring-2 focus:ring-theme-accent rounded-md"
                              aria-label="Open main menu"
                              aria-expanded={isMobileMenuOpen}
                              aria-controls="mobile-menu"
                          >
                              <FontAwesomeIcon icon={faBars} className="h-5 w-5" />
                          </button>
                      </div>
                  </div>

                {/* === Main Content Outlet === */}
                 <main
                    className={`flex-1 overflow-y-auto overflow-x-hidden bg-theme-bg p-4 sm:p-6 lg:p-8 lg:pt-8 pt-20 ios-touch-scroll`}
                >
                    <Outlet /> {/* Where child route components render */}
                </main>

            </div> {/* End Content Area Wrapper */}


            {/* === Mobile Menu Overlay === */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" id="mobile-menu">
                    <div className="fixed inset-0 bg-black bg-opacity-60 transition-opacity" aria-hidden="true" onClick={toggleMobileMenu}></div>
                    {/* APPLY INLINE STYLE TO OUTER CONTAINER */}
                    <div
                        className="fixed inset-y-0 left-0 max-w-xs w-full bg-theme-bg-secondary shadow-xl flex flex-col text-theme-text z-50"
                        style={mobileMenuStyle} // Apply dynamic paddingTop here to push the whole menu down
                    >
                        {/* Menu's own header */}
                        {/* ... (mobile menu header remains the same) ... */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-theme-border h-16 flex-shrink-0">
                            <Logo collapsed={false} />
                            <button onClick={toggleMobileMenu} className="text-theme-text-secondary hover:text-theme-text p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-accent" aria-label="Close menu">
                                <FontAwesomeIcon icon={faTimes} className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Inner scrollable content */}
                        <div
                            className="flex-1 mt-4 overflow-y-auto"
                        >
                            {/* Navigation items */}
                            <nav className="px-2 py-4 space-y-1">
                                <NavLink path="/dashboard" icon={faHouse} label="Dashboard" collapsed={false} />
                                {showExperimentalFeaturesLink && (
                                    <NavLink path="/experimental" icon={faFlask} label="Experimental" collapsed={false} />
                                )}
                                {/* Insights — sole stats surface (Apr 2026) */}
                                <NavLink path="/insights" icon={faLightbulb} label="Insights" collapsed={false} />
                                {/* Program - with red dot for active cohort members + unread chat badge */}
                                <button
                                    onClick={() => handleLinkClick('/program')}
                                    className={`flex items-center w-full text-left px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150 ease-in-out group focus:outline-none focus:ring-2 focus:ring-inset focus:ring-theme-accent ${
                                        isActive('/program')
                                            ? 'bg-theme-accent text-theme-bg font-semibold cursor-default'
                                            : 'text-theme-text-secondary hover:bg-theme-bg-hover hover:text-theme-text'
                                    }`}
                                    disabled={isActive('/program')}
                                >
                                    <FontAwesomeIcon icon={faUsers} className={`mr-3 h-5 w-5 flex-shrink-0 ${isActive('/program') ? 'text-theme-bg' : 'text-theme-text-muted group-hover:text-theme-text'} transition-colors duration-150 ease-in-out`} aria-hidden="true" />
                                    <span className="whitespace-nowrap">Program</span>
                                    {hasNewProgram && !isActive('/program') && (
                                        <span className="relative flex-shrink-0 h-2 w-2 ml-auto">
                                            <span className="animate-ping absolute inset-0 rounded-full bg-theme-accent opacity-75"></span>
                                            <span className="absolute inset-0 rounded-full bg-theme-accent"></span>
                                        </span>
                                    )}
                                    {!hasNewProgram && unreadChatCount > 0 && !isActive('/program') && (
                                        <span
                                            className="ml-auto min-w-[1.25rem] h-5 flex items-center justify-center rounded-full bg-theme-accent text-theme-bg text-xs font-bold px-1"
                                            aria-label={`${unreadChatCount} unread message${unreadChatCount !== 1 ? 's' : ''}`}
                                        >
                                            {unreadChatCount > 9 ? '9+' : unreadChatCount}
                                        </span>
                                    )}
                                </button>
                                {/* Assessment */}
                                <button
                                    onClick={() => handleLinkClick('/testing')}
                                    className={`flex items-center w-full text-left px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150 ease-in-out group focus:outline-none focus:ring-2 focus:ring-inset focus:ring-theme-accent ${
                                        isActive('/testing')
                                            ? 'bg-theme-accent text-theme-bg font-semibold cursor-default'
                                            : 'text-theme-text-secondary hover:bg-theme-bg-hover hover:text-theme-text'
                                    }`}
                                    disabled={isActive('/testing')}
                                >
                                    <FontAwesomeIcon icon={faClipboardList} className={`mr-3 h-5 w-5 flex-shrink-0 ${isActive('/testing') ? 'text-theme-bg' : 'text-theme-text-muted group-hover:text-theme-text'} transition-colors duration-150 ease-in-out`} aria-hidden="true" />
                                    <span className="whitespace-nowrap">Assessment</span>
                                    {hasNewAssessment && !isActive('/testing') && (
                                        <span className="relative flex-shrink-0 h-2 w-2 ml-auto">
                                            <span className="animate-ping absolute inset-0 rounded-full bg-theme-accent opacity-75"></span>
                                            <span className="absolute inset-0 rounded-full bg-theme-accent"></span>
                                        </span>
                                    )}
                                </button>
                                <NavLink path="/settings" icon={faSliders} label="Settings" collapsed={false} />
                            </nav>
                        </div>

                        {/* Daily-cap counter widget — ambient upsell for capped free cohorts */}
                        <div className="flex-shrink-0">
                            <DailyCapCounterSidebar collapsed={false} />
                        </div>

                        {/* What's New - at very bottom */}
                        <div className="px-2 py-3 border-t border-theme-border space-y-1">
                            <button
                                onClick={() => handleLinkClick('/changelog')}
                                className={`flex items-center w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors duration-150 ease-in-out group focus:outline-none focus:ring-1 focus:ring-theme-accent/50 ${
                                    isActive('/changelog')
                                        ? 'text-theme-accent cursor-default'
                                        : 'text-theme-text-muted hover:text-theme-text-secondary'
                                }`}
                                disabled={isActive('/changelog')}
                            >
                                <FontAwesomeIcon icon={faRocket} className="mr-2 h-3.5 w-3.5 flex-shrink-0 transition-colors duration-150 ease-in-out" />
                                <span className="whitespace-nowrap">What's New</span>
                                {hasNewChangelog && !isActive('/changelog') && (
                                    <span className="relative flex-shrink-0 h-2 w-2 ml-auto">
                                        <span className="animate-ping absolute inset-0 rounded-full bg-theme-accent opacity-75"></span>
                                        <span className="absolute inset-0 rounded-full bg-theme-accent"></span>
                                    </span>
                                )}
                            </button>
                        </div>
                         {/* Removed: Sign Out button (moved to Settings page) */}
                    </div>
                </div>
            )}

            {/* === Floating Feedback Button === */}
            {authUser && <FeedbackButton baseBottomRem={isNative() && !['active', 'trialing'].includes(userSubscriptionStatus) && !coachGrantedPremium ? 5 : 1.25} />}

            {/* === ProTrialUpgradeModal (layout-level mount) ===
                State lives in UserContext; setters are called from many places
                (dashboard fallback, re-engagement, sidebar counter widget, daily-cap
                modal CTA, etc.). Modal portals to document.body so mount location
                is purely for state-binding. GameResults and ChartPaywallBlock have
                their own mounts and are unaffected by this one. */}
            <ProTrialUpgradeModal
                isOpen={!!showProTrialUpgradeModal}
                onClose={handleProTrialModalClose}
                trigger={proTrialUpgradeModalTrigger || 'game_1'}
            />

        </div> // End main container div
    );
};

export default SidebarLayout;