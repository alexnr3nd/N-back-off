/* src/components/admin/emails/EmailEditModal.js */
import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebaseConfig';
import {
    faSave,
    faEye,
    faCheckCircle,
    faPaperPlane,
    faUsers,
} from '@fortawesome/free-solid-svg-icons';
import AdminModal from '../ui/AdminModal';
import AdminButton from '../ui/AdminButton';
import AdminBadge from '../ui/AdminBadge';
import AdminAlert from '../ui/AdminAlert';
import { EYEBROW, LABEL, INPUT, SELECT, TEXTAREA, DL_TERM, DL_VALUE } from '../ui/adminStyles';

const SAMPLE_VARIABLES = {
    firstName: "Alex",
    startDate: "Monday, March 23",
    startTime: "8:00 AM EST",
    newStartDate: "Monday, March 30",
    memberCount: 8,
    spotsRemaining: 4,
    sessionsTarget: "6",
    focusTip: "Focus on accuracy over speed today.",
    daysCompleted: 14,
    streak: 10,
    cohortCompletionRate: 75,
};

const EmailEditModal = ({ template, onClose, onSave }) => {
    const [form, setForm] = useState({
        subject: template.subject || '',
        heading: template.heading || '',
        body: template.body || '',
        ctaText: template.ctaText || '',
        ctaUrl: template.ctaUrl || '',
        footnote: template.footnote || '',
        isEnabled: template.isEnabled ?? true,
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [showPreview, setShowPreview] = useState(false);
    const [copiedVar, setCopiedVar] = useState(null);
    const [testEmails, setTestEmails] = useState('allenewood@gmail.com');
    const [sendingTest, setSendingTest] = useState(false);
    const [testResult, setTestResult] = useState(null);

    // Cohort send state
    const [cohorts, setCohorts] = useState([]);
    const [loadingCohorts, setLoadingCohorts] = useState(false);
    const [selectedCohortId, setSelectedCohortId] = useState('');
    const [sendingCohort, setSendingCohort] = useState(false);
    const [cohortResult, setCohortResult] = useState(null);

    useEffect(() => {
        const fetchCohorts = async () => {
            setLoadingCohorts(true);
            try {
                const fn = httpsCallable(functions, 'adminGetCohorts');
                const result = await fn({ status: 'all' });
                const allCohorts = result.data.cohorts || [];
                setCohorts(allCohorts.filter(c => c.status === 'active' || c.status === 'completed'));
            } catch {
                // Silently fail — dropdown will just be empty
            } finally {
                setLoadingCohorts(false);
            }
        };
        fetchCohorts();
    }, []);

    const handleSendToCohort = async () => {
        if (!selectedCohortId) return;
        const cohort = cohorts.find(c => c.id === selectedCohortId);
        const label = cohort ? `${cohort.id} (${cohort.memberCount} members)` : selectedCohortId;
        if (!window.confirm(`Send "${template.id}" email to all members of cohort ${label}?`)) return;

        setSendingCohort(true);
        setCohortResult(null);
        setError(null);
        try {
            const fn = httpsCallable(functions, 'adminSendCohortEmail');
            await fn({ cohortId: selectedCohortId, templateId: template.id });
            setCohortResult(`Sent to cohort ${selectedCohortId}`);
            setTimeout(() => setCohortResult(null), 5000);
        } catch (err) {
            setError(err.message || 'Failed to send cohort email.');
        } finally {
            setSendingCohort(false);
        }
    };

    const handleChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            const fn = httpsCallable(functions, 'adminUpdateEmailTemplate');
            await fn({ templateId: template.id, ...form });
            onSave();
        } catch (err) {
            setError(err.message || 'Failed to save template.');
        } finally {
            setSaving(false);
        }
    };

    const handleSendTest = async () => {
        const recipients = testEmails.split(',').map(e => e.trim()).filter(Boolean);
        if (recipients.length === 0) return;
        setSendingTest(true);
        setTestResult(null);
        setError(null);
        try {
            const fn = httpsCallable(functions, 'adminSendTestEmail');
            const result = await fn({ templateContent: form, recipients });
            setTestResult(`Sent to ${result.data.sentCount} recipient(s)`);
            setTimeout(() => setTestResult(null), 4000);
        } catch (err) {
            setError(err.message || 'Failed to send test email.');
        } finally {
            setSendingTest(false);
        }
    };

    const copyVariable = (varName) => {
        navigator.clipboard.writeText(`{{${varName}}}`);
        setCopiedVar(varName);
        setTimeout(() => setCopiedVar(null), 1500);
    };

    // Simple Handlebars-like preview (replace {{var}} with sample values)
    const renderPreview = (text) => {
        if (!text) return '';
        return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
            return SAMPLE_VARIABLES[varName] !== undefined ? SAMPLE_VARIABLES[varName] : match;
        });
    };

    return (
        <AdminModal
            size="xl"
            title={template.name}
            subtitle={template.triggerDescription}
            onClose={onClose}
            footer={
                <>
                    <AdminButton
                        variant="ghost"
                        icon={faEye}
                        onClick={() => setShowPreview(prev => !prev)}
                        className="mr-auto"
                    >
                        {showPreview ? 'Hide Preview' : 'Preview'}
                    </AdminButton>
                    <AdminButton variant="ghost" onClick={onClose}>Cancel</AdminButton>
                    <AdminButton variant="primary" icon={faSave} loading={saving} onClick={handleSave}>
                        Save
                    </AdminButton>
                </>
            }
        >
            <div className="space-y-4">
                {/* Template identity (read-only) */}
                <div className="bg-theme-bg-elevated border border-theme-line rounded-lab p-3">
                    <p className={DL_TERM}>Template ID</p>
                    <p className={DL_VALUE}>{template.id}</p>
                </div>

                {/* Available variables */}
                <div>
                    <p className={`${EYEBROW} mb-2`}>Available Variables (click to copy)</p>
                    <div className="flex flex-wrap gap-1.5">
                        {(template.availableVariables || []).map(v => (
                            <button key={v} onClick={() => copyVariable(v)} className="group">
                                {copiedVar === v ? (
                                    <AdminBadge tone="success" icon={faCheckCircle}>copied</AdminBadge>
                                ) : (
                                    <AdminBadge
                                        tone="neutral"
                                        className="cursor-pointer normal-case tracking-normal group-hover:border-theme-accent/40 group-hover:text-theme-accent"
                                    >
                                        {`{{${v}}}`}
                                    </AdminBadge>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Enabled toggle */}
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={form.isEnabled}
                        onChange={(e) => handleChange('isEnabled', e.target.checked)}
                        className="h-4 w-4 accent-theme-accent"
                    />
                    <span className="text-sm font-mono text-theme-text">Enabled</span>
                </label>

                {/* Subject */}
                <div>
                    <label className={LABEL}>Subject</label>
                    <input
                        type="text"
                        value={form.subject}
                        onChange={(e) => handleChange('subject', e.target.value)}
                        className={INPUT}
                    />
                </div>

                {/* Heading */}
                <div>
                    <label className={LABEL}>Heading</label>
                    <input
                        type="text"
                        value={form.heading}
                        onChange={(e) => handleChange('heading', e.target.value)}
                        className={INPUT}
                    />
                </div>

                {/* Body */}
                <div>
                    <label className={LABEL}>Body</label>
                    <textarea
                        value={form.body}
                        onChange={(e) => handleChange('body', e.target.value)}
                        rows={6}
                        className={`${TEXTAREA} font-mono`}
                    />
                </div>

                {/* CTA Text + URL */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={LABEL}>CTA Text</label>
                        <input
                            type="text"
                            value={form.ctaText}
                            onChange={(e) => handleChange('ctaText', e.target.value)}
                            className={INPUT}
                        />
                    </div>
                    <div>
                        <label className={LABEL}>CTA URL</label>
                        <input
                            type="text"
                            value={form.ctaUrl}
                            onChange={(e) => handleChange('ctaUrl', e.target.value)}
                            className={INPUT}
                        />
                    </div>
                </div>

                {/* Footnote */}
                <div>
                    <label className={LABEL}>Footnote</label>
                    <input
                        type="text"
                        value={form.footnote}
                        onChange={(e) => handleChange('footnote', e.target.value)}
                        className={INPUT}
                    />
                </div>

                {/* Preview */}
                {showPreview && (
                    <div className="border border-theme-line rounded-lab overflow-hidden">
                        <div className="bg-theme-bg-elevated px-4 py-2 border-b border-theme-line">
                            <p className={EYEBROW}>Preview (email client)</p>
                        </div>
                        {/*
                         * The preview pane below is deliberately NOT theme-aware: it mirrors the
                         * literal transactional-email markup, which ships one fixed palette to
                         * every recipient's mail client. The hardcoded hexes ARE the email's
                         * colors, so they must not follow the admin's light/dark theme.
                         */}
                        <div className="p-4 bg-[#151311]">
                            <div className="max-w-md mx-auto bg-[#1a1816] border border-[#3A352F] rounded">
                                {/* Header */}
                                <div className="px-6 py-4 border-b border-[#3A352F]">
                                    <span className="text-[#E4B85C] font-bold text-lg">
                                        {renderPreview(form.heading)}
                                    </span>
                                </div>
                                {/* Body */}
                                <div className="px-6 py-5">
                                    <p className="text-[#C4B8A8] text-sm leading-relaxed whitespace-pre-line">
                                        {renderPreview(form.body)}
                                    </p>
                                    <div className="mt-6 text-center">
                                        <span className="inline-block px-6 py-3 bg-[#E4B85C] text-[#151311] font-semibold text-xs uppercase tracking-wider rounded">
                                            {renderPreview(form.ctaText)}
                                        </span>
                                    </div>
                                </div>
                                {/* Footer */}
                                <div className="px-6 py-3 border-t border-[#3A352F] bg-[#141210]">
                                    <p className="text-[#6B6155] text-xs text-center">
                                        {renderPreview(form.footnote)}
                                    </p>
                                </div>
                            </div>
                            <p className="text-center mt-3 text-xs text-[#6B6155]">
                                Subject: {renderPreview(form.subject)}
                            </p>
                        </div>
                    </div>
                )}

                {/* Send Test Email */}
                <div className="border border-theme-line rounded-lab p-4">
                    <p className={`${EYEBROW} mb-2`}>Send Test Email</p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={testEmails}
                            onChange={(e) => setTestEmails(e.target.value)}
                            placeholder="email1@example.com, email2@example.com"
                            className={`${INPUT} flex-1 min-w-0`}
                        />
                        <AdminButton
                            variant="secondary"
                            icon={faPaperPlane}
                            loading={sendingTest}
                            disabled={!testEmails.trim()}
                            onClick={handleSendTest}
                            className="whitespace-nowrap flex-shrink-0"
                        >
                            Send Test
                        </AdminButton>
                    </div>
                    <p className="text-[0.6875rem] font-mono text-theme-text-muted mt-1">
                        Comma-separated. Uses sample data for variables.
                    </p>
                    {testResult && (
                        <p className="text-[0.6875rem] font-mono text-theme-neural-green mt-1">{testResult}</p>
                    )}
                </div>

                {/* Send to Cohort */}
                <div className="border border-theme-line rounded-lab p-4">
                    <p className={`${EYEBROW} mb-2`}>Send to Cohort</p>
                    <div className="flex gap-2">
                        <select
                            value={selectedCohortId}
                            onChange={(e) => setSelectedCohortId(e.target.value)}
                            disabled={loadingCohorts}
                            className={`${SELECT} flex-1 min-w-0`}
                        >
                            <option value="">
                                {loadingCohorts ? 'Loading cohorts...' : 'Select a cohort'}
                            </option>
                            {cohorts.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.id} — {c.status} — {c.memberCount} members — started {c.startDate}
                                </option>
                            ))}
                        </select>
                        <AdminButton
                            variant="primary"
                            icon={faUsers}
                            loading={sendingCohort}
                            disabled={!selectedCohortId}
                            onClick={handleSendToCohort}
                            className="whitespace-nowrap flex-shrink-0"
                        >
                            Send to Cohort
                        </AdminButton>
                    </div>
                    <p className="text-[0.6875rem] font-mono text-theme-text-muted mt-1">
                        Sends this template to all members of the selected cohort.
                    </p>
                    {cohortResult && (
                        <p className="text-[0.6875rem] font-mono text-theme-neural-green mt-1">{cohortResult}</p>
                    )}
                </div>

                {error && <AdminAlert tone="error">{error}</AdminAlert>}
            </div>
        </AdminModal>
    );
};

export default EmailEditModal;
