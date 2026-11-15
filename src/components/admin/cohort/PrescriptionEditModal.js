/* src/components/admin/cohort/PrescriptionEditModal.js */
import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebaseConfig';
import {
    faSave,
    faBed,
    faDumbbell,
} from '@fortawesome/free-solid-svg-icons';
import AdminModal from '../ui/AdminModal';
import AdminButton from '../ui/AdminButton';
import AdminBadge from '../ui/AdminBadge';
import AdminAlert from '../ui/AdminAlert';
import { LABEL, TEXTAREA } from '../ui/adminStyles';

const PrescriptionEditModal = ({ prescription, field, fieldLabel, onClose, onSave }) => {
    const [value, setValue] = useState(prescription[field] || '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            const fn = httpsCallable(functions, 'adminUpdateProgramPrescription');
            const result = await fn({ day: prescription.day, field, value });
            if (result.data.success) {
                onSave(result.data.prescription);
            }
        } catch (err) {
            setError(err.message || 'Failed to save.');
        } finally {
            setSaving(false);
        }
    };

    const hasChanges = value !== (prescription[field] || '');
    const isRest = prescription.type === 'rest';

    return (
        <AdminModal
            size="md"
            title={`Day ${prescription.day}`}
            subtitle={prescription.sessionTarget ? `${prescription.sessionTarget} sessions` : undefined}
            badge={
                <AdminBadge tone={isRest ? 'info' : 'success'} icon={isRest ? faBed : faDumbbell}>
                    {isRest ? 'Rest' : 'Training'}
                </AdminBadge>
            }
            onClose={onClose}
            footer={
                <>
                    <AdminButton variant="ghost" onClick={onClose}>Cancel</AdminButton>
                    <AdminButton
                        variant="primary"
                        icon={faSave}
                        loading={saving}
                        disabled={!hasChanges}
                        onClick={handleSave}
                    >
                        Save
                    </AdminButton>
                </>
            }
        >
            <label className={LABEL}>{fieldLabel}</label>
            <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                rows={4}
                className={TEXTAREA}
                placeholder={`Enter ${fieldLabel.toLowerCase()}...`}
            />
            <p className="text-[0.6875rem] font-mono text-theme-text-muted mt-1">{value.length} characters</p>

            {error && <AdminAlert tone="error" className="mt-4">{error}</AdminAlert>}
        </AdminModal>
    );
};

export default PrescriptionEditModal;
