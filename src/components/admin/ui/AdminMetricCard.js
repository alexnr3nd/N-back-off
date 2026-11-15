/* src/components/admin/ui/AdminMetricCard.js */
import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUp, faArrowDown } from '@fortawesome/free-solid-svg-icons';

// Icon chip tones — semantic only (no raw color props).
const TONES = {
    accent: 'text-theme-accent border-theme-accent/40 bg-theme-accent/10',
    neutral: 'text-theme-text-secondary border-theme-line bg-theme-bg-elevated',
    success: 'text-theme-neural-green border-theme-neural-green/40 bg-theme-neural-green/10',
    info: 'text-theme-neural-blue border-theme-neural-blue/40 bg-theme-neural-blue/10',
    danger: 'text-neural-synapse border-neural-synapse/40 bg-neural-synapse/10',
};

const AdminMetricCard = ({ icon, title, value, subtitle, trend, tone = 'neutral' }) => (
    <div className="specimen-card p-4">
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
                <p className="text-xs font-mono uppercase tracking-wider text-theme-text-muted mb-1.5 truncate">
                    {title}
                </p>
                <p className="text-2xl sm:text-3xl font-mono text-theme-text tabular-nums">{value}</p>
                {subtitle && (
                    <p className="text-[0.6875rem] font-mono text-theme-text-muted mt-1">{subtitle}</p>
                )}
            </div>
            {icon && (
                <div className={`h-9 w-9 flex-shrink-0 flex items-center justify-center border rounded-lab ${TONES[tone] || TONES.neutral}`}>
                    <FontAwesomeIcon icon={icon} className="h-4 w-4" />
                </div>
            )}
        </div>
        {trend != null && (
            <div className={`mt-3 pt-2 border-t border-theme-line flex items-center text-xs font-mono ${trend >= 0 ? 'text-theme-neural-green' : 'text-neural-synapse'}`}>
                <FontAwesomeIcon icon={trend >= 0 ? faArrowUp : faArrowDown} className="h-3 w-3 mr-1.5" />
                <span>{Math.abs(trend)}% vs prev period</span>
            </div>
        )}
    </div>
);

AdminMetricCard.propTypes = {
    icon: PropTypes.object,
    title: PropTypes.node.isRequired,
    value: PropTypes.node,
    subtitle: PropTypes.node,
    trend: PropTypes.number,
    tone: PropTypes.oneOf(['accent', 'neutral', 'success', 'info', 'danger']),
};

export default AdminMetricCard;
