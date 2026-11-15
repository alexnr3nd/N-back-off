// src/components/ui/PublicReplayHeader.js
import React from 'react';
import { Link } from 'react-router-dom';

const PublicReplayHeader = () => {
    const loginPath = '/login';
    const signupPath = '/signup';
    const salesSiteUrl = 'https://dualnback.com';

    return (
        <header className="bg-theme-bg-secondary border-b border-theme-line sticky top-0 z-50 w-full">
            <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex items-center">
                        {/* Logo */}
                        <a href={salesSiteUrl} className="flex items-center group" title="Home" rel="noreferrer noopener">
                            <svg className="h-10 w-10 mr-2" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="44" y="44" width="48" height="48" rx="8" fill="none" stroke="#E4B85C" strokeWidth="3" opacity="0.4" />
                                <rect x="28" y="28" width="48" height="48" rx="8" fill="#E4B85C" />
                            </svg>
                            <span className="font-tomorrow font-bold text-xl text-theme-text">Dual N-Back</span>
                        </a>
                    </div>

                    <div className="flex items-center space-x-2 sm:space-x-4">
                        {/* Login Button */}
                        <Link
                            to={loginPath}
                            className="hidden sm:inline-flex items-center px-4 py-2 border border-theme-line text-theme-text-secondary text-sm font-medium rounded-lab hover:border-theme-accent hover:text-theme-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-charcoal-surface focus:ring-theme-accent transition"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                            </svg>
                            Login
                        </Link>

                        {/* Start Free CTA Button */}
                        <Link
                            to={signupPath}
                            className="inline-flex items-center whitespace-nowrap px-4 py-2 bg-theme-accent text-theme-bg text-sm font-semibold rounded-lab shadow-lab hover:bg-amber-highlight hover:shadow-amber-glow focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-charcoal-surface focus:ring-theme-accent transition-all duration-200"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span>Start Free</span>
                        </Link>
                    </div>
                </div>
            </nav>
        </header>
    );
};

export default PublicReplayHeader;
