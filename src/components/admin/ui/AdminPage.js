/* src/components/admin/ui/AdminPage.js */
import React from 'react';
import PropTypes from 'prop-types';

/**
 * Standard admin page shell: eyebrow + serif-italic title, optional action row.
 * The `lab-grid` background lives on AdminLayout's <main>, never per page.
 */
const AdminPage = ({ eyebrow, title, actions, className = '', children }) => (
    <div className={`space-y-6 min-w-0 max-w-6xl ${className}`}>
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
                {eyebrow && (
                    <p className="text-xs font-mono uppercase tracking-[0.2em] text-theme-text-muted mb-1">
                        {eyebrow}
                    </p>
                )}
                <h1 className="text-2xl sm:text-3xl font-serif italic text-theme-text">{title}</h1>
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
        {children}
    </div>
);

AdminPage.propTypes = {
    eyebrow: PropTypes.node,
    title: PropTypes.node.isRequired,
    actions: PropTypes.node,
    className: PropTypes.string,
    children: PropTypes.node,
};

export default AdminPage;
