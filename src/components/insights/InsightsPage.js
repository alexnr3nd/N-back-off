/* src/components/insights/InsightsPage.js */
/* Top-level Insights page. Each section owns its own sticky filter bar. */

import React from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faLightbulb } from '@fortawesome/free-solid-svg-icons';

import { useUser } from '../../contexts/UserContext';
import GrowthSection from './growth/GrowthSection';
import StrengthsSection from './strengths/StrengthsSection';
import ConsistencySection from './consistency/ConsistencySection';
import { useInsightsFilters } from './hooks/useInsightsFilters';
import { useInsightsData } from './hooks/useInsightsData';

const InsightsPage = () => {
    // isFullAdaptive covers paid (incl. lifetime + coach-granted) AND active-grandfathered users.
    const { isFullAdaptive } = useUser();
    const isFreeTier = !isFullAdaptive;

    const { filters, setFilter, toggleGameMode, toggleModality } = useInsightsFilters();
    const data = useInsightsData(filters);

    return (
        <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 md:px-6 py-4 sm:py-8 lab-grid min-h-screen">
            <div className="mb-6">
                <Link
                    to="/dashboard"
                    className="group inline-flex items-center gap-2 text-theme-text-muted hover:text-theme-accent transition-colors"
                >
                    <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3 transition-transform group-hover:-translate-x-1" />
                    <span className="text-xs font-mono uppercase tracking-wider">Return to Dashboard</span>
                </Link>
            </div>

            <header className="mb-6 sm:mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 bg-theme-bg-elevated border border-theme-line flex items-center justify-center">
                        <FontAwesomeIcon icon={faLightbulb} className="h-4 w-4 text-theme-accent" />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-serif text-theme-text">Insights</h1>
                    <span className="ml-1 text-[0.625rem] font-mono uppercase tracking-[0.2em] text-theme-accent border border-theme-accent/40 px-1.5 py-0.5">
                        Beta
                    </span>
                </div>
                <p className="text-sm text-theme-text-secondary max-w-2xl">
                    Your training journey — level trajectory, personal bests, and where to focus next.
                </p>
            </header>

            <div className="mt-6">
                <ConsistencySection />
                <GrowthSection
                    data={data.growth}
                    filters={filters}
                    setFilter={setFilter}
                    toggleGameMode={toggleGameMode}
                />
                <StrengthsSection
                    data={data.strengths}
                    filters={filters}
                    setFilter={setFilter}
                    toggleModality={toggleModality}
                    isFreeTier={isFreeTier}
                />
            </div>
        </div>
    );
};

export default InsightsPage;
