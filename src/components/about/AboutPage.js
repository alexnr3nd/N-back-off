import React from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faBrain } from '@fortawesome/free-solid-svg-icons';
import { useUser } from '../../contexts/UserContext';
import AboutContent from './AboutContent';

const AboutPage = () => {
    const { authUser } = useUser();
    const isAuthed = !!authUser;

    return (
        <div className="min-h-screen bg-theme-bg lab-grid">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
                {/* Header */}
                <header className="mb-8">
                    {isAuthed ? (
                        <Link
                            to="/settings?section=about"
                            className="inline-flex items-center text-theme-text-muted hover:text-theme-text text-sm font-mono transition-colors mb-4"
                        >
                            <FontAwesomeIcon icon={faArrowLeft} className="mr-2 h-3 w-3" />
                            Back to Settings
                        </Link>
                    ) : (
                        <a
                            href="https://dualnback.com"
                            className="inline-flex items-center text-theme-text-muted hover:text-theme-text text-sm font-mono transition-colors mb-4"
                        >
                            <FontAwesomeIcon icon={faArrowLeft} className="mr-2 h-3 w-3" />
                            Back to Home
                        </a>
                    )}
                    <div className="flex items-center">
                        <FontAwesomeIcon icon={faBrain} className="text-theme-accent mr-3 h-6 w-6" />
                        <h1 className="text-2xl font-serif text-theme-text">About Dual N-Back</h1>
                    </div>
                </header>

                <AboutContent />
            </div>
        </div>
    );
};

export default AboutPage;
