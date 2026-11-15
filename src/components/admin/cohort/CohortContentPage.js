/* src/components/admin/cohort/CohortContentPage.js */
import React, { useState, useEffect, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebaseConfig';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faLightbulb,
    faDna,
    faPen,
    faBed,
    faDumbbell,
} from '@fortawesome/free-solid-svg-icons';
import PrescriptionEditModal from './PrescriptionEditModal';
import LoadingSpinner from '../../ui/LoadingSpinner';
import AdminPage from '../ui/AdminPage';
import AdminCard from '../ui/AdminCard';
import AdminButton from '../ui/AdminButton';
import AdminBadge from '../ui/AdminBadge';
import AdminAlert from '../ui/AdminAlert';
import { AdminTable, AdminTr, AdminTd } from '../ui/AdminTable';

const TABS = [
    { id: 'focusTips', label: 'Focus Tips', icon: faLightbulb },
    { id: 'scienceNuggets', label: 'Science Nuggets', icon: faDna },
];

const CohortContentPage = () => {
    const [prescriptions, setPrescriptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('focusTips');
    const [editingDay, setEditingDay] = useState(null);

    const fetchPrescriptions = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const fn = httpsCallable(functions, 'adminGetProgramPrescriptions');
            const result = await fn({});
            if (result.data.success) {
                setPrescriptions(result.data.prescriptions);
            }
        } catch (err) {
            console.error('[CohortContentPage] Error:', err);
            setError(err.message || 'Failed to load program data.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPrescriptions();
    }, [fetchPrescriptions]);

    const handleSave = (updatedPrescription) => {
        setPrescriptions(prev => prev.map(p =>
            p.day === updatedPrescription.day ? updatedPrescription : p
        ));
        setEditingDay(null);
    };

    const getDisplayText = (prescription) => {
        if (activeTab === 'focusTips') {
            return prescription.type === 'rest'
                ? prescription.message || '—'
                : prescription.focusTip || '—';
        }
        return prescription.scienceNugget || '—';
    };

    const getEditField = (prescription) => {
        if (activeTab === 'focusTips') {
            return prescription.type === 'rest' ? 'message' : 'focusTip';
        }
        return 'scienceNugget';
    };

    const truncate = (text, maxLen = 120) => {
        if (!text || text.length <= maxLen) return text;
        return text.substring(0, maxLen) + '...';
    };

    if (loading) {
        return (
            <div className="min-h-[400px] flex items-center justify-center">
                <LoadingSpinner theme="auto" message="Loading program content" />
            </div>
        );
    }

    if (error) {
        return (
            <AdminAlert
                tone="error"
                action={<AdminButton variant="ghost" size="sm" onClick={fetchPrescriptions}>Retry</AdminButton>}
            >
                {error}
            </AdminAlert>
        );
    }

    const columns = [
        { key: 'day', label: 'Day', className: 'w-16' },
        { key: 'type', label: 'Type', className: 'w-28' },
        { key: 'text', label: activeTab === 'focusTips' ? 'Focus Tip / Rest Message' : 'Science Nugget' },
        { key: 'edit', label: 'Edit', align: 'right', className: 'w-16' },
    ];

    return (
        <AdminPage
            eyebrow="Program"
            title="Cohort Content"
            actions={<span className="text-xs font-mono text-theme-text-muted">{prescriptions.length} days</span>}
        >
            {/* Segmented Tabs */}
            <div className="flex gap-1 border border-theme-line rounded-lab p-0.5 bg-theme-bg-elevated w-fit">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lab text-xs font-mono uppercase tracking-wider transition-colors ${
                            activeTab === tab.id
                                ? 'bg-theme-accent/15 text-theme-accent'
                                : 'text-theme-text-muted hover:text-theme-text'
                        }`}
                    >
                        <FontAwesomeIcon icon={tab.icon} className="h-3 w-3" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Table */}
            <AdminCard variant="panel" flush>
                <AdminTable columns={columns}>
                    {prescriptions.map((prescription) => (
                        <AdminTr key={prescription.day} onClick={() => setEditingDay(prescription)}>
                            <AdminTd mono className="whitespace-nowrap">
                                <span className="text-theme-accent">{prescription.day}</span>
                            </AdminTd>
                            <AdminTd className="whitespace-nowrap">
                                {prescription.type === 'rest' ? (
                                    <AdminBadge tone="info" icon={faBed}>Rest</AdminBadge>
                                ) : (
                                    <AdminBadge tone="success" icon={faDumbbell}>Training</AdminBadge>
                                )}
                            </AdminTd>
                            <AdminTd>
                                <p className="text-sm text-theme-text-secondary leading-snug">
                                    {truncate(getDisplayText(prescription))}
                                </p>
                            </AdminTd>
                            <AdminTd align="right">
                                <AdminButton
                                    variant="ghost"
                                    size="sm"
                                    icon={faPen}
                                    title="Edit"
                                    onClick={(e) => { e.stopPropagation(); setEditingDay(prescription); }}
                                />
                            </AdminTd>
                        </AdminTr>
                    ))}
                </AdminTable>
            </AdminCard>

            {/* Edit Modal */}
            {editingDay && (
                <PrescriptionEditModal
                    prescription={editingDay}
                    field={getEditField(editingDay)}
                    fieldLabel={activeTab === 'focusTips'
                        ? (editingDay.type === 'rest' ? 'Rest Day Message' : 'Focus Tip')
                        : 'Science Nugget'
                    }
                    onClose={() => setEditingDay(null)}
                    onSave={handleSave}
                />
            )}
        </AdminPage>
    );
};

export default CohortContentPage;
