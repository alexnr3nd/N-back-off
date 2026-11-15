/* src/components/admin/ui/AdminAlert.js */
import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation, faCircleCheck, faCircleInfo } from '@fortawesome/free-solid-svg-icons';

const TONES = {
    error: { wrap: 'bg-neural-synapse/10 border-neural-synapse/30 text-neural-synapse', icon: faTriangleExclamation },
    success: { wrap: 'bg-theme-neural-green/10 border-theme-neural-green/30 text-theme-neural-green', icon: faCircleCheck },
    warning: { wrap: 'bg-theme-accent/10 border-theme-accent/30 text-theme-accent', icon: faTriangleExclamation },
    info: { wrap: 'bg-theme-neural-blue/10 border-theme-neural-blue/30 text-theme-neural-blue', icon: faCircleInfo },
};

const AdminAlert = ({ tone = 'error', icon, title, action, className = '', children }) => {
    const config = TONES[tone] || TONES.error;

    return (
        <div className={`flex items-start gap-3 p-4 border rounded-lab text-sm font-mono ${config.wrap} ${className}`}>
            <FontAwesomeIcon icon={icon || config.icon} className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
                {title && <p className="font-medium mb-1">{title}</p>}
                {children}
            </div>
            {action && <div className="flex-shrink-0">{action}</div>}
        </div>
    );
};

AdminAlert.propTypes = {
    tone: PropTypes.oneOf(['error', 'success', 'warning', 'info']),
    icon: PropTypes.object,
    title: PropTypes.node,
    action: PropTypes.node,
    className: PropTypes.string,
    children: PropTypes.node,
};

export default AdminAlert;
