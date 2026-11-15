/* src/components/admin/users/UserAssessmentsTable.js */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGraduationCap, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import AdminCard from '../ui/AdminCard';
import AdminBadge from '../ui/AdminBadge';
import AdminEmptyState from '../ui/AdminEmptyState';
import { AdminTable, AdminTr, AdminTd } from '../ui/AdminTable';
import { DL_TERM } from '../ui/adminStyles';
import {
    getAssessmentLabel,
    getAssessmentScoreDisplay,
    getAssessmentSecondaryDisplay,
    isAssessmentFlagged,
} from '../assessments/assessmentDisplay';

const ASSESSMENT_COLUMNS = [
    { key: 'date', label: 'Date' },
    { key: 'assessment', label: 'Assessment' },
    { key: 'type', label: 'Type' },
    { key: 'score', label: 'Score' },
    { key: 'detail', label: 'Detail' },
    { key: 'flagged', label: 'Flagged' },
];

const entryMillis = (entry) => (
    entry.timestamp?._seconds
        ? entry.timestamp._seconds * 1000
        : new Date(entry.timestamp).getTime()
);

const entryDateString = (entry) => (
    entry.timestamp?._seconds
        ? new Date(entry.timestamp._seconds * 1000).toISOString()
        : entry.timestamp
);

const TypeBadge = ({ entry }) => (
    <AdminBadge tone={entry.familiarizationSession ? 'accent' : 'success'}>
        {entry.familiarizationSession ? 'Familiarization' : 'Official'}
    </AdminBadge>
);

const SummaryStat = ({ label, value }) => (
    <div>
        <span className={DL_TERM}>{label}</span>{' '}
        <span className="text-sm font-mono text-theme-text">{value}</span>
    </div>
);

/**
 * Assessments section (mobile cards + desktop table).
 * Pure presentational — data is fetched by UserDetailPage.
 */
const UserAssessmentsTable = ({ assessments, formatDate }) => {
    const sorted = [...assessments].sort((a, b) => entryMillis(b) - entryMillis(a));

    return (
        <AdminCard variant="panel" flush title="Assessments" icon={faGraduationCap}>
            {/* Summary Stats */}
            {assessments.length > 0 && (
                <div className="px-4 sm:px-6 py-3 border-b border-theme-line/50 flex flex-wrap gap-6">
                    <SummaryStat label="Total" value={assessments.length} />
                    <SummaryStat
                        label="Official"
                        value={assessments.filter(a => a.familiarizationSession !== true).length}
                    />
                    <SummaryStat
                        label="Familiarization"
                        value={assessments.filter(a => a.familiarizationSession === true).length}
                    />
                </div>
            )}

            {assessments.length === 0 ? (
                <AdminEmptyState title="No assessments taken" />
            ) : (
                <>
                    {/* Mobile Card Layout */}
                    <div className="sm:hidden divide-y divide-theme-line/50">
                        {sorted.map((entry, idx) => (
                            <div key={entry.id || idx} className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-mono text-theme-text">
                                        {formatDate(entryDateString(entry))}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <TypeBadge entry={entry} />
                                        {isAssessmentFlagged(entry) && (
                                            <FontAwesomeIcon icon={faExclamationTriangle} className="h-3.5 w-3.5 text-neural-synapse" />
                                        )}
                                    </div>
                                </div>
                                <div className="mb-2">
                                    <AdminBadge tone="neutral">{getAssessmentLabel(entry)}</AdminBadge>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <span className={DL_TERM}>Score</span>
                                        <p className="font-mono text-theme-text">{getAssessmentScoreDisplay(entry) || '—'}</p>
                                    </div>
                                    <div>
                                        <span className={DL_TERM}>Detail</span>
                                        <p className="font-mono text-theme-text">{getAssessmentSecondaryDisplay(entry) || '—'}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop Table Layout */}
                    <div className="hidden sm:block">
                        <AdminTable columns={ASSESSMENT_COLUMNS} minWidth="min-w-full">
                            {sorted.map((entry, idx) => (
                                <AdminTr key={entry.id || idx}>
                                    <AdminTd mono className="whitespace-nowrap">
                                        {formatDate(entryDateString(entry))}
                                    </AdminTd>
                                    <AdminTd className="whitespace-nowrap">
                                        <AdminBadge tone="neutral">{getAssessmentLabel(entry)}</AdminBadge>
                                    </AdminTd>
                                    <AdminTd className="whitespace-nowrap">
                                        <TypeBadge entry={entry} />
                                    </AdminTd>
                                    <AdminTd mono className="whitespace-nowrap">
                                        {getAssessmentScoreDisplay(entry) || '—'}
                                    </AdminTd>
                                    <AdminTd mono muted className="whitespace-nowrap">
                                        {getAssessmentSecondaryDisplay(entry) || '—'}
                                    </AdminTd>
                                    <AdminTd className="whitespace-nowrap">
                                        {isAssessmentFlagged(entry) ? (
                                            <FontAwesomeIcon icon={faExclamationTriangle} className="h-4 w-4 text-neural-synapse" />
                                        ) : (
                                            <span className="text-theme-text-muted">—</span>
                                        )}
                                    </AdminTd>
                                </AdminTr>
                            ))}
                        </AdminTable>
                    </div>
                </>
            )}
        </AdminCard>
    );
};

export default UserAssessmentsTable;
