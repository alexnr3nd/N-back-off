/* src/components/sessions/DateFilterControls.js */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCalendarDays,
    faFilterCircleXmark,
    faCheck,
    faTimes
} from '@fortawesome/free-solid-svg-icons';

// Helper to format date to readable format
const formatDateForDisplay = (date) => {
    if (!date) return '';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
};

const DateFilterControls = ({ onFilterChange, initialStartDate = null, initialEndDate = null }) => {
    const [startDate, setStartDate] = useState(initialStartDate);
    const [endDate, setEndDate] = useState(initialEndDate);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
    const buttonRef = useRef(null);
    const datePickerRef = useRef(null);

    useEffect(() => {
        setStartDate(initialStartDate);
        setEndDate(initialEndDate);
    }, [initialStartDate, initialEndDate]);

    // Calculate dropdown position when opening
    const updateDropdownPosition = useCallback(() => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + 8,
                left: rect.left
            });
        }
    }, []);

    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (datePickerRef.current && !datePickerRef.current.contains(event.target) &&
                buttonRef.current && !buttonRef.current.contains(event.target)) {
                setShowDatePicker(false);
            }
        };

        if (showDatePicker) {
            document.addEventListener('mousedown', handleClickOutside);
            window.addEventListener('resize', updateDropdownPosition);
            window.addEventListener('scroll', updateDropdownPosition, true);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('resize', updateDropdownPosition);
            window.removeEventListener('scroll', updateDropdownPosition, true);
        };
    }, [showDatePicker, updateDropdownPosition]);

    const handleToggle = () => {
        if (!showDatePicker) {
            updateDropdownPosition();
        }
        setShowDatePicker(!showDatePicker);
    };

    const handleApplyFilter = () => {
        onFilterChange(startDate, endDate);
        setShowDatePicker(false);
    };

    const handleClearFilter = () => {
        setStartDate(null);
        setEndDate(null);
        onFilterChange(null, null);
        setShowDatePicker(false);
    };

    const handleDateChange = (dates) => {
        const [start, end] = dates;
        setStartDate(start);
        setEndDate(end);
    };

    const isFiltersActive = startDate || endDate;

    // Dropdown rendered via portal to escape stacking contexts
    const dropdownContent = showDatePicker ? createPortal(
        <div
            ref={datePickerRef}
            className="fixed bg-theme-bg-elevated border border-theme-line shadow-2xl p-4 min-w-[320px]"
            style={{
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                zIndex: 9999
            }}
            id="date-picker-dropdown"
        >
            {/* Header */}
            <div className="mb-4 pb-3 border-b border-theme-line">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 bg-theme-accent rounded-full"></div>
                    <h3 className="text-xs font-mono text-theme-text-muted uppercase tracking-[0.15em]">Temporal Range</h3>
                </div>
                <p className="text-xs text-theme-text-secondary font-serif italic">Select start and end dates for query</p>
            </div>

            {/* Selected range display */}
            <div className="bg-theme-bg-secondary border border-theme-line p-3 mb-4">
                <div className="h-6 flex justify-center items-center">
                    {(startDate || endDate) ? (
                        <div className="text-sm font-mono text-theme-accent">
                            {startDate ? formatDateForDisplay(startDate) : "..."}
                            <span className="mx-2 text-theme-text-muted">→</span>
                            {endDate ? formatDateForDisplay(endDate) : "Present"}
                        </div>
                    ) : (
                        <div className="text-xs font-mono text-theme-text-muted uppercase tracking-wider">No range selected</div>
                    )}
                </div>
            </div>

            {/* Date Picker - with custom dark theme class */}
            <div className="date-picker-dark mb-4">
                <DatePicker
                    selected={startDate}
                    onChange={handleDateChange}
                    startDate={startDate}
                    endDate={endDate}
                    selectsRange
                    inline
                    maxDate={new Date()}
                    calendarClassName="!bg-theme-bg-secondary !border-theme-line"
                />
            </div>

            {/* Footer with actions */}
            <div className="flex justify-between items-center pt-3 border-t border-theme-line">
                <div className="text-xs text-theme-text-muted font-mono h-5">
                    {startDate && !endDate && (
                        <span className="text-amber-dim">← Select end date</span>
                    )}
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setShowDatePicker(false)}
                        className="px-3 py-1.5 border border-theme-line text-xs font-mono uppercase tracking-wider text-theme-text-secondary hover:text-theme-text hover:border-warm-muted focus:outline-none transition-colors"
                    >
                        <FontAwesomeIcon icon={faTimes} className="mr-1.5 h-3 w-3" />
                        Cancel
                    </button>

                    <button
                        onClick={handleApplyFilter}
                        className="px-3 py-1.5 bg-theme-accent text-theme-bg text-xs font-mono uppercase tracking-wider hover:bg-amber-highlight disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none transition-colors"
                        disabled={!startDate}
                    >
                        <FontAwesomeIcon icon={faCheck} className="mr-1.5 h-3 w-3" />
                        Apply
                    </button>
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <div className="w-full sm:w-auto flex flex-col sm:flex-row items-start sm:items-center gap-2">
            {/* Button to toggle Date Picker Popover - Lab instrument style */}
            <button
                ref={buttonRef}
                onClick={handleToggle}
                className={`flex items-center px-4 py-2 border text-sm font-mono transition-colors focus:outline-none focus:ring-1 focus:ring-theme-accent/50 w-full sm:w-auto ${
                    isFiltersActive
                        ? 'bg-theme-accent/10 text-theme-accent border-theme-accent/50 hover:bg-theme-accent/20'
                        : 'bg-theme-bg-elevated text-theme-text-secondary border-theme-line hover:border-warm-muted hover:text-theme-text'
                }`}
                aria-expanded={showDatePicker}
                aria-controls="date-picker-dropdown"
            >
                <FontAwesomeIcon icon={faCalendarDays} className={`mr-2 h-4 w-4 ${isFiltersActive ? 'text-theme-accent' : 'text-theme-text-muted'}`} />
                {isFiltersActive ? (
                    <span className="truncate uppercase tracking-wider text-xs">
                        {formatDateForDisplay(startDate)} — {formatDateForDisplay(endDate) || 'Present'}
                    </span>
                ) : (
                    <span className="uppercase tracking-wider text-xs">Select Date Range</span>
                )}
            </button>

            {/* Clear Button - Visible only when a filter is active */}
            {isFiltersActive && (
                <button
                    onClick={handleClearFilter}
                    className="flex items-center px-3 py-2 bg-status-error/10 border border-status-error/30 text-sm font-mono text-status-error hover:bg-status-error/20 focus:outline-none focus:ring-1 focus:ring-status-error/50 sm:ml-2 transition-colors"
                    title="Clear Date Filter"
                >
                    <FontAwesomeIcon icon={faFilterCircleXmark} className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline uppercase tracking-wider text-xs">Clear</span>
                </button>
            )}

            {/* Dropdown rendered via portal */}
            {dropdownContent}
        </div>
    );
};

export default DateFilterControls;