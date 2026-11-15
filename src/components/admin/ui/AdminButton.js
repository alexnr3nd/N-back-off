/* src/components/admin/ui/AdminButton.js */
import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

const BASE = 'inline-flex items-center justify-center gap-2 font-mono uppercase tracking-wider rounded-lab border transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-theme-accent/50';

const SIZES = {
    sm: 'px-3 py-1.5 text-[0.6875rem]',
    md: 'px-4 py-2 text-xs',
    lg: 'px-5 py-2.5 text-sm',
};

const VARIANTS = {
    primary: 'bg-theme-accent hover:bg-amber-highlight text-theme-bg border-theme-accent',
    secondary: 'bg-theme-bg-elevated hover:bg-theme-bg-surface text-theme-text border-theme-line',
    danger: 'bg-neural-synapse/20 hover:bg-neural-synapse/30 text-neural-synapse border-neural-synapse/50',
    ghost: 'bg-transparent hover:bg-theme-bg-surface text-theme-text-secondary border-transparent',
};

const AdminButton = ({
    variant = 'primary',
    size = 'md',
    icon,
    iconRight,
    loading = false,
    disabled = false,
    type = 'button',
    onClick,
    title,
    className = '',
    children,
}) => (
    <button
        type={type}
        onClick={onClick}
        disabled={disabled || loading}
        title={title}
        className={`${BASE} ${SIZES[size] || SIZES.md} ${VARIANTS[variant] || VARIANTS.primary} ${className}`}
    >
        {loading
            ? <FontAwesomeIcon icon={faSpinner} spin className="h-3.5 w-3.5" />
            : icon && <FontAwesomeIcon icon={icon} className="h-3.5 w-3.5" />}
        {children}
        {iconRight && !loading && <FontAwesomeIcon icon={iconRight} className="h-3.5 w-3.5" />}
    </button>
);

AdminButton.propTypes = {
    variant: PropTypes.oneOf(['primary', 'secondary', 'danger', 'ghost']),
    size: PropTypes.oneOf(['sm', 'md', 'lg']),
    icon: PropTypes.object,
    iconRight: PropTypes.object,
    loading: PropTypes.bool,
    disabled: PropTypes.bool,
    type: PropTypes.oneOf(['button', 'submit', 'reset']),
    onClick: PropTypes.func,
    title: PropTypes.string,
    className: PropTypes.string,
    children: PropTypes.node,
};

export default AdminButton;
