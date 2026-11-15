// src/components/ui/PublicFooter.js
import React from 'react';
import { Link } from 'react-router-dom';
import { trackEvent } from '../../utils/analyticsTracker';

const PublicFooter = () => {
    const salesSiteUrl = 'https://dualnback.com';

    return (
        <footer className="bg-theme-bg border-t border-theme-line pt-16 pb-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Footer Main Content */}
                <div className="grid md:grid-cols-4 gap-8 mb-12">
                    {/* Column 1: Logo and Info (spans 2 cols on desktop) */}
                    <div className="col-span-1 md:col-span-2">
                        <div className="flex items-center mb-4">
                            <svg className="h-10 w-10 mr-2" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="44" y="44" width="48" height="48" rx="8" fill="none" stroke="#E4B85C" strokeWidth="3" opacity="0.4" />
                                <rect x="28" y="28" width="48" height="48" rx="8" fill="#E4B85C" />
                            </svg>
                            <span className="font-tomorrow font-bold text-xl text-theme-text">Dual N-Back</span>
                        </div>
                        <p className="text-theme-text-secondary text-sm mb-4 max-w-md">
                            Science-backed brain training with adaptive difficulty and d'-prime analytics. Free to start, train unlimited sessions for free.
                        </p>
                    </div>

                    {/* Column 2: Features */}
                    <div className="col-span-1">
                        <h3 className="font-semibold text-theme-text mb-4">Features</h3>
                        <ul className="space-y-2">
                            <li>
                                <a href={`${salesSiteUrl}/#features`} className="text-theme-text-secondary hover:text-theme-accent transition-colors" rel="noreferrer noopener">Micro-Level Progression</a>
                            </li>
                            <li>
                                <a href={`${salesSiteUrl}/#analytics`} className="text-theme-text-secondary hover:text-theme-accent transition-colors" rel="noreferrer noopener">d'-Prime Analytics</a>
                            </li>
                            <li>
                                <a href={`${salesSiteUrl}/#wmc-assessment`} className="text-theme-text-secondary hover:text-theme-accent transition-colors" rel="noreferrer noopener">WMC Assessment</a>
                            </li>
                        </ul>
                    </div>

                    {/* Column 3: Resources */}
                    <div className="col-span-1">
                        <h3 className="font-semibold text-theme-text mb-4">Resources</h3>
                        <ul className="space-y-2">
                            <li>
                                <a href={`${salesSiteUrl}/articles/`} className="text-theme-text-secondary hover:text-theme-accent transition-colors" rel="noreferrer noopener">Articles</a>
                            </li>
                            <li>
                                <a href={`${salesSiteUrl}/researchers/`} className="text-theme-text-secondary hover:text-theme-accent transition-colors" rel="noreferrer noopener">For Researchers</a>
                            </li>
                            <li>
                                <a href={`${salesSiteUrl}/coaches/`} className="text-theme-text-secondary hover:text-theme-accent transition-colors" rel="noreferrer noopener">For Coaches</a>
                            </li>
                            <li>
                                <a href={`${salesSiteUrl}/contact.html`} className="text-theme-text-secondary hover:text-theme-accent transition-colors" rel="noreferrer noopener">Contact Us</a>
                            </li>
                            <li>
                                <a href="https://discord.gg/yC48K6qM4s" className="text-theme-text-secondary hover:text-theme-accent transition-colors" target="_blank" rel="noopener noreferrer">Discord Community</a>
                            </li>
                            <li>
                                <a href="https://www.reddit.com/r/DualnBack/" className="text-theme-text-secondary hover:text-theme-accent transition-colors" target="_blank" rel="noopener noreferrer">Reddit Community</a>
                            </li>
                        </ul>

                        <h3 className="font-semibold text-theme-text mb-4 mt-6">Legal</h3>
                        <ul className="space-y-2">
                            <li>
                                <a href={`${salesSiteUrl}/terms`} className="text-theme-text-secondary hover:text-theme-accent transition-colors" rel="noreferrer noopener">Terms of Service</a>
                            </li>
                            <li>
                                <a href={`${salesSiteUrl}/privacy`} className="text-theme-text-secondary hover:text-theme-accent transition-colors" rel="noreferrer noopener">Privacy Policy</a>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Footer Bottom with Copyright */}
                <div className="pt-8 border-t border-theme-line flex flex-col md:flex-row justify-between items-center">
                    <p className="text-theme-text-muted text-sm">© {new Date().getFullYear()} Dual N-Back, LLC. All rights reserved.</p>
                    <div className="mt-4 md:mt-0 flex space-x-6">
                        <a href={salesSiteUrl} className="text-theme-text-secondary hover:text-theme-accent text-sm transition-colors" rel="noreferrer noopener">Home</a>
                        <a href={`${salesSiteUrl}/contact.html`} className="text-theme-text-secondary hover:text-theme-accent text-sm transition-colors" rel="noreferrer noopener">Contact</a>
                        <Link
                            to="/signup"
                            onClick={() => trackEvent('signup_cta_click', { cta_location: 'footer' })}
                            className="text-theme-text-secondary hover:text-theme-accent text-sm transition-colors"
                        >Sign Up</Link>
                        <Link to="/login" className="text-theme-text-secondary hover:text-theme-accent text-sm transition-colors">Login</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default PublicFooter;
