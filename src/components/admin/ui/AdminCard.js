/* src/components/admin/ui/AdminCard.js */
import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const VARIANTS = {
    specimen: 'specimen-card',
    panel: 'bg-theme-bg-secondary border border-theme-line',
};

/**
 * Admin content card.
 * - `variant="specimen"` for content cards (lab notebook look, accent left rule)
 * - `variant="panel" flush` for table containers (no body padding)
 */
const AdminCard = ({
    variant = 'specimen',
    eyebrow,
    title,
    subtitle,
    icon,
    actions,
    flush = false,
    bodyClassName,
    className = '',
    children,
}) => {
    const hasHeader = Boolean(title || actions);
    const bodyClasses = bodyClassName ?? (flush ? '' : 'p-4 sm:p-5');

    return (
        <div className={`${VARIANTS[variant] || VARIANTS.specimen} ${className}`}>
            {hasHeader && (
                <div className="flex items-start justify-between gap-3 px-4 sm:px-5 pt-4 pb-3 border-b border-theme-line">
                    <div className="min-w-0">
                        {eyebrow && (
                            <p className="text-xs font-mono uppercase tracking-[0.2em] text-theme-text-muted mb-0.5">
                                {eyebrow}
                            </p>
                        )}
                        {title && (
                            <h2 className="text-base sm:text-lg font-serif italic text-theme-text flex items-center gap-2">
                                {icon && <FontAwesomeIcon icon={icon} className="h-4 w-4 text-theme-text-muted" />}
                                {title}
                            </h2>
                        )}
                        {subtitle && (
                            <p className="text-xs font-mono text-theme-text-muted mt-1">{subtitle}</p>
                        )}
                    </div>
                    {actions && <div className="flex flex-wrap items-center gap-2 flex-shrink-0">{actions}</div>}
                </div>
            )}
            <div className={bodyClasses}>{children}</div>
        </div>
    );
};

AdminCard.propTypes = {
    variant: PropTypes.oneOf(['specimen', 'panel']),
    eyebrow: PropTypes.node,
    title: PropTypes.node,
    subtitle: PropTypes.node,
    icon: PropTypes.object,
    actions: PropTypes.node,
    flush: PropTypes.bool,
    bodyClassName: PropTypes.string,
    className: PropTypes.string,
    children: PropTypes.node,
};

export default AdminCard;
