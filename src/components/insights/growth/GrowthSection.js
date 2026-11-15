/* src/components/insights/growth/GrowthSection.js */
/* The free, above-the-fold section of the Insights page.
 * Composes the trajectory chart with PB/DaysSince/Level-up cards.
 * Each section owns its own sticky filter bar (SectionFilterBar).
 */

import React from 'react';
import LevelTrajectoryChart from './LevelTrajectoryChart';
import PersonalBestCard from './PersonalBestCard';
import DaysSincePbCard from './DaysSincePbCard';
import LevelUpMomentsCard from './LevelUpMomentsCard';
import SectionFilterBar from '../SectionFilterBar';

const GrowthSection = ({ data, filters, setFilter, toggleGameMode }) => {
    return (
        <section aria-labelledby="growth-heading" className="mb-12">
            <div className="mb-3">
                <h2 id="growth-heading" className="text-xl font-serif text-theme-text">Growth</h2>
                <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mt-1">
                    Level trajectory · personal bests · level-up moments
                </p>
            </div>

            <SectionFilterBar
                filters={filters}
                setFilter={setFilter}
                toggleGameMode={toggleGameMode}
                modeMode="multi"
            />

            <div className="mt-4">
                <div className="mb-4">
                    <LevelTrajectoryChart
                        trajectoryByMode={data.trajectoryByMode}
                        gameModes={filters.gameModes}
                        period={filters.period}
                    />
                </div>

                <div className="mb-4">
                    <DaysSincePbCard
                        lastPbDaysByMode={data.lastPbDaysByMode}
                        selectedModes={filters.gameModes}
                    />
                </div>

                <div
                    className={`grid gap-3 mb-4 grid-cols-1 ${
                        filters.gameModes.length === 1 ? 'sm:grid-cols-1' :
                        filters.gameModes.length === 2 ? 'sm:grid-cols-2' :
                        filters.gameModes.length >= 4 ? 'sm:grid-cols-2 md:grid-cols-4' :
                        'sm:grid-cols-3'
                    }`}
                >
                    {filters.gameModes.map(mode => (
                        <PersonalBestCard
                            key={mode}
                            mode={mode}
                            pb={data.personalBests[mode]}
                            daysSince={data.lastPbDaysByMode[mode]}
                        />
                    ))}
                </div>

                <LevelUpMomentsCard events={data.recentLevelUps} />
            </div>
        </section>
    );
};

export default GrowthSection;
