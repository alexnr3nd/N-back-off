/* src/components/program/ProgramPage.js */

/**
 * Main program page — routes between three states:
 * 1. Not enrolled → ProgramLanding
 * 2. Enrolled (active/forming) → CohortDashboard
 * 3. Post-program (completed) → ProgramCompletionSummary
 */

import React from 'react';
import { useCohort } from '../../contexts/CohortContext';
import ProgramLanding from './ProgramLanding';
import CohortDashboard from './CohortDashboard';
import ProgramCompletionSummary from './ProgramCompletionSummary';
import LoadingSpinner from '../ui/LoadingSpinner';

const ProgramPage = () => {
    const { activeCohort, activeCohortId, isLoading } = useCohort();

    if (isLoading) {
        return (
            <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 md:px-6 py-8 flex justify-center">
                <LoadingSpinner />
            </div>
        );
    }

    // Not enrolled
    if (!activeCohortId) {
        return <ProgramLanding />;
    }

    // Completed cohort (user finished but hasn't left yet)
    if (activeCohort?.status === 'completed' || activeCohort?.status === 'archived') {
        return <ProgramCompletionSummary />;
    }

    // Active or forming cohort
    return <CohortDashboard />;
};

export default ProgramPage;
