/* src/components/sessions/ExportButton.js */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFileExport,
    faCheck,
    faInfoCircle,
    faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';
import ButtonSpinner from '../ui/ButtonSpinner';

// Function to convert array of objects to CSV string
const convertToCSV = (data, headers) => {
    if (!Array.isArray(data) || data.length === 0) return '';

    const headerRow = headers.map(h => `"${h.label}"`).join(',');
    const dataRows = data.map(row => {
        return headers.map(header => {
            let value = row[header.key] ?? '';

            if (value instanceof Date) {
                value = value.toISOString();
            } else if (typeof value === 'number') {
                if (header.key.toLowerCase().includes('accuracy') || header.key.toLowerCase().includes('rate')) {
                    value = value.toFixed(3);
                } else if (header.key.toLowerCase().includes('dprime') || header.key.toLowerCase().includes('difficulty')) {
                    value = value.toFixed(4);
                }
            } else if (typeof value === 'string' && value.includes(',')) {
                value = `"${value.replace(/"/g, '""')}"`;
            } else if (typeof value === 'boolean') {
                value = value ? 'TRUE' : 'FALSE';
            } else if (typeof value === 'object' && value !== null) {
                try {
                    value = `"${JSON.stringify(value).replace(/"/g, '""')}"`;
                } catch (e) {
                    console.warn(`Could not stringify object for CSV export (key: ${header.key}):`, value);
                    value = '"[Object]"';
                }
            }
            value = String(value);
            if (!value.startsWith('"') && (value.includes(',') || value.includes('\n') || value.includes('"'))) {
                value = `"${value.replace(/"/g, '""')}"`;
            }

            return value;
        }).join(',');
    });

    return [headerRow, ...dataRows].join('\n');
};

// Function to trigger CSV download
const downloadCSV = (csvString, filename = 'sessions.csv') => {
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } else {
        alert("CSV download is not supported in this browser.");
    }
};

// --- ExportButton Component - Lab instrument style ---
const ExportButton = ({
    profileId,
    startDate,
    endDate,
    fetchAllSessionsForExport,
    filenamePrefix = "dualnback_sessions",
    disabled = false,
    className = ""
}) => {
    const [exportState, setExportState] = useState('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [tooltipVisible, setTooltipVisible] = useState(false);
    const [exportedCount, setExportedCount] = useState(0);
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
    const buttonRef = useRef(null);

    // Calculate tooltip position
    const updateTooltipPosition = useCallback(() => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setTooltipPosition({
                top: rect.bottom + 8,
                left: rect.left + rect.width / 2 - 128 // Center the 256px tooltip
            });
        }
    }, []);

    useEffect(() => {
        if (tooltipVisible) {
            updateTooltipPosition();
            window.addEventListener('resize', updateTooltipPosition);
            window.addEventListener('scroll', updateTooltipPosition, true);
        }
        return () => {
            window.removeEventListener('resize', updateTooltipPosition);
            window.removeEventListener('scroll', updateTooltipPosition, true);
        };
    }, [tooltipVisible, updateTooltipPosition]);

    const handleExport = async () => {
        if (!fetchAllSessionsForExport) {
            alert("Cannot export: Export function not available.");
            setExportState('error');
            setErrorMessage("Configuration error.");
            return;
        }

        setExportState('fetching');
        setErrorMessage('');
        setExportedCount(0);

        try {
            const result = await fetchAllSessionsForExport(null, startDate, endDate);

            if (!result.success) {
                throw new Error(result.error || "Failed to fetch sessions for export.");
            }

            const serverCsv = result.csv || '';
            const serverCount = result.count ?? 0;
            const legacySessions = Array.isArray(result.sessions) ? result.sessions : [];
            const totalCount = serverCount || legacySessions.length;

            setExportedCount(totalCount);

            if (totalCount === 0) {
                alert("No sessions found matching the selected date range to export.");
                setExportState('idle');
                return;
            }

            // Fallback: only used if the server returned the legacy { sessions: [...] } shape
            // (e.g., a backend rollback). Matches the headers defined in functions/csvExport.js.
            const headers = [
                { key: 'id', label: 'Session ID' },
                { key: 'recordedAt', label: 'Date' },
                { key: 'gameMode', label: 'Game Mode' },
                { key: 'nBack', label: 'N-Back' },
                { key: 'difficulty', label: 'Difficulty' },
                { key: 'durationMs', label: 'Duration (ms)' },
                { key: 'accuracy', label: 'Overall Accuracy (%)' },
                { key: 'visualAccuracy', label: 'Position Accuracy (%)' },
                { key: 'audioAccuracy', label: 'Audio Accuracy (%)' },
                { key: 'colorAccuracy', label: 'Color Accuracy (%)' },
                { key: 'shapeAccuracy', label: 'Shape Accuracy (%)' },
                { key: 'visualDprime', label: 'Position d-prime' },
                { key: 'audioDprime', label: 'Audio d-prime' },
                { key: 'colorDprime', label: 'Color d-prime' },
                { key: 'shapeDprime', label: 'Shape d-prime' },
                { key: 'overallDprime', label: 'Overall d-prime' },
                { key: 'visualCorrect', label: 'Position Hits' },
                { key: 'visualTargetCount', label: 'Position Targets' },
                { key: 'visualFalseAlarms', label: 'Position False Alarms' },
                { key: 'audioCorrect', label: 'Audio Hits' },
                { key: 'audioTargetCount', label: 'Audio Targets' },
                { key: 'audioFalseAlarms', label: 'Audio False Alarms' },
                { key: 'colorCorrect', label: 'Color Hits' },
                { key: 'colorTargetCount', label: 'Color Targets' },
                { key: 'colorFalseAlarms', label: 'Color False Alarms' },
                { key: 'shapeCorrect', label: 'Shape Hits' },
                { key: 'shapeTargetCount', label: 'Shape Targets' },
                { key: 'shapeFalseAlarms', label: 'Shape False Alarms' },
                { key: 'newNBack', label: 'Resulting N-Back' },
                { key: 'newDifficulty', label: 'Resulting Difficulty' },
                { key: 'consecutiveSuccesses', label: 'Resulting Consecutive Successes' },
                { key: 'promotionCredits', label: 'Resulting Promotion Credits' },
                { key: 'completedEarly', label: 'Completed Early' },
                { key: 'trialsCompleted', label: 'Trials Completed' },
                { key: 'totalTrialsPlanned', label: 'Trials Planned' },
                { key: 'note', label: 'Note' },
            ];

            const csvString = serverCsv || convertToCSV(legacySessions, headers);
            if (!csvString) {
                throw new Error("Export returned no data.");
            }
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `${filenamePrefix}_${timestamp}.csv`;

            downloadCSV(csvString, filename);

            setExportState('success');
            setTimeout(() => {
                setExportState('idle');
            }, 3000);

        } catch (error) {
            console.error("Error during export process:", error);
            setErrorMessage(error.message || "An error occurred during export.");
            setExportState('error');
        }
    };

    // Helper to determine button appearance and props based on state - Lab instrument style
    const getButtonState = () => {
        const baseClasses = "flex items-center justify-center px-4 py-2 text-xs font-mono uppercase tracking-wider focus:outline-none focus:ring-1 transition-colors";
        switch (exportState) {
            case 'fetching':
                return {
                    icon: null, // Use ButtonSpinner instead
                    text: 'Processing',
                    classes: `${baseClasses} bg-theme-bg-surface text-theme-text-muted border border-theme-line cursor-wait`,
                    props: { disabled: true, title: "Fetching data for export..." },
                    useSpinner: true
                };
            case 'success':
                return {
                    icon: faCheck,
                    text: 'Complete',
                    classes: `${baseClasses} bg-status-success/20 text-status-success border border-status-success/50`,
                    props: { disabled: true, title: `Successfully exported ${exportedCount} sessions.` }
                };
            case 'error':
                return {
                    icon: faExclamationTriangle,
                    text: 'Error',
                    classes: `${baseClasses} bg-status-error/20 text-status-error border border-status-error/50 hover:bg-status-error/30`,
                    props: { title: `Export failed: ${errorMessage}` }
                };
            case 'idle':
            default:
                if (disabled) {
                    return {
                        icon: faFileExport,
                        text: 'Export',
                        classes: `${baseClasses} bg-theme-bg-surface text-theme-text-muted border border-theme-line cursor-not-allowed opacity-50`,
                        props: { disabled: true, title: "Export unavailable (loading page data)" }
                    };
                }
                return {
                    icon: faFileExport,
                    text: 'Export CSV',
                    classes: `${baseClasses} bg-theme-bg-elevated text-theme-text-secondary border border-theme-line hover:border-theme-accent hover:text-theme-accent`,
                    props: { title: "Export sessions to CSV based on date filters" }
                };
        }
    };

    const buttonState = getButtonState();

    const formatDateForDisplay = (date) => {
        if (!date || !(date instanceof Date) || isNaN(date)) return '';
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const tooltipText = startDate || endDate
        ? `Export all sessions within the selected date range (${formatDateForDisplay(startDate) || 'Beginning'} - ${formatDateForDisplay(endDate) || 'Present'}).`
        : "Export all sessions as a CSV file, including all available metrics.";

    // Tooltip rendered via portal
    const tooltipContent = tooltipVisible && exportState === 'idle' && !buttonState.props.disabled ? createPortal(
        <div
            className="fixed w-64 p-3 bg-theme-bg-elevated border border-theme-line shadow-2xl text-theme-text-secondary text-xs"
            style={{
                top: tooltipPosition.top,
                left: Math.max(8, tooltipPosition.left), // Prevent going off-screen
                zIndex: 9999
            }}
        >
            <div className="flex items-start">
                <FontAwesomeIcon icon={faInfoCircle} className="h-3.5 w-3.5 mr-2 mt-0.5 text-amber-dim flex-shrink-0" />
                <span className="font-mono">
                    {tooltipText}
                </span>
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <div className={className}>
            <button
                ref={buttonRef}
                onClick={handleExport}
                disabled={buttonState.props.disabled || exportState === 'fetching' || exportState === 'success'}
                className={buttonState.classes}
                title={buttonState.props.title}
                onMouseEnter={() => !buttonState.props.disabled && setTooltipVisible(true)}
                onMouseLeave={() => setTooltipVisible(false)}
                onFocus={() => !buttonState.props.disabled && setTooltipVisible(true)}
                onBlur={() => setTooltipVisible(false)}
            >
                {buttonState.useSpinner ? (
                    <span className="mr-2"><ButtonSpinner color="amber" /></span>
                ) : (
                    <FontAwesomeIcon icon={buttonState.icon} className="h-3.5 w-3.5 mr-2" />
                )}
                {buttonState.text}
            </button>

            {/* Tooltip rendered via portal */}
            {tooltipContent}
        </div>
    );
};

export default ExportButton;