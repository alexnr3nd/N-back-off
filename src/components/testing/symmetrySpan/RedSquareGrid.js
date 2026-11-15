/* src/components/testing/symmetrySpan/RedSquareGrid.js */
import React from 'react';
import PropTypes from 'prop-types';
import { SYMSPAN_DEFAULTS } from '../../../constants/symmetrySpanConstants';

const GRID_DIM = SYMSPAN_DEFAULTS.GRID_DIM;
const TOTAL_CELLS = GRID_DIM * GRID_DIM;

/**
 * The 4x4 storage display: one cell filled red for 650 ms (canonical), or an
 * empty grid during blanks so the stimulus swap causes no layout shift.
 */
const RedSquareGrid = ({ squareCell = null }) => (
    <div aria-hidden="true" className="flex items-center justify-center select-none">
        <div className="border border-theme-line bg-theme-bg-elevated p-1.5">
            <div
                className="grid gap-px bg-theme-line/60"
                style={{
                    gridTemplateColumns: `repeat(${GRID_DIM}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${GRID_DIM}, minmax(0, 1fr))`,
                    width: 'min(70vw, 288px)',
                    height: 'min(70vw, 288px)',
                }}
            >
                {Array.from({ length: TOTAL_CELLS }, (_, i) => (
                    <div
                        key={i}
                        className={i === squareCell ? 'bg-status-error' : 'bg-theme-bg-secondary'}
                    />
                ))}
            </div>
        </div>
    </div>
);

RedSquareGrid.propTypes = {
    squareCell: PropTypes.number,
};

export default RedSquareGrid;
