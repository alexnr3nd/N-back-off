/* src/components/testing/symmetrySpan/SymmetryMatrix.js */
import React from 'react';
import PropTypes from 'prop-types';
import { SYMSPAN_DEFAULTS } from '../../../constants/symmetrySpanConstants';

const MATRIX_DIM = SYMSPAN_DEFAULTS.MATRIX_DIM;
const TOTAL_CELLS = MATRIX_DIM * MATRIX_DIM;

/**
 * The 8x8 symmetry-judgment display: a black-and-white cell pattern with
 * Symmetric / Not Symmetric response buttons below (touch + mouse).
 * Participant-paced up to the calibrated deadline (timer lives in the hook).
 * No axis line is drawn during trials — judging the vertical axis unaided is
 * part of the canonical task; the instructions illustrate it instead.
 */
const SymmetryMatrix = ({ pattern, onJudge, disabled = false }) => {
    if (!pattern) return null;
    const filled = new Set(pattern.filledCells);

    return (
        <div aria-hidden="true" className="flex flex-col items-center w-full select-none">
            {/* Pattern */}
            <div className="border border-theme-line bg-theme-bg-elevated p-1.5 mb-6">
                <div
                    className="grid gap-px bg-theme-line/60"
                    style={{
                        gridTemplateColumns: `repeat(${MATRIX_DIM}, minmax(0, 1fr))`,
                        gridTemplateRows: `repeat(${MATRIX_DIM}, minmax(0, 1fr))`,
                        width: 'min(76vw, 304px)',
                        height: 'min(76vw, 304px)',
                    }}
                >
                    {Array.from({ length: TOTAL_CELLS }, (_, i) => (
                        <div
                            key={i}
                            className={filled.has(i) ? 'bg-theme-text' : 'bg-theme-bg-secondary'}
                        />
                    ))}
                </div>
            </div>

            {/* Judgment buttons (styling mirrors the OSPAN True/False pair) */}
            <div className="flex gap-4">
                <button
                    onClick={() => onJudge(true)}
                    disabled={disabled}
                    className="px-6 sm:px-8 py-3 text-base sm:text-lg font-mono uppercase tracking-wider
                        bg-theme-bg-elevated border border-theme-line text-theme-text
                        hover:border-status-success hover:text-status-success
                        disabled:opacity-50 disabled:cursor-not-allowed
                        transition-colors duration-150"
                >
                    Symmetric
                </button>
                <button
                    onClick={() => onJudge(false)}
                    disabled={disabled}
                    className="px-6 sm:px-8 py-3 text-base sm:text-lg font-mono uppercase tracking-wider
                        bg-theme-bg-elevated border border-theme-line text-theme-text
                        hover:border-status-error hover:text-status-error
                        disabled:opacity-50 disabled:cursor-not-allowed
                        transition-colors duration-150"
                >
                    Not Symmetric
                </button>
            </div>

            <p className="mt-4 text-xs font-mono text-theme-text-muted uppercase tracking-wider">
                Mirrored across the vertical axis?
            </p>
        </div>
    );
};

SymmetryMatrix.propTypes = {
    pattern: PropTypes.shape({
        filledCells: PropTypes.arrayOf(PropTypes.number).isRequired,
    }),
    onJudge: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
};

export default SymmetryMatrix;
