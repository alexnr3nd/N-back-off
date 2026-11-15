/* src/components/admin/ui/AdminBadge.js */
import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

/**
 * Canonical state -> tone map (replaces all per-page STATUS_COLORS objects):
 *  accent  - premium, lifetime, canceled, reviewed, familiarization, pending,
 *            trial-canceled, trial-ended, gifted
 *  success - active, resolved, converted, subscribed, resumed, official, training-day
 *  info    - trialing, new, forming, rest-day, trial-started
 *  danger  - past_due, refunded, flagged
 *  neutral - free, inactive, completed, archived, removed, ended, expired, unknown
 *
 * There is deliberately NO orange/warn tone — "warning-ish" states use `accent`.
 */
const TONES = {
    neutral: 'bg-theme-bg-surface text-theme-text-secondary border-theme-line',
    accent: 'bg-theme-accent/15 text-theme-accent border-theme-accent/40',
    success: 'bg-theme-neural-green/15 text-theme-neural-green border-theme-neural-green/40',
    info: 'bg-theme-neural-blue/15 text-theme-neural-blue border-theme-neural-blue/40',
    danger: 'bg-neural-synapse/15 text-neural-synapse border-neural-synapse/40',
};

const AdminBadge = ({ tone = 'neutral', icon, className = '', children }) => (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[0.6875rem] font-mono uppercase tracking-wider border rounded-lab whitespace-nowrap ${TONES[tone] || TONES.neutral} ${className}`}>
        {icon && <FontAwesomeIcon icon={icon} className="h-2.5 w-2.5" />}
        {children}
    </span>
);

AdminBadge.propTypes = {
    tone: PropTypes.oneOf(['neutral', 'accent', 'success', 'info', 'danger']),
    icon: PropTypes.object,
    className: PropTypes.string,
    children: PropTypes.node,
};

export default AdminBadge;
