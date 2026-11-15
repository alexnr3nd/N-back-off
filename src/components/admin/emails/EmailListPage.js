/* src/components/admin/emails/EmailListPage.js */
import React, { useState, useEffect, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebaseConfig';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faToggleOn,
    faToggleOff,
} from '@fortawesome/free-solid-svg-icons';
import AdminPage from '../ui/AdminPage';
import AdminCard from '../ui/AdminCard';
import AdminButton from '../ui/AdminButton';
import AdminAlert from '../ui/AdminAlert';
import { AdminTable, AdminTr, AdminTd } from '../ui/AdminTable';
import LoadingSpinner from '../../ui/LoadingSpinner';
import EmailEditModal from './EmailEditModal';

const COLUMNS = [
    { key: 'name', label: 'Name' },
    { key: 'subject', label: 'Subject' },
    { key: 'trigger', label: 'Trigger', className: 'hidden md:table-cell' },
    { key: 'enabled', label: 'Enabled', align: 'center' },
    { key: 'sent', label: 'Sent', align: 'right', className: 'hidden sm:table-cell' },
    { key: 'lastSent', label: 'Last Sent', align: 'right', className: 'hidden lg:table-cell' },
];

const EmailListPage = () => {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedTemplate, setSelectedTemplate] = useState(null);

    const fetchTemplates = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const fn = httpsCallable(functions, 'adminGetEmailTemplates');
            const result = await fn({});
            if (result.data.success) {
                setTemplates(result.data.templates);
            }
        } catch (err) {
            console.error('[EmailListPage] Error:', err);
            setError(err.message || 'Failed to load email templates.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    const handleToggleEnabled = async (template) => {
        try {
            const fn = httpsCallable(functions, 'adminUpdateEmailTemplate');
            await fn({ templateId: template.id, isEnabled: !template.isEnabled });
            // Update local state
            setTemplates(prev => prev.map(t =>
                t.id === template.id ? { ...t, isEnabled: !t.isEnabled } : t
            ));
        } catch (err) {
            console.error('[EmailListPage] Toggle error:', err);
        }
    };

    const handleSave = () => {
        fetchTemplates();
        setSelectedTemplate(null);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <LoadingSpinner theme="auto" message="Loading templates" />
            </div>
        );
    }

    if (error) {
        return (
            <AdminAlert
                tone="error"
                action={
                    <AdminButton variant="ghost" size="sm" onClick={fetchTemplates}>
                        Retry
                    </AdminButton>
                }
            >
                {error}
            </AdminAlert>
        );
    }

    return (
        <AdminPage
            eyebrow="Lifecycle"
            title="Email Templates"
            actions={<span className="text-xs font-mono text-theme-text-muted">{templates.length} templates</span>}
        >
            <AdminCard variant="panel" flush>
                <AdminTable columns={COLUMNS} minWidth="min-w-full">
                    {templates.map((template) => (
                        <AdminTr key={template.id} onClick={() => setSelectedTemplate(template)}>
                            <AdminTd className="whitespace-nowrap">
                                <div className="text-sm text-theme-text">{template.name}</div>
                                <div className="text-[0.6875rem] text-theme-text-muted font-mono">{template.id}</div>
                            </AdminTd>
                            <AdminTd>
                                <div className="text-sm text-theme-text-secondary truncate max-w-[250px]">
                                    {template.subject}
                                </div>
                            </AdminTd>
                            <AdminTd className="hidden md:table-cell">
                                <div className="text-xs font-mono text-theme-text-muted">
                                    {template.triggerDescription}
                                </div>
                            </AdminTd>
                            <AdminTd align="center">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleToggleEnabled(template); }}
                                    className={`text-xl transition-colors ${template.isEnabled ? 'text-theme-neural-green hover:brightness-110' : 'text-theme-text-muted hover:text-theme-text-secondary'}`}
                                >
                                    <FontAwesomeIcon icon={template.isEnabled ? faToggleOn : faToggleOff} />
                                </button>
                            </AdminTd>
                            <AdminTd align="right" mono className="hidden sm:table-cell">
                                <span className="text-sm">{template.stats?.totalSent || 0}</span>
                            </AdminTd>
                            <AdminTd align="right" mono muted className="hidden lg:table-cell">
                                <span className="text-xs">
                                    {formatDate(template.stats?.lastSentAt?._seconds
                                        ? new Date(template.stats.lastSentAt._seconds * 1000).toISOString()
                                        : template.stats?.lastSentAt)}
                                </span>
                            </AdminTd>
                        </AdminTr>
                    ))}
                </AdminTable>
            </AdminCard>

            {selectedTemplate && (
                <EmailEditModal
                    template={selectedTemplate}
                    onClose={() => setSelectedTemplate(null)}
                    onSave={handleSave}
                />
            )}
        </AdminPage>
    );
};

export default EmailListPage;
