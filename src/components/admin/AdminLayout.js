/* src/components/admin/AdminLayout.js */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../../firebaseConfig';
import { useUser } from '../../contexts/UserContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSignOutAlt,
    faUserShield,
    faHome,
    faUsers,
    faUserGroup,
    faCommentDots,
    faEnvelope,
    faBars,
    faTimes,
    faChevronLeft,
    faChevronRight,
    faFlask,
    faUserTie,
    faClipboardCheck
} from '@fortawesome/free-solid-svg-icons';
import AdminButton from './ui/AdminButton';

const FEEDBACK_LAST_VIEWED_KEY = 'admin_feedback_last_viewed';

// Navigation items for admin sidebar
const navItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: faHome },
    { path: '/admin/users', label: 'Users', icon: faUsers },
    { path: '/admin/feedback', label: 'Feedback', icon: faCommentDots },
    { path: '/admin/emails', label: 'Emails', icon: faEnvelope },
    { path: '/admin/cohorts', label: 'Cohorts', icon: faUserGroup },
    { path: '/admin/assessments', label: 'Assessments', icon: faClipboardCheck },
    { path: '/admin/coaches', label: 'Coaches', icon: faUserTie },
    { path: '/admin/cohort', label: 'Content', icon: faFlask },
];

const AdminLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { authUser } = useUser();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [newestFeedbackAt, setNewestFeedbackAt] = useState(null);
    const [unreadRepliesCount, setUnreadRepliesCount] = useState(0);

    // Check for new feedback and unread replies on mount, when navigating, and poll every 30 seconds
    useEffect(() => {
        const checkFeedbackStatus = async () => {
            try {
                const fn = httpsCallable(functions, 'adminGetOverviewMetrics');
                const result = await fn({});
                if (result.data.success && result.data.metrics.feedback) {
                    const feedback = result.data.metrics.feedback;
                    setNewestFeedbackAt(feedback.newestAt);
                    setUnreadRepliesCount(feedback.unreadReplies || 0);
                }
            } catch (err) {
                // Silently fail - indicator just won't show
                console.error('[AdminLayout] Error checking feedback:', err);
            }
        };
        checkFeedbackStatus();

        // Poll for new feedback every 30 seconds
        const interval = setInterval(checkFeedbackStatus, 30000);
        return () => clearInterval(interval);
    }, [location.pathname]); // Re-check when navigating between admin pages

    // Determine if there's new feedback since last visit
    // Include location.pathname so it recalculates after visiting feedback page
    const hasNewFeedback = useMemo(() => {
        if (!newestFeedbackAt) return false;
        const lastViewed = localStorage.getItem(FEEDBACK_LAST_VIEWED_KEY);
        if (!lastViewed) return true; // Never viewed = show indicator
        return new Date(newestFeedbackAt) > new Date(lastViewed);
    }, [newestFeedbackAt, location.pathname]);

    // Show indicator if there's new feedback OR unread user replies
    const hasFeedbackAttention = hasNewFeedback || unreadRepliesCount > 0;

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/', { replace: true });
        } catch (error) {
            console.error('[AdminLayout] Error logging out:', error);
        }
    };

    const isActive = useCallback((path) => {
        if (path === '/admin/dashboard' && location.pathname === '/admin') return true;
        return location.pathname === path || location.pathname.startsWith(path + '/');
    }, [location.pathname]);

    const handleLinkClick = useCallback((path) => {
        navigate(path);
        setIsMobileMenuOpen(false);
    }, [navigate]);

    const toggleMobileMenu = useCallback(() => {
        setIsMobileMenuOpen(prev => !prev);
    }, []);

    const toggleSidebar = useCallback(() => {
        setSidebarCollapsed(prev => !prev);
    }, []);

    // Sidebar width classes
    const sidebarWidth = isSidebarCollapsed ? 'w-16' : 'w-56';
    const mainMargin = isSidebarCollapsed ? 'md:ml-16' : 'md:ml-56';

    return (
        <div className="flex min-h-screen bg-theme-bg overflow-x-hidden">
            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-30 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed top-0 left-0 h-full bg-theme-bg-secondary border-r border-theme-border text-theme-text z-40
                transform transition-all duration-300 ease-in-out
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
                md:translate-x-0 ${sidebarWidth}
            `}>
                {/* Sidebar Header */}
                <div className="flex items-center justify-between h-16 px-4 border-b border-theme-border">
                    <div className="flex items-center">
                        <div className="w-7 h-7 bg-theme-accent/20 border border-theme-accent/40 flex items-center justify-center flex-shrink-0">
                            <FontAwesomeIcon icon={faUserShield} className="w-3.5 h-3.5 text-theme-accent" />
                        </div>
                        {!isSidebarCollapsed && (
                            <span className="ml-3 text-sm font-mono font-medium uppercase tracking-wider text-theme-text">Admin</span>
                        )}
                    </div>
                    {/* Mobile close button */}
                    <button
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="md:hidden text-theme-text-muted hover:text-theme-text"
                    >
                        <FontAwesomeIcon icon={faTimes} className="h-5 w-5" />
                    </button>
                </div>

                {/* Navigation Links */}
                <nav className="mt-4 px-2">
                    {navItems.map((item) => {
                        const active = isActive(item.path);
                        return (
                        <button
                            key={item.path}
                            onClick={() => handleLinkClick(item.path)}
                            className={`
                                group w-full flex items-center px-3 py-2.5 mb-1 rounded-lab text-sm font-medium
                                transition-colors duration-150 text-left relative
                                ${active
                                    ? 'bg-theme-accent text-theme-bg font-semibold'
                                    : 'text-theme-text-secondary hover:bg-theme-bg-elevated hover:text-theme-text'
                                }
                            `}
                        >
                            <FontAwesomeIcon
                                icon={item.icon}
                                className={`h-5 w-5 ${isSidebarCollapsed ? 'mx-auto' : ''} ${active ? 'text-theme-bg' : 'text-theme-text-muted group-hover:text-theme-text'}`}
                            />
                            {!isSidebarCollapsed && (
                                <span className="ml-3 font-medium">{item.label}</span>
                            )}
                            {/* Feedback attention indicator (new feedback or unread replies) */}
                            {item.path === '/admin/feedback' && hasFeedbackAttention && (
                                unreadRepliesCount > 0 ? (
                                    // Show count badge for unread replies
                                    <span className={`flex-shrink-0 flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-mono font-bold rounded-lab ${active ? 'bg-theme-bg text-theme-accent' : 'bg-theme-accent text-theme-bg'} ${isSidebarCollapsed ? 'absolute top-0 right-0' : 'ml-auto'}`}>
                                        {unreadRepliesCount}
                                    </span>
                                ) : (
                                    // Pulsing dot for new feedback
                                    <span className={`relative flex-shrink-0 h-2.5 w-2.5 ${isSidebarCollapsed ? 'absolute top-1 right-1' : 'ml-auto'}`}>
                                        <span className={`animate-ping absolute inset-0 rounded-full opacity-75 ${active ? 'bg-theme-bg' : 'bg-theme-accent'}`}></span>
                                        <span className={`absolute inset-0 rounded-full ${active ? 'bg-theme-bg' : 'bg-theme-accent'}`}></span>
                                    </span>
                                )
                            )}
                        </button>
                        );
                    })}
                </nav>

                {/* Collapse Toggle (Desktop only) */}
                <button
                    onClick={toggleSidebar}
                    className="hidden md:flex absolute bottom-20 left-0 right-0 mx-auto w-8 h-8 items-center justify-center text-theme-text-muted hover:text-theme-text hover:bg-theme-bg-elevated rounded-lab"
                >
                    <FontAwesomeIcon
                        icon={isSidebarCollapsed ? faChevronRight : faChevronLeft}
                        className="h-4 w-4"
                    />
                </button>

                {/* User Info & Logout (at bottom of sidebar) */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-theme-border">
                    {!isSidebarCollapsed && authUser && (
                        <p className="text-[0.6875rem] font-mono text-theme-text-muted truncate mb-2">
                            {authUser.email}
                        </p>
                    )}
                    <AdminButton
                        variant="secondary"
                        size="sm"
                        icon={faSignOutAlt}
                        onClick={handleLogout}
                        className="w-full"
                    >
                        {!isSidebarCollapsed && 'Logout'}
                    </AdminButton>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className={`flex-1 flex flex-col min-w-0 overflow-x-hidden ${mainMargin} transition-all duration-300`}>
                {/* Mobile Header */}
                <header className="md:hidden bg-theme-bg-secondary border-b border-theme-border text-theme-text h-14 flex items-center px-4 sticky top-0 z-20">
                    <button
                        onClick={toggleMobileMenu}
                        className="text-theme-text-secondary hover:text-theme-text mr-4"
                    >
                        <FontAwesomeIcon icon={faBars} className="h-5 w-5" />
                    </button>
                    <FontAwesomeIcon icon={faUserShield} className="h-5 w-5 text-theme-accent" />
                    <span className="ml-2 text-sm font-mono font-medium uppercase tracking-wider">Admin Panel</span>
                </header>

                {/* Page Content.
                    The lab grid sits on an absolutely-positioned backdrop layer rather than
                    on <main> itself: .lab-grid sets `isolation: isolate`, which would make
                    <main> a stacking context and clamp the admin pages' `fixed ... z-50`
                    modal overlays beneath the z-40 sidebar. */}
                <main className="relative flex-grow p-4 md:p-6 lg:p-8">
                    <div className="absolute inset-0 lab-grid pointer-events-none" aria-hidden="true" />
                    <div className="relative">
                        <Outlet />
                    </div>
                </main>

                {/* Footer */}
                <footer className="border-t border-theme-line bg-theme-bg-secondary text-theme-text-muted text-center text-[0.6875rem] font-mono uppercase tracking-[0.2em] py-3">
                    Dual N-Back Admin Panel
                </footer>
            </div>
        </div>
    );
};

export default AdminLayout;
