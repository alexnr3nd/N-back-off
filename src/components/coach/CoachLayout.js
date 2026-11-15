/* src/components/coach/CoachLayout.js */
import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faHome,
    faGear,
    faBars,
    faTimes,
    faChevronLeft,
    faChevronRight,
    faBrain,
} from '@fortawesome/free-solid-svg-icons';

const navItems = [
    { path: '/coach/dashboard', label: 'Dashboard', icon: faHome },
    { path: '/coach/settings', label: 'Settings', icon: faGear },
];

const CoachLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);

    return (
        <div className="min-h-screen bg-theme-bg flex">
            {/* Mobile overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed lg:sticky top-0 left-0 h-screen z-50
                bg-theme-bg-secondary border-r border-theme-line
                transition-all duration-200 flex flex-col
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                ${isSidebarCollapsed ? 'w-16' : 'w-56'}
            `}>
                {/* Header */}
                <div className="h-14 border-b border-theme-line flex items-center px-4 gap-3 flex-shrink-0">
                    {!isSidebarCollapsed && (
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 bg-theme-accent/20 border border-theme-accent/40 flex items-center justify-center flex-shrink-0">
                                <FontAwesomeIcon icon={faBrain} className="w-3.5 h-3.5 text-theme-accent" />
                            </div>
                            <span className="text-sm font-mono font-medium text-theme-text truncate">
                                Coach Portal
                            </span>
                        </div>
                    )}
                    {/* Collapse button - desktop only */}
                    <button
                        onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
                        className="hidden lg:flex ml-auto items-center justify-center w-6 h-6 text-theme-text-muted hover:text-theme-text transition-colors"
                    >
                        <FontAwesomeIcon icon={isSidebarCollapsed ? faChevronRight : faChevronLeft} className="w-3 h-3" />
                    </button>
                    {/* Close button - mobile only */}
                    <button
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="lg:hidden ml-auto text-theme-text-muted hover:text-theme-text"
                    >
                        <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-2 overflow-y-auto">
                    {navItems.map(({ path, label, icon }) => {
                        const isActive = location.pathname === path || location.pathname.startsWith(path + '/');
                        return (
                            <Link
                                key={path}
                                to={path}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`
                                    flex items-center gap-3 mx-2 px-3 py-2.5 rounded-sm text-sm font-mono transition-colors
                                    ${isActive
                                        ? 'bg-theme-accent/10 text-theme-accent border-l-2 border-theme-accent'
                                        : 'text-theme-text-secondary hover:text-theme-text hover:bg-theme-bg-elevated border-l-2 border-transparent'
                                    }
                                `}
                                title={isSidebarCollapsed ? label : undefined}
                            >
                                <FontAwesomeIcon icon={icon} className="w-4 h-4 flex-shrink-0" />
                                {!isSidebarCollapsed && <span>{label}</span>}
                            </Link>
                        );
                    })}
                </nav>

                {/* Footer - Switch to training */}
                <div className="border-t border-theme-line p-2 flex-shrink-0">
                    <Link
                        to="/dashboard"
                        className="flex items-center gap-3 px-3 py-2.5 text-sm font-mono text-theme-text-muted hover:text-theme-accent transition-colors"
                        title={isSidebarCollapsed ? 'My Training' : undefined}
                    >
                        <FontAwesomeIcon icon={faBrain} className="w-4 h-4 flex-shrink-0" />
                        {!isSidebarCollapsed && <span>My Training</span>}
                    </Link>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 min-w-0">
                {/* Mobile header */}
                <div className="lg:hidden h-14 border-b border-theme-line flex items-center px-4 bg-theme-bg-secondary">
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="text-theme-text-muted hover:text-theme-text mr-3"
                    >
                        <FontAwesomeIcon icon={faBars} className="w-5 h-5" />
                    </button>
                    <span className="text-sm font-mono font-medium text-theme-text">Coach Portal</span>
                </div>

                {/* Page content */}
                <div className="p-4 sm:p-6 lg:p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default CoachLayout;
