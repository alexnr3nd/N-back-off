/* File: src/components/changelog/ChangelogEntry.js */

import React from 'react';
import { Link } from 'react-router-dom';

// Category color mapping
const categoryStyles = {
    feature: {
        badge: 'bg-amber-accent/20 text-theme-accent border-amber-accent/30',
        label: 'Feature',
    },
    improvement: {
        badge: 'bg-neural-pulse/20 text-neural-pulse border-neural-pulse/30',
        label: 'Improvement',
    },
    fix: {
        badge: 'bg-neural-dendrite/20 text-neural-dendrite border-neural-dendrite/30',
        label: 'Fix',
    },
    announcement: {
        badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        label: 'Announcement',
    },
};

// Format date as "December 31, 2024"
const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};

// Parse inline markdown (links and bold) and return React elements
const parseInlineMarkdown = (text, keyPrefix = '') => {
    if (!text) return null;

    const combinedRegex = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = combinedRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index));
        }

        if (match[1] && match[2]) {
            const linkText = match[1];
            const url = match[2];

            if (url.startsWith('/')) {
                parts.push(
                    <Link
                        key={`${keyPrefix}-${key++}`}
                        to={url}
                        className="text-theme-accent hover:underline"
                    >
                        {linkText}
                    </Link>
                );
            } else {
                parts.push(
                    <a
                        key={`${keyPrefix}-${key++}`}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-theme-accent hover:underline"
                    >
                        {linkText}
                    </a>
                );
            }
        } else if (match[3]) {
            parts.push(
                <strong key={`${keyPrefix}-${key++}`} className="text-theme-text font-medium">
                    {match[3]}
                </strong>
            );
        }

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : text;
};

// Parse a markdown table row into cells
const parseTableRow = (row) => {
    return row
        .split('|')
        .slice(1, -1) // Remove empty first/last from leading/trailing |
        .map(cell => cell.trim());
};

// Check if a line is a table separator (|---|---|)
const isTableSeparator = (line) => {
    return /^\|[\s\-:]+\|$/.test(line.trim().replace(/\s+/g, ''));
};

// Render a markdown table as a React element
const renderTable = (tableLines, keyPrefix) => {
    if (tableLines.length < 2) return null;

    const headerRow = parseTableRow(tableLines[0]);
    // Skip separator row (index 1)
    const bodyRows = tableLines.slice(2).map(line => parseTableRow(line));

    return (
        <div key={keyPrefix} className="my-4 overflow-x-auto">
            <table className="w-full text-xs font-mono border-collapse">
                <thead>
                    <tr className="bg-theme-bg-elevated">
                        {headerRow.map((cell, i) => (
                            <th
                                key={i}
                                className="px-3 py-2 text-left text-theme-text font-medium border border-theme-line"
                            >
                                {parseInlineMarkdown(cell, `${keyPrefix}-h${i}`)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {bodyRows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-theme-bg-elevated/50">
                            {row.map((cell, cellIndex) => (
                                <td
                                    key={cellIndex}
                                    className="px-3 py-2 text-theme-text-secondary border border-theme-line"
                                >
                                    {parseInlineMarkdown(cell, `${keyPrefix}-r${rowIndex}c${cellIndex}`)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// Parse content with tables and inline markdown
const parseContent = (content) => {
    if (!content) return null;

    const lines = content.split('\n');
    const result = [];
    let currentText = [];
    let currentTable = [];
    let inTable = false;
    let key = 0;

    const flushText = () => {
        if (currentText.length > 0) {
            const text = currentText.join('\n');
            result.push(
                <span key={`text-${key++}`}>
                    {parseInlineMarkdown(text, `inline-${key}`)}
                </span>
            );
            currentText = [];
        }
    };

    const flushTable = () => {
        if (currentTable.length >= 2) {
            result.push(renderTable(currentTable, `table-${key++}`));
        }
        currentTable = [];
        inTable = false;
    };

    for (const line of lines) {
        const trimmedLine = line.trim();
        const isTableLine = trimmedLine.startsWith('|') && trimmedLine.endsWith('|');

        if (isTableLine) {
            if (!inTable) {
                flushText();
                inTable = true;
            }
            // Skip separator rows from storage but keep them for validation
            if (!isTableSeparator(trimmedLine)) {
                currentTable.push(trimmedLine);
            }
        } else {
            if (inTable) {
                flushTable();
            }
            currentText.push(line);
        }
    }

    // Flush any remaining content
    if (inTable) {
        flushTable();
    }
    flushText();

    return result;
};

const ChangelogEntry = ({ entry }) => {
    const category = categoryStyles[entry.category] || categoryStyles.announcement;

    return (
        <div className="specimen-card rounded-lab p-6 border border-theme-line bg-theme-bg-secondary">
            {/* Header: Category badge + Date */}
            <div className="flex items-center justify-between mb-4">
                <span className={`px-2 py-1 rounded text-xs font-mono uppercase border ${category.badge}`}>
                    {category.label}
                </span>
                <span className="text-xs text-theme-text-muted font-mono">
                    {formatDate(entry.publishedAt)}
                </span>
            </div>

            {/* Title */}
            <h3 className="text-lg font-serif text-theme-text mb-3">
                {entry.title}
            </h3>

            {/* Content - preserve line breaks and render markdown-style links */}
            <div className="text-sm text-theme-text-secondary leading-relaxed whitespace-pre-wrap">
                {parseContent(entry.content)}
            </div>

            {/* Optional version */}
            {entry.version && (
                <div className="mt-4 pt-4 border-t border-theme-line">
                    <span className="text-xs text-theme-text-muted font-mono">v{entry.version}</span>
                </div>
            )}
        </div>
    );
};

export default ChangelogEntry;
