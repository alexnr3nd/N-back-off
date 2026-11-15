/* src/App.js */
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
    // Import routing creation/provider components
    createBrowserRouter,
    RouterProvider,
    Navigate,
    useNavigate,
    useLocation, // *** Import useLocation ***
    Outlet
} from 'react-router-dom';


// --- Context Providers ---
import { UserProvider, useUser } from './contexts/UserContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { ColorPreferencesProvider } from './contexts/ColorPreferencesContext';
import { GameProvider, GameContext } from './contexts/GameContext';
import { LoadingProvider, useLoading as useLoadingContextHook } from './contexts/LoadingContext';
import { PresenceProvider } from './contexts/PresenceContext';
import { FatigueDetectionProvider } from './contexts/FatigueDetectionContext';
import { VersionCheckProvider } from './contexts/VersionCheckContext';
import { CohortProvider } from './contexts/CohortContext';
import { CoachProvider } from './contexts/CoachContext';
import { NetworkStatusProvider } from './contexts/NetworkStatusContext';
import { OfflineSaveProvider } from './contexts/OfflineSaveContext';


// --- UI Components ---
import SidebarLayout from './components/ui/SidebarLayout';
import LoadingSpinner from './components/ui/LoadingSpinner';
import OfflineBanner from './components/ui/OfflineBanner';
import CookieConsentBanner from './components/ui/CookieConsentBanner';
import { trackEvent } from './utils/analyticsTracker';
import { isNative } from './utils/platform';
import ErrorScreen from './components/ui/ErrorScreen';


// --- Screen/Page Components ---
import ProfileDashboard from './components/ProfileDashboard';

// =============================================================================
// DEBUG: Set this to a number (in ms) to artificially delay loading states
// Set to 0 or false for production. Try 3000 (3 seconds) for testing.
// =============================================================================
const DEBUG_LOADING_DELAY = 0;
// =============================================================================

// Hook to add artificial delay to loading states (for testing)
const useDebugDelay = (actualIsLoading) => {
    const [delayedLoading, setDelayedLoading] = useState(true);
    const loadingStarted = useRef(Date.now());

    useEffect(() => {
        if (!DEBUG_LOADING_DELAY) {
            setDelayedLoading(actualIsLoading);
            return;
        }

        if (actualIsLoading) {
            loadingStarted.current = Date.now();
            setDelayedLoading(true);
        } else {
            // When actual loading finishes, wait for minimum delay
            const elapsed = Date.now() - loadingStarted.current;
            const remaining = Math.max(0, DEBUG_LOADING_DELAY - elapsed);

            if (remaining > 0) {
                const timer = setTimeout(() => setDelayedLoading(false), remaining);
                return () => clearTimeout(timer);
            } else {
                setDelayedLoading(false);
            }
        }
    }, [actualIsLoading]);

    return delayedLoading;
};
import GameScreen from './components/GameScreen';
import ExperimentalPage from './components/experimental/ExperimentalPage';
import AudioNBackGamePage from './components/experimental/AudioNBackGamePage';
import PokerCardNBackGamePage from './components/experimental/pokerCardNBack/PokerCardNBackGamePage'; // <<<--- ADDED POKER GAME IMPORT
// ProtocolGuidePage removed - now a modal accessed from dashboard header
import LoginScreen from './components/auth/LoginScreen';
import SignupScreen from './components/auth/SignupScreen';
import PasswordReset from './components/auth/PasswordReset';
import PasswordActionHandler from './components/auth/PasswordActionHandler';
// Removed: ProfileSelectionScreen, WelcomeSetup, UsernameOnboardingScreen (multi-profile feature removed)
// Removed: AccountPage (merged into SettingsPage)
import SettingsPage from './components/settings/SettingsPage';
import LocalProfilesPage from './components/LocalProfilesPage';
import DeleteAccountPage from './components/account/DeleteAccountPage';
import AllSessionsPage from './components/sessions/AllSessionsPage'; // <<<--- ADDED IMPORT
import PositionNBackExactGamePage from './components/experimental/positionNBackExact/PositionNBackExactGamePage';
import ChangelogPage from './components/changelog/ChangelogPage';
import InsightsPage from './components/insights/InsightsPage';
import ProgramPage from './components/program/ProgramPage';
import AboutPage from './components/about/AboutPage';
import WelcomeBackPage from './components/welcomeBack/WelcomeBackPage';
// --- Import SubscribeScreen ---
import SubscribeScreen from './components/auth/SubscribeScreen';


// --- Testing Components ---
import TestingPage from './components/testing/TestingPage';
import CountingSpanSummaryPage from './components/testing/countingSpan/CountingSpanSummaryPage';
import CountingSpanTask from './components/testing/countingSpan/CountingSpanTask';
import CountingSpanInstructionsWrapper from './components/testing/countingSpan/CountingSpanInstructionsWrapper';
import OperationSpanSummaryPage from './components/testing/operationSpan/OperationSpanSummaryPage';
import OperationSpanTask from './components/testing/operationSpan/OperationSpanTask';
import OperationSpanInstructionsWrapper from './components/testing/operationSpan/OperationSpanInstructionsWrapper';
import DigitSpanSummaryPage from './components/testing/digitSpan/DigitSpanSummaryPage';
import DigitSpanTask from './components/testing/digitSpan/DigitSpanTask';
import DigitSpanInstructionsWrapper from './components/testing/digitSpan/DigitSpanInstructionsWrapper';
import SymmetrySpanSummaryPage from './components/testing/symmetrySpan/SymmetrySpanSummaryPage';
import SymmetrySpanTask from './components/testing/symmetrySpan/SymmetrySpanTask';
import SymmetrySpanInstructionsWrapper from './components/testing/symmetrySpan/SymmetrySpanInstructionsWrapper';
import VisualArraysSummaryPage from './components/testing/visualArrays/VisualArraysSummaryPage';
import VisualArraysTask from './components/testing/visualArrays/VisualArraysTask';
import VisualArraysInstructionsWrapper from './components/testing/visualArrays/VisualArraysInstructionsWrapper';
import FaceNameMemorySummaryPage from './components/testing/faceNameMemory/FaceNameMemorySummaryPage';
import FaceNameMemoryTask from './components/testing/faceNameMemory/FaceNameMemoryTask';
import FaceNameMemoryInstructionsWrapper from './components/testing/faceNameMemory/FaceNameMemoryInstructionsWrapper';
import AntisaccadeSummaryPage from './components/testing/antisaccade/AntisaccadeSummaryPage';
import AntisaccadeTask from './components/testing/antisaccade/AntisaccadeTask';
import AntisaccadeInstructionsWrapper from './components/testing/antisaccade/AntisaccadeInstructionsWrapper';
import AntisaccadeTrainerTask from './components/testing/antisaccade/trainer/AntisaccadeTrainerTask';
import DigitSpanTrainerTask from './components/testing/digitSpan/trainer/DigitSpanTrainerTask';
import OperationSpanTrainerTask from './components/testing/operationSpan/trainer/OperationSpanTrainerTask';
import FaceNameMemoryTrainerTask from './components/testing/faceNameMemory/trainer/FaceNameMemoryTrainerTask';
import CountingSpanTrainerTask from './components/testing/countingSpan/trainer/CountingSpanTrainerTask';
import RelationMonitoringSummaryPage from './components/testing/relationMonitoring/RelationMonitoringSummaryPage';
import RelationMonitoringTask from './components/testing/relationMonitoring/RelationMonitoringTask';
import RelationMonitoringInstructionsWrapper from './components/testing/relationMonitoring/RelationMonitoringInstructionsWrapper';
import LetterNumberComparisonSummaryPage from './components/testing/letterNumberComparison/LetterNumberComparisonSummaryPage';
import LetterNumberComparisonTask from './components/testing/letterNumberComparison/LetterNumberComparisonTask';
import LetterNumberComparisonInstructionsWrapper from './components/testing/letterNumberComparison/LetterNumberComparisonInstructionsWrapper';
import ReasoningCheckSummaryPage from './components/testing/icar16/ReasoningCheckSummaryPage';
import ReasoningCheckTask from './components/testing/icar16/ReasoningCheckTask';

// --- AuthGuard Component ---
import AuthGuard from './AuthGuard';


// --- Route Wrapper Components ---
import {
    ReplayViewerWrapper,
    PublicReplayViewerWrapper
} from './RouteWrappers';

// --- **** NEW: Import Admin Components **** ---
import AdminGuard from './components/admin/AdminGuard';
import AdminLayout from './components/admin/AdminLayout';
import AdminErrorBoundary from './components/admin/AdminErrorBoundary';
import AdminDashboard from './components/admin/AdminDashboard';
import UserListPage from './components/admin/users/UserListPage';
import UserDetailPage from './components/admin/users/UserDetailPage';
import FeedbackListPage from './components/admin/feedback/FeedbackListPage';
import EmailListPage from './components/admin/emails/EmailListPage';
import CohortContentPage from './components/admin/cohort/CohortContentPage';
import CohortListPage from './components/admin/cohort/CohortListPage';
import CohortDetailPage from './components/admin/cohort/CohortDetailPage';
import CoachListPage from './components/admin/coaches/CoachListPage';
import AssessmentListPage from './components/admin/assessments/AssessmentListPage';

// --- Coach Portal Components ---
import CoachGuard from './components/coach/CoachGuard';
import CoachLayout from './components/coach/CoachLayout';
import CoachDashboard from './components/coach/CoachDashboard';
import CoachClientDetail from './components/coach/CoachClientDetail';
import CoachSettings from './components/coach/CoachSettings';
import CoachSignup from './components/coach/CoachSignup';
import CoachInvitePage from './components/join/CoachInvitePage';

// --- Bridge Component (Connects useNavigate to GameContext) ---
// This component needs to be rendered INSIDE the RouterProvider context
// It allows GameContext actions to trigger navigation.
const NavigationProviderBridge = () => {
    const navigate = useNavigate(); // This hook requires Router context
    const gameContext = React.useContext(GameContext);
    const setNavigationHandler = gameContext?.setNavigationHandler;

    // Effect to pass the navigate function to the GameContext
    React.useEffect(() => {
        const capturedSetHandler = setNavigationHandler;
        // Ensure the handler function exists in the context
        if (capturedSetHandler && typeof capturedSetHandler === 'function') {
            capturedSetHandler(navigate); // Pass the navigate function
            // Cleanup function: Remove the handler when the component unmounts
            return () => {
                if (capturedSetHandler && typeof capturedSetHandler === 'function') {
                    capturedSetHandler(null); // Clear the handler reference
                }
            };
        }
    }, [setNavigationHandler, navigate]); // Re-run if handler or navigate changes

    return null; // This bridge component does not render any UI itself
};

// =====================================================
// === Helper Components for Routing Logic           ===
// =====================================================

// AuthWrapper: Protects public auth routes (e.g., /login) from already logged-in users.
const AuthWrapper = ({ children }) => {
    const { authUser, isLoading: actualLoading } = useUser();
    const isLoading = useDebugDelay(actualLoading);
    const location = useLocation();

    // Show a spinner if the context is still resolving the initial user state.
    if (isLoading) {
        return <LoadingSpinner message="Loading..." fullScreen theme="auto" />;
    }

    // During signup, keep SignupScreen mounted so initializeFreeUser can complete
    // before navigating away. SignupScreen handles its own redirect after initialization.
    const isNewSignup = sessionStorage.getItem('isNewSignup') === 'true';

    // After loading, if a user is found (and not mid-signup), redirect to the central loading page.
    if (authUser && !isNewSignup) {
        // Preserve ?redirect= param from invite flows (e.g., /login?redirect=/join/coach/CODE)
        const redirectParam = new URLSearchParams(location.search).get('redirect');
        if (redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')) {
            sessionStorage.setItem('pendingRedirect', redirectParam);
        }
        return <Navigate to="/loading" replace />;
    }

    // If not loading and no user (or mid-signup), render the login/signup page.
    return children;
};

// Central loading and redirection component (simplified - no profile selection)
const LoadingAndRedirect = () => {
    const { isLoading: actualLoading, isCoach, error, refreshUserData } = useUser();
    const isLoading = useDebugDelay(actualLoading);
    const navigate = useNavigate();

    // Check if this is a new signup to show consistent messaging
    const isNewSignup = sessionStorage.getItem('isNewSignup') === 'true';

    useEffect(() => {
        // When loading completes (without error), redirect to pending destination or dashboard
        if (!isLoading && !error) {
            const pendingRedirect = sessionStorage.getItem('pendingRedirect');
            if (pendingRedirect) {
                sessionStorage.removeItem('pendingRedirect');
                navigate(pendingRedirect, { replace: true });
            } else {
                const dest = isCoach ? "/coach/dashboard" : "/dashboard";
                navigate(dest, { replace: true });
            }
        }
    }, [isLoading, isCoach, error, navigate]);

    // Show error screen if loading completed with an error
    if (!isLoading && error) {
        return (
            <ErrorScreen
                type={error === 'NETWORK_ERROR' ? 'network' : 'server'}
                onRetry={refreshUserData}
            />
        );
    }

    // Show consistent message for new signups
    const message = isNewSignup ? "Setting up your training lab..." : "Loading...";
    return <LoadingSpinner message={message} fullScreen theme="auto" />;
};


// LoggedInGuard: Protects routes requiring login but not necessarily a subscription or active profile.
// Used for onboarding flows, profile selection, and now resubscription.
const LoggedInGuard = ({ children }) => {
    const { authUser, isAuthLoading: actualLoading } = useUser();
    const isAuthLoading = useDebugDelay(actualLoading);
    const location = useLocation();

    // Check if this is a new signup to show consistent messaging
    const isNewSignup = sessionStorage.getItem('isNewSignup') === 'true';

    // Display loading spinner while checking auth state
    if (isAuthLoading) {
        const message = isNewSignup ? "Setting up your training lab..." : "Loading...";
        return <LoadingSpinner message={message} fullScreen theme="auto" />;
    }

    // If auth check complete and no user, redirect to login
    if (!authUser) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // If user is logged in, render the protected route (children)
    return children;
};

// RootRedirect: Handles the root ("/") path, redirecting based on auth status.
const RootRedirect = () => {
    const { authUser, isLoading: actualLoading } = useUser();
    const isLoading = useDebugDelay(actualLoading);

    if (isLoading) {
        return <LoadingSpinner message="Loading..." fullScreen theme="auto" />;
    }

    // Simplified: logged in users go to dashboard, others go to login
    const targetPath = authUser ? "/dashboard" : "/login";
    return <Navigate to={targetPath} replace />;
};

// =====================================================
// === Auth Switching Components                     ===
// =====================================================
// These components allow using useNavigate within the route definitions
// to pass navigation functions down to the screen components.

const LoginSwitcher = () => {
    const navigate = useNavigate();
    const onSwitchToReset = useCallback(() => navigate('/reset-password', { replace: true }), [navigate]);
    return <LoginScreen onSwitchToReset={onSwitchToReset} />;
};

const SignupSwitcher = () => {
    const navigate = useNavigate();
    const onSwitchToLogin = useCallback(() => navigate('/login', { replace: true }), [navigate]);
    return <SignupScreen onSwitchToLogin={onSwitchToLogin} />;
};

const PasswordResetSwitcher = () => {
    const navigate = useNavigate();
    const onSwitchToLogin = useCallback(() => navigate('/login', { replace: true }), [navigate]);
    return <PasswordReset onSwitchToLogin={onSwitchToLogin} />;
};

// =====================================================
// === Main Application Layout Component             ===
// =====================================================
// This layout component wraps the main application routes.
// It ensures the NavigationProviderBridge is rendered within the router's context,
// allowing GameContext to use navigation.
const RouteTracker = () => {
    const location = useLocation();
    useEffect(() => {
        trackEvent('page_view', { page_path: location.pathname });
    }, [location.pathname]);
    return null;
};

const MainAppLayout = () => {
    return (
        <PresenceProvider>
            <RouteTracker />
            <NavigationProviderBridge />
            <Outlet />
        </PresenceProvider>
    );
};


// =====================================================
// === Router Definition using createBrowserRouter   ===
// =====================================================

// Define the application's routes using the object-based configuration
// required by createBrowserRouter.
const router = createBrowserRouter([
    // The top-level route uses MainAppLayout. All subsequent routes
    // will be rendered inside its <Outlet /> and have access to the bridge.
    {
        element: <MainAppLayout />,
        children: [
            // --- Publicly Accessible Routes ---
            // No authentication or guards needed for these.
            { path: "/share/replay/:sessionId", element: <PublicReplayViewerWrapper /> },
            { path: "/action", element: <PasswordActionHandler /> }, // Handles email verification, password reset links
            { path: "/about", element: <AboutPage /> },
            { path: "/welcome-back", element: <WelcomeBackPage /> }, // Landing for abandonment-email reason clicks

            // --- Authentication Routes ---
            // Wrapped by AuthWrapper to handle redirection if user is already logged in.
            { path: "/login", element: <AuthWrapper><LoginSwitcher /></AuthWrapper> },
            { path: "/signup", element: <AuthWrapper><SignupSwitcher /></AuthWrapper> },
            { path: "/reset-password", element: <AuthWrapper><PasswordResetSwitcher /></AuthWrapper> },

            // --- **** NEW: Post-Login Loading Route **** ---
            // This route is protected by LoggedInGuard to ensure a user exists,
            // and it handles the final redirect after all data is loaded.
            { path: "/loading", element: <LoggedInGuard><LoadingAndRedirect /></LoggedInGuard> },

            // --- Post-Signup / Resubscribe Routes ---
            // Removed: /welcome-setup, /onboarding/username (multi-profile feature removed)
            // Old routes redirect to dashboard for backward compatibility
            { path: "/welcome-setup", element: <Navigate to="/dashboard" replace /> },
            { path: "/onboarding/username", element: <Navigate to="/dashboard" replace /> },
            { path: "/profile-selection", element: <Navigate to="/dashboard" replace /> },
            // Subscribe route, protected by LoggedInGuard
            { path: "/subscribe", element: <LoggedInGuard><SubscribeScreen /></LoggedInGuard> },
            // Redirect old resubscribe route
            { path: "/resubscribe", element: <Navigate to="/subscribe" replace /> },


            // --- **** NEW: Protected Admin Routes **** ---
            {
                // Use AdminGuard to protect this section
                element: <AdminGuard />,
                children: [
                    {
                        // Use AdminLayout for consistent admin UI
                        element: <AdminLayout />,
                        errorElement: <AdminErrorBoundary />,
                        children: [
                            // Define routes within the admin panel
                            { path: "/admin/dashboard", element: <AdminDashboard /> },
                            { path: "/admin/users", element: <UserListPage /> },
                            { path: "/admin/users/:userId", element: <UserDetailPage /> },
                            { path: "/admin/feedback", element: <FeedbackListPage /> },
                            { path: "/admin/emails", element: <EmailListPage /> },
                            { path: "/admin/cohorts", element: <CohortListPage /> },
                            { path: "/admin/cohorts/:cohortId", element: <CohortDetailPage /> },
                            { path: "/admin/assessments", element: <AssessmentListPage /> },
                            { path: "/admin/coaches", element: <CoachListPage /> },
                            { path: "/admin/cohort", element: <CohortContentPage /> },
                            // Default route within /admin redirects to dashboard
                            { path: "/admin", element: <Navigate to="/admin/dashboard" replace /> },
                        ]
                    }
                ]
            }, // --- End Protected Admin Routes ---

            // --- Coach Signup (handles its own auth state — shows login/signup links if not authenticated) ---
            { path: "/coach/signup/:token", element: <CoachSignup /> },

            // --- Client-facing Coach Invite Page (public, no auth required) ---
            { path: "/join/coach/:inviteCode", element: <CoachInvitePage /> },

            // --- Protected Coach Routes ---
            {
                element: <CoachGuard />,
                children: [
                    {
                        element: <CoachLayout />,
                        children: [
                            { path: "/coach/dashboard", element: <CoachDashboard /> },
                            { path: "/coach/clients/:clientId", element: <CoachClientDetail /> },
                            { path: "/coach/settings", element: <CoachSettings /> },
                            { path: "/coach", element: <Navigate to="/coach/dashboard" replace /> },
                        ]
                    }
                ]
            }, // --- End Protected Coach Routes ---

            // --- Protected Routes (Main Application) ---
            // These routes are first checked by AuthGuard (login & subscription & active profile).
            {
                element: <AuthGuard />, // Acts as a layout, checks permissions
                // Children are rendered within AuthGuard's Outlet if checks pass
                children: [
                    // --- Routes WITH Sidebar ---
                    // These routes also use the SidebarLayout component.
                    {
                        element: <SidebarLayout />, // Provides the sidebar UI
                        // Children are rendered within SidebarLayout's Outlet
                        children: [
                            // Removed: /profile-selection (multi-profile feature removed)
                            // Account route now redirects to Settings (Account merged into Settings)
                            { path: "/account", element: <Navigate to="/settings" replace /> },
                            { path: "/settings", element: <SettingsPage /> },
                            { path: "/profiles", element: <LocalProfilesPage /> },
                            // Core App Features: Need login & active sub (checked by AuthGuard)
                            { path: "/dashboard", element: <ProfileDashboard /> },
                            // /analytics and /charts redirect to /insights (replaced Apr 2026)
                            { path: "/analytics", element: <Navigate to="/insights" replace /> },
                            { path: "/charts", element: <Navigate to="/insights" replace /> },
                            { path: "/insights", element: <InsightsPage /> },
                            { path: "/testing", element: <TestingPage /> },
                            { path: "/testing/counting-span", element: <CountingSpanSummaryPage /> },
                            { path: "/testing/counting-span/tutorial", element: <CountingSpanInstructionsWrapper /> },
                            { path: "/testing/operation-span", element: <OperationSpanSummaryPage /> },
                            { path: "/testing/operation-span/tutorial", element: <OperationSpanInstructionsWrapper /> },
                            // Reasoning Check (ICAR-16) — listed on the TestingPage assessments grid
                            { path: "/testing/reasoning", element: <ReasoningCheckSummaryPage /> },
                            { path: "/testing/reasoning/tutorial", element: <Navigate to="/testing/reasoning" replace /> },
                            // Digit Span — listed on the TestingPage assessments grid
                            { path: "/testing/digit-span", element: <DigitSpanSummaryPage /> },
                            { path: "/testing/digit-span/tutorial", element: <DigitSpanInstructionsWrapper /> },
                            // Symmetry Span — listed on the TestingPage assessments grid
                            { path: "/testing/symmetry-span", element: <SymmetrySpanSummaryPage /> },
                            { path: "/testing/symmetry-span/tutorial", element: <SymmetrySpanInstructionsWrapper /> },
                            // Visual Arrays — listed on the TestingPage assessments grid
                            { path: "/testing/visual-arrays", element: <VisualArraysSummaryPage /> },
                            { path: "/testing/visual-arrays/tutorial", element: <VisualArraysInstructionsWrapper /> },
                            // Face-Name Memory — soft-launch, URL-only (deliberately NOT on the TestingPage grid)
                            { path: "/testing/face-name-memory", element: <FaceNameMemorySummaryPage /> },
                            { path: "/testing/face-name-memory/tutorial", element: <FaceNameMemoryInstructionsWrapper /> },
                            // Antisaccade — listed on the TestingPage assessments grid
                            { path: "/testing/antisaccade", element: <AntisaccadeSummaryPage /> },
                            { path: "/testing/antisaccade/tutorial", element: <AntisaccadeInstructionsWrapper /> },
                            // Relation Monitoring — soft launch: URL-only, no TestingPage card yet
                            { path: "/testing/relation-monitoring", element: <RelationMonitoringSummaryPage /> },
                            { path: "/testing/relation-monitoring/tutorial", element: <RelationMonitoringInstructionsWrapper /> },
                            { path: "/testing/letter-number-comparison", element: <LetterNumberComparisonSummaryPage /> },
                            { path: "/testing/letter-number-comparison/tutorial", element: <LetterNumberComparisonInstructionsWrapper /> },
                            { path: "/sessions", element: <AllSessionsPage /> },
                            { path: "/changelog", element: <ChangelogPage /> },
                            { path: "/program", element: <ProgramPage /> },
                            { path: "/experimental", element: <ExperimentalPage /> },
                            // Redirect old /choose-plan to /subscribe
                            { path: "/choose-plan", element: <Navigate to="/subscribe" replace /> },
                            // Redirect old routes to dashboard (Protocol Guide is now a modal)
                            { path: "/protocol-guide", element: <Navigate to="/dashboard" replace /> },
                            { path: "/tutorial", element: <Navigate to="/dashboard" replace /> },
                            // Index Route: Default route within the sidebar layout (redirects to dashboard)
                            { index: true, element: <Navigate to="/dashboard" replace /> },
                        ]
                    }, // End SidebarLayout Group

                    // --- Routes WITHOUT Sidebar (Still protected by AuthGuard) ---
                    // These routes are protected by AuthGuard but don't have the sidebar UI.
                    // Unlinked web deletion path (Play data-deletion URL declaration; Settings
                    // only shows Delete Account inside the native apps)
                    { path: "/delete-account", element: <DeleteAccountPage /> },
                    { path: "/game", element: <GameScreen /> },
                    { path: "/experimental/audio-n-back", element: <AudioNBackGamePage /> },
                    { path: "/experimental/poker-card-n-back", element: <PokerCardNBackGamePage /> },
                    { path: "/experimental/position-n-back-exact", element: <PositionNBackExactGamePage /> },
                    { path: "/replay/:sessionId", element: <ReplayViewerWrapper /> }, // Private replays
                    { path: "/testing/counting-span/run", element: <CountingSpanTask /> },
                    { path: "/testing/operation-span/run", element: <OperationSpanTask /> },
                    { path: "/testing/digit-span/run", element: <DigitSpanTask /> },
                    { path: "/testing/symmetry-span/run", element: <SymmetrySpanTask /> },
                    { path: "/testing/visual-arrays/run", element: <VisualArraysTask /> },
                    { path: "/testing/face-name-memory/run", element: <FaceNameMemoryTask /> },
                    { path: "/testing/antisaccade/run", element: <AntisaccadeTask /> },
                    { path: "/testing/antisaccade/train", element: <AntisaccadeTrainerTask /> },
                    { path: "/testing/digit-span/train", element: <DigitSpanTrainerTask /> },
                    { path: "/testing/operation-span/train", element: <OperationSpanTrainerTask /> },
                    { path: "/testing/face-name-memory/train", element: <FaceNameMemoryTrainerTask /> },
                    { path: "/testing/counting-span/train", element: <CountingSpanTrainerTask /> },
                    { path: "/testing/relation-monitoring/run", element: <RelationMonitoringTask /> },
                    { path: "/testing/letter-number-comparison/run", element: <LetterNumberComparisonTask /> },
                    { path: "/testing/reasoning/run", element: <ReasoningCheckTask /> },

                ] // End AuthGuard Children
            }, // End AuthGuard Route

            // --- Root Fallback Redirect ---
            // Catches any path not matched above within the MainAppLayout.
            // Redirects based on authentication status.
            { path: "/", element: <RootRedirect /> }, // Explicitly handle root
            { path: "*", element: <RootRedirect /> }, // Catch-all redirects

        ] // End MainAppLayout Children
    } // End MainAppLayout Route Configuration
]);


// =====================================================
// === AppWrapper Component                          ===
// =====================================================
// Renders the RouterProvider with the application routes
const AppWrapper = () => {
    return <RouterProvider router={router} />;
};


// =====================================================
// === FINAL Root Component (Entry Point)            ===
// =====================================================
// Sets up the context providers and renders AppWrapper
const Root = () => {
    // One-time cleanup of legacy localStorage keys from pre-Firestore era.
    // These stored full profile/session data and may be consuming quota.
    useEffect(() => {
        ['dual-n-back-profiles', 'dual-n-back-active-profile', 'dual-n-back-settings'].forEach(key => {
            try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
        });
    }, []);

    return (
        <VersionCheckProvider>
            <NetworkStatusProvider>
                <OfflineBanner />
                {/* Cookie banner is a web construct — not shown inside the native
                    app (native consent handled via Privacy Policy + Play Data Safety;
                    analytics consent granted on native in capacitorInit.js). */}
                {!isNative() && <CookieConsentBanner />}
                <LoadingProvider>
                    <UserProvider>
                        <OfflineSaveProvider>
                            <SettingsProvider>
                                <ColorPreferencesProvider>
                                    <FatigueDetectionProvider>
                                        <GameProvider>
                                            <CohortProvider>
                                                <CoachProvider>
                                                    <AppWrapper />
                                                </CoachProvider>
                                            </CohortProvider>
                                        </GameProvider>
                                    </FatigueDetectionProvider>
                                </ColorPreferencesProvider>
                            </SettingsProvider>
                        </OfflineSaveProvider>
                    </UserProvider>
                </LoadingProvider>
            </NetworkStatusProvider>
        </VersionCheckProvider>
    );
};


// Export the Root component as the default export
export default Root;