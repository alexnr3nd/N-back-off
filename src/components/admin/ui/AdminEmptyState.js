/* src/components/admin/ui/AdminEmptyState.js */
import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const AdminEmptyState = ({ icon, title, hint }) => (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        {icon && <FontAwesomeIcon icon={icon} className="h-8 w-8 mb-4 text-theme-text-muted/50" />}
        <p className="text-sm font-serif italic text-theme-text-secondary">{title}</p>
        {hint && <p className="text-xs font-mono text-theme-text-muted mt-1.5">{hint}</p>}
    </div>
);

AdminEmptyState.propTypes = {
    icon: PropTypes.object,
    title: PropTypes.node.isRequired,
    hint: PropTypes.node,
};

export default AdminEmptyState;
