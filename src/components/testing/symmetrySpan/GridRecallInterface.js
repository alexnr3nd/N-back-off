/* src/components/testing/symmetrySpan/GridRecallInterface.js */
import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDeleteLeft, faCheck, faSquare } from '@fortawesome/free-solid-svg-icons';
import { SYMSPAN_DEFAULTS } from '../../../constants/symmetrySpanConstants';

const GRID_DIM = SYMSPAN_DEFAULTS.GRID_DIM;
const TOTAL_CELLS = GRID_DIM * GRID_DIM;
const ACCURACY_THRESHOLD = SYMSPAN_DEFAULTS.PROCESSING_ACCURACY_THRESHOLD;

/**
 * Recall interface: an empty 4x4 grid. Tap cells in presentation order —
 * selected cells show a numbered badge. Blank inserts a placeholder for a
 * forgotten position; Back removes the last entry; Clear restarts (canonical
 * recall controls). Untimed apart from the 90 s safety timeout.
 * Controlled component: sequence via `value` (cell indices and nulls),
 * changes via `onChange`. The cumulative symmetry percentage is the canonical
 * live 85% criterion display (red when below).
 */
const GridRecallInterface = ({ setSize, value, onChange, onSubmit, cumulativeCorrect, cumulativeTotal, showAccuracy = true }) => {
    const sequence = value || [];

    // cell index -> 1-based recall position
    const orderByCell = useMemo(() => {
        const map = new Map();
        sequence.forEach((cell, i) => {
            if (cell !== null && cell !== undefined) map.set(cell, i + 1);
        });
        return map;
    }, [sequence]);

    const handleCellTap = useCallback((cell) => {
        if (orderByCell.has(cell)) return;          // no duplicate selections
        if (sequence.length >= TOTAL_CELLS) return; // hard cap
        onChange([...sequence, cell]);
    }, [sequence, orderByCell, onChange]);

    const handleBlank = useCallback(() => {
        if (sequence.length >= TOTAL_CELLS) return;
        onChange([...sequence, null]);
    }, [sequence, onChange]);

    const handleBack = useCallback(() => {
        if (sequence.length === 0) return;
        onChange(sequence.slice(0, -1));
    }, [sequence, onChange]);

    const handleClear = useCallback(() => {
        if (sequence.length === 0) return;
        onChange([]);
    }, [sequence, onChange]);

    const accuracy = cumulativeTotal > 0 ? (cumulativeCorrect / cumulativeTotal) * 100 : 100;
    const isLowAccuracy = accuracy < ACCURACY_THRESHOLD;
    const isEmpty = sequence.length === 0;

    return (
        <div className="flex flex-col items-center w-full max-w-sm mx-auto py-2">
            {/* Prompt + cumulative symmetry accuracy (canonical upper-right display) */}
            <div className="w-full flex items-end justify-between mb-4">
                <p className="text-sm font-mono text-theme-text-muted uppercase tracking-wider">
                    Recall the squares in order
                </p>
                {showAccuracy && cumulativeTotal > 0 && (
                    <p className={`text-xs font-mono uppercase tracking-wider ${isLowAccuracy ? 'text-status-error' : 'text-theme-text-muted'}`}>
                        Symmetry {accuracy.toFixed(0)}%
                    </p>
                )}
            </div>

            {/* Sequence slots (en-dash marks a Blank, matching the OSPAN display) */}
            <div className="flex justify-center flex-wrap gap-2 mb-5 min-h-[40px] items-end">
                {Array.from({ length: setSize }).map((_, index) => {
                    const entry = sequence[index];
                    const isNext = index === sequence.length;
                    return (
                        <span
                            key={index}
                            className={`w-9 h-9 flex items-center justify-center text-lg font-mono border transition-all duration-150 ${
                                isNext
                                    ? 'border-theme-accent bg-theme-accent/10 text-theme-accent'
                                    : 'border-theme-line bg-theme-bg-secondary'
                            } ${entry !== undefined ? 'text-theme-text' : 'text-theme-text-muted'}`}
                        >
                            {entry === undefined ? '_' : (entry === null ? '–' : index + 1)}
                        </span>
                    );
                })}
                {/* Extra taps beyond setSize still display so users can correct them */}
                {sequence.slice(setSize).map((entry, i) => (
                    <span key={`extra_${i}`} className="w-9 h-9 flex items-center justify-center text-lg font-mono border border-theme-line bg-theme-bg-secondary text-theme-text">
                        {entry === null ? '–' : setSize + i + 1}
                    </span>
                ))}
            </div>

            {/* 4x4 recall grid */}
            <div className="border border-theme-line bg-theme-bg-elevated p-1.5 mb-5">
                <div
                    className="grid gap-px bg-theme-line/60"
                    style={{
                        gridTemplateColumns: `repeat(${GRID_DIM}, minmax(0, 1fr))`,
                        gridTemplateRows: `repeat(${GRID_DIM}, minmax(0, 1fr))`,
                        width: 'min(70vw, 272px)',
                        height: 'min(70vw, 272px)',
                    }}
                >
                    {Array.from({ length: TOTAL_CELLS }, (_, cell) => {
                        const order = orderByCell.get(cell);
                        const isSelected = order !== undefined;
                        return (
                            <button
                                key={cell}
                                onClick={() => handleCellTap(cell)}
                                disabled={isSelected}
                                className={`flex items-center justify-center overflow-hidden transition-colors duration-100 ${
                                    isSelected
                                        ? 'bg-theme-accent/20 cursor-default'
                                        : 'bg-theme-bg-secondary hover:bg-theme-accent/10 active:bg-theme-accent/20'
                                }`}
                            >
                                {isSelected && (
                                    <span className="text-xl leading-none font-mono font-bold text-theme-accent">{order}</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Blank button */}
            <div className="w-full mb-3">
                <button
                    onClick={handleBlank}
                    className="w-full py-2.5 px-4 text-sm font-mono uppercase tracking-wider border transition-colors duration-150 flex items-center justify-center gap-2
                        bg-theme-bg-elevated text-theme-text-muted border-theme-line hover:border-theme-accent hover:text-theme-accent"
                >
                    <FontAwesomeIcon icon={faSquare} className="h-3 w-3" />
                    <span>Blank (forgot this one)</span>
                </button>
            </div>

            {/* Control buttons */}
            <div className="grid grid-cols-3 gap-2 w-full">
                <button
                    onClick={handleBack}
                    disabled={isEmpty}
                    className={`py-3 px-2 text-sm font-mono uppercase tracking-wider border transition-colors duration-150 flex items-center justify-center gap-1 ${
                        isEmpty
                            ? 'bg-theme-bg-secondary text-theme-text-muted/40 cursor-not-allowed border-theme-line/50'
                            : 'bg-theme-bg-elevated text-theme-accent border-theme-accent/50 hover:bg-theme-accent/10 hover:border-theme-accent'
                    }`}
                >
                    <FontAwesomeIcon icon={faDeleteLeft} className="h-4 w-4" />
                    <span className="hidden sm:inline">Back</span>
                </button>

                <button
                    onClick={handleClear}
                    disabled={isEmpty}
                    className={`py-3 px-2 text-sm font-mono uppercase tracking-wider border transition-colors duration-150 flex items-center justify-center ${
                        isEmpty
                            ? 'bg-theme-bg-secondary text-theme-text-muted/40 cursor-not-allowed border-theme-line/50'
                            : 'bg-theme-bg-elevated text-status-error/70 border-status-error/30 hover:bg-status-error/10 hover:border-status-error'
                    }`}
                >
                    Clear
                </button>

                <button
                    onClick={onSubmit}
                    className="py-3 px-2 text-sm font-mono uppercase tracking-wider border transition-colors duration-150 flex items-center justify-center gap-1 bg-status-success text-white border-status-success hover:bg-status-success/90"
                >
                    <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                    <span className="hidden sm:inline">Submit</span>
                </button>
            </div>
        </div>
    );
};

GridRecallInterface.propTypes = {
    setSize: PropTypes.number.isRequired,
    value: PropTypes.array.isRequired,
    onChange: PropTypes.func.isRequired,
    onSubmit: PropTypes.func.isRequired,
    cumulativeCorrect: PropTypes.number,
    cumulativeTotal: PropTypes.number,
    showAccuracy: PropTypes.bool,
};

export default GridRecallInterface;
