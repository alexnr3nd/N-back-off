/* src/components/admin/ui/AdminModal.js */
import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

const SIZES = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-3xl',
};

/**
 * Admin modal shell. Deliberately NO portal / ESC-close / backdrop-click —
 * the admin modals it replaces never had them, so behavior is unchanged.
 */
const AdminModal = ({ title, subtitle, badge, onClose, footer, size = 'md', children }) => (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
        <div
            className={`w-full ${SIZES[size] || SIZES.md} bg-theme-bg-secondary border border-theme-line rounded-lab shadow-lab-elevated flex flex-col max-h-[90vh] my-auto`}
            role="dialog"
            aria-modal="true"
        >
            <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-theme-line flex-shrink-0">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-lg font-serif italic text-theme-text truncate">{title}</h3>
                        {badge}
                    </div>
                    {subtitle && (
                        <p className="text-xs font-mono text-theme-text-muted mt-1">{subtitle}</p>
                    )}
                </div>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="text-theme-text-muted hover:text-theme-text transition-colors p-1 flex-shrink-0"
                    >
                        <FontAwesomeIcon icon={faTimes} className="h-4 w-4" />
                    </button>
                )}
            </div>

            <div className="px-4 sm:px-6 py-4 overflow-y-auto flex-1 custom-scrollbar">
                {children}
            </div>

            {footer && (
                <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-theme-line bg-theme-bg-elevated flex-shrink-0">
                    {footer}
                </div>
            )}
        </div>
    </div>
);

AdminModal.propTypes = {
    title: PropTypes.node,
    subtitle: PropTypes.node,
    badge: PropTypes.node,
    onClose: PropTypes.func,
    footer: PropTypes.node,
    size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
    children: PropTypes.node,
};

export default AdminModal;
