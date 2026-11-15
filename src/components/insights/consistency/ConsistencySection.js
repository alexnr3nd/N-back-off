/* src/components/insights/consistency/ConsistencySection.js
 *
 * Top section of the Insights page.
 */

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeartPulse } from '@fortawesome/free-solid-svg-icons';
import { useConsistencyData } from '../hooks/useConsistencyData';
import CadenceHeroCard from './CadenceHeroCard';
import LifetimeLedgerCard from './LifetimeLedgerCard';
import TrainingMapCard from './TrainingMapCard';

const ConsistencySection = () => {
    const data = useConsistencyData();

    return (
        <section aria-labelledby="consistency-heading" className="mb-12">
            <div className="mb-3 flex items-center gap-3">
                <FontAwesomeIcon icon={faHeartPulse} className="h-4 w-4 text-theme-accent" />
                <div>
                    <h2 id="consistency-heading" className="text-xl font-serif text-theme-text">
                        Consistency
                    </h2>
                    <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mt-1">
                        Cadence · weekly rhythm · daily record
                    </p>
                </div>
            </div>

            {data.loading && (
                <div className="text-xs font-mono text-theme-text-muted mb-3">Loading your training history…</div>
            )}
            {data.error && (
                <div className="text-xs font-mono text-red-400 mb-3">Couldn't load consistency data: {data.error}</div>
            )}

            <div className="space-y-4">
                <CadenceHeroCard
                    cadence={data.cadence}
                    currentWeek={data.currentWeek}
                    streak={data.streak}
                    weekStrip={data.weekStrip}
                />

                <LifetimeLedgerCard
                    lifetimeSessions={data.lifetimeSessions}
                    lifetimeDurationMs={data.lifetimeDurationMs}
                    totalConsistentWeeks={data.streak.totalConsistentWeeks}
                    joinedAt={data.joinedAt}
                />

                <TrainingMapCard
                    cells={data.calendar}
                    stats={data.calendarStats}
                />
            </div>
        </section>
    );
};

export default ConsistencySection;
