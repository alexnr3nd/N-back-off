/* src/components/admin/ui/AdminTable.js */
import React from 'react';
import PropTypes from 'prop-types';

const ALIGN = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
};

/**
 * Canonical admin table chrome: no zebra, hover-only row highlight,
 * mono uppercase [11px] header on bg-theme-bg-elevated/60, horizontal scroll.
 *
 * `columns` entries: { key, label, align, className }. Responsive hiding
 * (e.g. 'hidden md:table-cell') goes in `className` on BOTH the column def
 * and the matching AdminTd.
 */
export const AdminTable = ({ columns, empty, children, className = '', minWidth = '' }) => {
    const hasRows = React.Children.count(children) > 0;

    return (
        <div className={`overflow-x-auto ${className}`}>
            <table className={`w-full text-sm ${minWidth}`}>
                <thead>
                    <tr className="border-b border-theme-line bg-theme-bg-elevated/60">
                        {columns.map((c) => (
                            <th
                                key={c.key}
                                scope="col"
                                className={`px-4 py-3 text-[0.6875rem] font-mono font-normal uppercase tracking-[0.15em] text-theme-text-muted whitespace-nowrap ${ALIGN[c.align] || ALIGN.left} ${c.className || ''}`}
                            >
                                {c.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {hasRows
                        ? children
                        : empty
                            ? <tr><td colSpan={columns.length}>{empty}</td></tr>
                            : null}
                </tbody>
            </table>
        </div>
    );
};

AdminTable.propTypes = {
    columns: PropTypes.arrayOf(PropTypes.shape({
        key: PropTypes.string.isRequired,
        label: PropTypes.node,
        align: PropTypes.oneOf(['left', 'center', 'right']),
        className: PropTypes.string,
    })).isRequired,
    empty: PropTypes.node,
    children: PropTypes.node,
    className: PropTypes.string,
    minWidth: PropTypes.string,
};

export const AdminTr = ({ onClick, dimmed = false, className = '', children }) => (
    <tr
        className={`border-b border-theme-line/50 transition-colors ${onClick ? 'cursor-pointer hover:bg-theme-bg-elevated' : ''} ${dimmed ? 'opacity-60' : ''} ${className}`}
        onClick={onClick}
    >
        {children}
    </tr>
);

AdminTr.propTypes = {
    onClick: PropTypes.func,
    dimmed: PropTypes.bool,
    className: PropTypes.string,
    children: PropTypes.node,
};

export const AdminTd = ({ align = 'left', mono = false, muted = false, colSpan, className = '', children }) => (
    <td
        colSpan={colSpan}
        className={`px-4 py-3 align-middle ${ALIGN[align] || ALIGN.left} ${mono ? 'font-mono' : ''} ${muted ? 'text-theme-text-muted' : 'text-theme-text'} ${className}`}
    >
        {children}
    </td>
);

AdminTd.propTypes = {
    align: PropTypes.oneOf(['left', 'center', 'right']),
    mono: PropTypes.bool,
    muted: PropTypes.bool,
    colSpan: PropTypes.number,
    className: PropTypes.string,
    children: PropTypes.node,
};

export default AdminTable;
